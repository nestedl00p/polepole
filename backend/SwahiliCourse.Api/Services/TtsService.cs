using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace SwahiliCourse.Api.Services;

// Synthesizes speech via a cloud TTS provider (Google or Azure) or the
// self-hosted sidecar (tts-service/, for Kinyarwanda) and caches the resulting
// clip on disk so each distinct word is only ever paid for and generated once.
// If no provider/key is configured the service returns null, and the frontend
// falls back to the browser/device built-in voice.
//
// Tts:Provider is the provider for every course; Tts:Providers:<courseId>
// overrides it for one course, which is how Kinyarwanda uses the sidecar while
// Swahili and English stay on a cloud voice.
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

    // The default provider's state — what the backoffice reports.
    public bool IsConfigured => HasCredentials(Provider);

    private bool HasCredentials(string provider) => provider switch
    {
        "Google" => !string.IsNullOrWhiteSpace(_config["Tts:Google:ApiKey"]),
        "Azure" => !string.IsNullOrWhiteSpace(_config["Tts:Azure:Key"]) && !string.IsNullOrWhiteSpace(_config["Tts:Azure:Region"]),
        "Knowlez" => !string.IsNullOrWhiteSpace(_config["Tts:Knowlez:ApiKey"]),
        "Sidecar" => !string.IsNullOrWhiteSpace(_config["Tts:Sidecar:Url"]),
        "Mock" => true, // local demo/test tone — no key needed
        _ => false
    };

    private string? OwnProvider(Models.Course course)
    {
        var p = _config[$"Tts:Providers:{course.Id}"]?.Trim();
        return string.IsNullOrEmpty(p) ? null : p;
    }

    public string ProviderFor(Models.Course course) => OwnProvider(course) ?? Provider;

    // Can this course's text be synthesized? A NeedsOwnVoice course never uses
    // the default provider: an Azure Swahili voice reading Kinyarwanda is worse
    // than silence.
    public bool IsConfiguredFor(Models.Course course) =>
        course.NeedsOwnVoice
            ? OwnProvider(course) is string own && HasCredentials(own)
            : HasCredentials(ProviderFor(course));

    public bool UsesSidecar(Models.Course course) => ProviderFor(course) == "Sidecar";

    // Run once at startup: a NeedsOwnVoice course has audio exactly when a
    // provider is configured for it. Configuration only changes with a
    // restart, so the answer is stored on the course, where every DTO that
    // describes the course already reads it.
    public void ApplyAudioAvailability()
    {
        foreach (var course in Models.Courses.All.Where(c => c.NeedsOwnVoice))
        {
            course.HasAudio = IsConfiguredFor(course);
            _log.LogInformation("Course '{Course}': audio {State} (provider {Provider}).",
                course.Id, course.HasAudio ? "on" : "off", OwnProvider(course) ?? "none");
        }
    }

    public record TtsResult(byte[] Bytes, string ContentType, string Ext);

    // Clips on disk, for the backoffice.
    public (int Files, long Bytes) CacheUsage()
    {
        var files = new DirectoryInfo(_cacheDir).GetFiles();
        return (files.Length, files.Sum(f => f.Length));
    }

    // Drops every cached clip. They regenerate on next play — which is paid
    // for again when a cloud provider is configured, so this is for after a
    // voice or rate change, not routine housekeeping.
    public int ClearCache()
    {
        var removed = 0;
        foreach (var file in new DirectoryInfo(_cacheDir).GetFiles())
        {
            try { file.Delete(); removed++; }
            catch (IOException ex) { _log.LogWarning(ex, "Could not delete cached clip {File}.", file.Name); }
        }
        return removed;
    }

    // The voice for a course's target language. Override per course with
    // Tts:Voices:<courseId>; the legacy global Tts:Voice still applies to the
    // default (Swahili) course so existing configs keep working.
    private string VoiceFor(Models.Course course)
    {
        var perCourse = _config[$"Tts:Voices:{course.Id}"];
        if (!string.IsNullOrWhiteSpace(perCourse)) return perCourse;

        if (course.Id == Models.Courses.Default)
        {
            // Legacy behaviour for the original course: return the raw Tts:Voice
            // config value (usually empty) and let the provider apply its own
            // default. Keeps cache keys identical to clips generated before
            // courses existed, so the on-disk cache stays valid.
            return _config["Tts:Voice"] ?? "";
        }
        return course.TtsVoice;
    }

    // Returns synthesized audio for the given text, or null if TTS isn't configured / fails.
    // The course determines which language/voice the text is spoken in.
    // cache:false is for one-off sentences (conversation replies) that will never
    // be asked for again — synthesized, returned, and not kept on disk.
    public async Task<TtsResult?> SynthesizeAsync(string text, Models.Course? course = null, CancellationToken ct = default, bool cache = true)
    {
        course ??= Models.Courses.Get(Models.Courses.Default);
        if (!IsConfiguredFor(course)) return null;

        var provider = ProviderFor(course);
        var voice = VoiceFor(course);
        var locale = course.TtsLocale;
        var rate = _config["Tts:Rate"] ?? "0.85";
        var ext = provider is "Mock" or "Sidecar" ? "wav" : "mp3";
        var contentType = ext == "wav" ? "audio/wav" : "audio/mpeg";
        // The voice already determines the locale (sw-KE-ZuriNeural vs
        // en-US-JennyNeural), so it isn't part of the key — keeping the key
        // format stable preserves clips cached before courses existed.
        var cacheKey = Hash($"{provider}|{voice}|{rate}|{text}");
        var cachePath = Path.Combine(_cacheDir, cacheKey + "." + ext);

        if (File.Exists(cachePath))
            return new TtsResult(await File.ReadAllBytesAsync(cachePath, ct), contentType, ext);

        await _gate.WaitAsync(ct);
        try
        {
            // Re-check after acquiring the gate (another request may have filled it).
            if (File.Exists(cachePath))
                return new TtsResult(await File.ReadAllBytesAsync(cachePath, ct), contentType, ext);

            byte[]? bytes = provider switch
            {
                "Google" => await SynthesizeGoogleAsync(text, voice, locale, rate, ct),
                "Azure" => await SynthesizeAzureAsync(text, voice, locale, rate, ct),
                "Knowlez" => await SynthesizeKnowlezAsync(text, ct),
                "Sidecar" => await SynthesizeSidecarAsync(text, rate, ct),
                "Mock" => MockTone(text),
                _ => null
            };

            if (bytes is { Length: > 0 })
            {
                if (cache) await File.WriteAllBytesAsync(cachePath, bytes, ct);
                return new TtsResult(bytes, contentType, ext);
            }
            return null;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "TTS synthesis failed for \"{Text}\" via {Provider}", text, provider);
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

    private async Task<byte[]?> SynthesizeGoogleAsync(string text, string voice, string locale, string rate, CancellationToken ct)
    {
        var key = _config["Tts:Google:ApiKey"];
        var client = _http.CreateClient();
        var url = $"https://texttospeech.googleapis.com/v1/text:synthesize?key={key}";

        object voiceObj = string.IsNullOrWhiteSpace(voice)
            ? new { languageCode = locale, ssmlGender = "FEMALE" }
            : new { languageCode = locale, name = voice };

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

    // The self-hosted sidecar (tts-service/): POST {text, rate} -> WAV. It
    // scales to zero, so the first call after an idle spell waits for a
    // container to boot and load the voice — hence the long timeout.
    private async Task<byte[]?> SynthesizeSidecarAsync(string text, string rate, CancellationToken ct)
    {
        var client = _http.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(Math.Clamp(_config.GetValue("Tts:Sidecar:TimeoutSeconds", 120), 5, 600));

        var req = new HttpRequestMessage(HttpMethod.Post, SidecarUrl("synthesize"))
        {
            Content = new StringContent(
                JsonSerializer.Serialize(new { text, rate = ParseRate(rate) }), Encoding.UTF8, "application/json")
        };
        var key = _config["Tts:Sidecar:ApiKey"];
        if (!string.IsNullOrWhiteSpace(key)) req.Headers.Add("X-Api-Key", key);

        using var resp = await client.SendAsync(req, ct);
        if (!resp.IsSuccessStatusCode)
        {
            _log.LogWarning("TTS sidecar returned {Status}: {Body}", (int)resp.StatusCode, await resp.Content.ReadAsStringAsync(ct));
            return null;
        }
        return await resp.Content.ReadAsByteArrayAsync(ct);
    }

    private string SidecarUrl(string path) => (_config["Tts:Sidecar:Url"] ?? "").TrimEnd('/') + "/" + path;

    // Blocks until the sidecar answers /health, or the wait runs out. Used by
    // the warm-up so its first words are not lost to a cold start.
    public async Task<bool> WaitForSidecarAsync(TimeSpan patience, CancellationToken ct)
    {
        var client = _http.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(15);
        var deadline = DateTime.UtcNow + patience;
        while (DateTime.UtcNow < deadline && !ct.IsCancellationRequested)
        {
            try
            {
                using var resp = await client.GetAsync(SidecarUrl("health"), ct);
                if (resp.IsSuccessStatusCode) return true;
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
            {
                // Still booting — keep waiting.
            }
            await Task.Delay(TimeSpan.FromSeconds(5), ct);
        }
        return false;
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

    private async Task<byte[]?> SynthesizeAzureAsync(string text, string voice, string locale, string rate, CancellationToken ct)
    {
        var key = _config["Tts:Azure:Key"];
        var region = _config["Tts:Azure:Region"];
        var voiceName = string.IsNullOrWhiteSpace(voice) ? "sw-KE-ZuriNeural" : voice;
        var ratePct = $"{(int)Math.Round((ParseRate(rate) - 1.0) * 100)}%"; // e.g. 0.85 -> -15%

        var ssml =
            $"<speak version='1.0' xml:lang='{locale}'>" +
            $"<voice xml:lang='{locale}' name='{voiceName}'>" +
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
