using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace SwahiliCourse.Api.Services;

// Synthesizes Swahili speech via a cloud TTS provider (Google or Azure) and
// caches the resulting MP3 on disk so each distinct word is only ever paid for
// and generated once. If no provider/key is configured the service returns null,
// and the frontend falls back to the browser/device built-in voice.
public class TtsService
{
    private readonly IHttpClientFactory _http;
    private readonly IConfiguration _config;
    private readonly ILogger<TtsService> _log;
    private readonly string _cacheDir;
    private static readonly SemaphoreSlim _gate = new(8);

    public TtsService(IHttpClientFactory http, IConfiguration config, IWebHostEnvironment env, ILogger<TtsService> log)
    {
        _http = http; _config = config; _log = log;
        _cacheDir = Path.Combine(env.ContentRootPath, "App_Data", "tts-cache");
        Directory.CreateDirectory(_cacheDir);
    }

    public string Provider => (_config["Tts:Provider"] ?? "None").Trim();

    public bool IsConfigured => Provider switch
    {
        "Google" => !string.IsNullOrWhiteSpace(_config["Tts:Google:ApiKey"]),
        "Azure" => !string.IsNullOrWhiteSpace(_config["Tts:Azure:Key"]) && !string.IsNullOrWhiteSpace(_config["Tts:Azure:Region"]),
        "Knowlez" => !string.IsNullOrWhiteSpace(_config["Tts:Knowlez:ApiKey"]),
        "Mock" => true, // local demo/test tone — no key needed
        _ => false
    };

    public record TtsResult(byte[] Bytes, string ContentType, string Ext);

    // Returns synthesized audio for the given text, or null if TTS isn't configured / fails.
    public async Task<TtsResult?> SynthesizeAsync(string text, CancellationToken ct = default)
    {
        if (!IsConfigured) return null;

        var voice = _config["Tts:Voice"] ?? "";
        var rate = _config["Tts:Rate"] ?? "0.85";
        var ext = Provider == "Mock" ? "wav" : "mp3";
        var contentType = ext == "wav" ? "audio/wav" : "audio/mpeg";
        var cacheKey = Hash($"{Provider}|{voice}|{rate}|{text}");
        var cachePath = Path.Combine(_cacheDir, cacheKey + "." + ext);

        if (File.Exists(cachePath))
            return new TtsResult(await File.ReadAllBytesAsync(cachePath, ct), contentType, ext);

        await _gate.WaitAsync(ct);
        try
        {
            // Re-check after acquiring the gate (another request may have filled it).
            if (File.Exists(cachePath))
                return new TtsResult(await File.ReadAllBytesAsync(cachePath, ct), contentType, ext);

            byte[]? bytes = Provider switch
            {
                "Google" => await SynthesizeGoogleAsync(text, voice, rate, ct),
                "Azure" => await SynthesizeAzureAsync(text, voice, rate, ct),
                "Knowlez" => await SynthesizeKnowlezAsync(text, ct),
                "Mock" => MockTone(text),
                _ => null
            };

            if (bytes is { Length: > 0 })
            {
                await File.WriteAllBytesAsync(cachePath, bytes, ct);
                return new TtsResult(bytes, contentType, ext);
            }
            return null;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "TTS synthesis failed for \"{Text}\" via {Provider}", text, Provider);
            return null;
        }
        finally
        {
            _gate.Release();
        }
    }

    // A short PCM-WAV tone whose length scales with syllable count — stands in for
    // real speech so the audio pipeline can be exercised without a cloud key.
    private static byte[] MockTone(string text)
    {
        const int sampleRate = 16000;
        int syllables = Math.Clamp(text.Count("aeiouAEIOU".Contains), 1, 8);
        double seconds = 0.18 * syllables + 0.1;
        int n = (int)(sampleRate * seconds);

        using var ms = new MemoryStream();
        using var w = new BinaryWriter(ms);
        int dataBytes = n * 2;
        w.Write("RIFF"u8.ToArray()); w.Write(36 + dataBytes);
        w.Write("WAVE"u8.ToArray()); w.Write("fmt "u8.ToArray());
        w.Write(16); w.Write((short)1); w.Write((short)1);
        w.Write(sampleRate); w.Write(sampleRate * 2); w.Write((short)2); w.Write((short)16);
        w.Write("data"u8.ToArray()); w.Write(dataBytes);
        for (int i = 0; i < n; i++)
        {
            double env = Math.Min(1, Math.Min(i, n - i) / (sampleRate * 0.02));
            short s = (short)(Math.Sin(2 * Math.PI * 330 * i / sampleRate) * 9000 * env);
            w.Write(s);
        }
        w.Flush();
        return ms.ToArray();
    }

    private async Task<byte[]?> SynthesizeGoogleAsync(string text, string voice, string rate, CancellationToken ct)
    {
        var key = _config["Tts:Google:ApiKey"];
        var client = _http.CreateClient();
        var url = $"https://texttospeech.googleapis.com/v1/text:synthesize?key={key}";

        object voiceObj = string.IsNullOrWhiteSpace(voice)
            ? new { languageCode = "sw-KE", ssmlGender = "FEMALE" }
            : new { languageCode = "sw-KE", name = voice };

        var payload = new
        {
            input = new { text },
            voice = voiceObj,
            audioConfig = new { audioEncoding = "MP3", speakingRate = ParseRate(rate) }
        };

        using var resp = await client.PostAsync(url,
            new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"), ct);

        if (!resp.IsSuccessStatusCode)
        {
            _log.LogWarning("Google TTS returned {Status}: {Body}", (int)resp.StatusCode, await resp.Content.ReadAsStringAsync(ct));
            return null;
        }

        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
        if (doc.RootElement.TryGetProperty("audioContent", out var audioEl))
            return Convert.FromBase64String(audioEl.GetString() ?? "");
        return null;
    }

    // Knowlez TTS — a simple "X-API-Key + {text} -> MP3" HTTP service.
    private async Task<byte[]?> SynthesizeKnowlezAsync(string text, CancellationToken ct)
    {
        var key = _config["Tts:Knowlez:ApiKey"];
        var endpoint = _config["Tts:Knowlez:Endpoint"];
        if (string.IsNullOrWhiteSpace(endpoint))
            endpoint = "https://api-tts.knowlez.com/v1/tts/synthesise";
        var langCode = _config["Tts:Knowlez:LanguageCode"]; // optional; omitted by default for reliability

        object bodyObj = string.IsNullOrWhiteSpace(langCode)
            ? new { text }
            : new { text, languageCode = langCode };

        var client = _http.CreateClient();
        var req = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = new StringContent(JsonSerializer.Serialize(bodyObj), Encoding.UTF8, "application/json")
        };
        req.Headers.Add("X-API-Key", key);

        using var resp = await client.SendAsync(req, ct);
        if (!resp.IsSuccessStatusCode)
        {
            _log.LogWarning("Knowlez TTS returned {Status}: {Body}", (int)resp.StatusCode, await resp.Content.ReadAsStringAsync(ct));
            return null;
        }
        return await resp.Content.ReadAsByteArrayAsync(ct);
    }

    private async Task<byte[]?> SynthesizeAzureAsync(string text, string voice, string rate, CancellationToken ct)
    {
        var key = _config["Tts:Azure:Key"];
        var region = _config["Tts:Azure:Region"];
        var voiceName = string.IsNullOrWhiteSpace(voice) ? "sw-KE-ZuriNeural" : voice;
        var ratePct = $"{(int)Math.Round((ParseRate(rate) - 1.0) * 100)}%"; // e.g. 0.85 -> -15%

        var ssml =
            $"<speak version='1.0' xml:lang='sw-KE'>" +
            $"<voice xml:lang='sw-KE' name='{voiceName}'>" +
            $"<prosody rate='{ratePct}'>{System.Security.SecurityElement.Escape(text)}</prosody>" +
            $"</voice></speak>";

        var client = _http.CreateClient();
        var req = new HttpRequestMessage(HttpMethod.Post,
            $"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1")
        {
            Content = new StringContent(ssml, Encoding.UTF8, "application/ssml+xml")
        };
        req.Headers.Add("Ocp-Apim-Subscription-Key", key);
        req.Headers.Add("X-Microsoft-OutputFormat", "audio-24khz-48kbitrate-mono-mp3");
        req.Headers.Add("User-Agent", "PolePole");

        using var resp = await client.SendAsync(req, ct);
        if (!resp.IsSuccessStatusCode)
        {
            _log.LogWarning("Azure TTS returned {Status}: {Body}", (int)resp.StatusCode, await resp.Content.ReadAsStringAsync(ct));
            return null;
        }
        return await resp.Content.ReadAsByteArrayAsync(ct);
    }

    private static double ParseRate(string rate) =>
        double.TryParse(rate, System.Globalization.CultureInfo.InvariantCulture, out var r)
            ? Math.Clamp(r, 0.5, 1.5) : 0.85;

    private static string Hash(string s)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(s));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
