using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace SwahiliCourse.Api.Services;

// Speech-to-text pronunciation scoring. Sends recorded learner audio to Whisper
// for transcription, then scores the transcription against the target phrase:
//   • word match (ordered)  — did they say the right words, in order?
//   • completeness          — how many target words were spoken at all?
//   • confidence            — Whisper's average per-word probability
//   • words-per-minute      — rough fluency from word timestamps
//
// Whisper runs in one of two places, chosen by Speech:Provider:
//   • Sidecar (default) — the self-hosted faster-whisper service in
//     whisper-service/. No third party, but ~5 s per clip on one vCPU and a
//     ~25 s cold start when it has scaled to zero.
//   • Groq — Groq's hosted Whisper large-v3 (OpenAI-compatible API). Measured
//     ~0.25 s per clip and noticeably better on Swahili phrases, but learner
//     audio leaves our infrastructure and it needs Speech:Groq:ApiKey. If a
//     Groq call fails, the sidecar is tried as a fallback.
//
// Speech is optional. When Speech:Enabled is false (or the chosen provider is
// missing its settings) IsConfigured is false and the frontend hides the
// speak-and-check UI (still offering the 🔊 model pronunciation).
public class SpeechService
{
    private readonly IHttpClientFactory _http;
    private readonly IConfiguration _config;
    private readonly ILogger<SpeechService> _log;

    public SpeechService(IHttpClientFactory http, IConfiguration config, ILogger<SpeechService> log)
    {
        _http = http; _config = config; _log = log;
    }

    public bool IsConfigured =>
        _config.GetValue("Speech:Enabled", false)
        && (UsesGroq ? GroqApiKey is not null : !string.IsNullOrWhiteSpace(WhisperUrl));

    // "Sidecar" or "Groq" — what is actually in use, for the backoffice.
    public string Provider => UsesGroq ? "Groq" : "Sidecar";

    private bool UsesGroq =>
        string.Equals(_config["Speech:Provider"]?.Trim(), "Groq", StringComparison.OrdinalIgnoreCase);

    private string WhisperUrl => (_config["Speech:WhisperUrl"] ?? "http://localhost:8081").TrimEnd('/');

    // --- Groq (hosted Whisper) settings ---

    // Speech:Groq:ApiKey, or the conventional GROQ_API_KEY environment variable.
    private string? GroqApiKey
    {
        get
        {
            var key = _config["Speech:Groq:ApiKey"];
            if (string.IsNullOrWhiteSpace(key)) key = Environment.GetEnvironmentVariable("GROQ_API_KEY");
            return string.IsNullOrWhiteSpace(key) ? null : key.Trim();
        }
    }

    public bool GroqApiKeySet => GroqApiKey is not null;

    private string GroqBaseUrl =>
        (_config["Speech:Groq:BaseUrl"] is { Length: > 0 } u ? u : "https://api.groq.com/openai/v1").TrimEnd('/');

    // whisper-large-v3 by default. whisper-large-v3-turbo is cheaper and scored
    // the same on our Swahili test clips, but it reports no_speech_prob as 0 for
    // everything, so the silence filter in ParseVerboseJson cannot work with it.
    public string GroqModel =>
        _config["Speech:Groq:Model"] is { Length: > 0 } m ? m.Trim() : "whisper-large-v3";

    // A hosted call that has not answered in this long is treated as failed,
    // which leaves time to try the sidecar before the learner gives up.
    private TimeSpan GroqTimeout =>
        TimeSpan.FromSeconds(Math.Clamp(_config.GetValue("Speech:Groq:TimeoutSeconds", 20), 2, 120));

    // Whether a failed Groq call may be retried on the self-hosted sidecar.
    private bool FallbackToSidecar => _config.GetValue("Speech:Groq:FallbackToSidecar", true);

    // How long one transcription may take. Generous on purpose: a sidecar that
    // scales to zero needs ~25 s to boot and load the model before it can even
    // start on the first clip after an idle spell (measured 29.9 s end to end).
    private TimeSpan Timeout =>
        TimeSpan.FromSeconds(Math.Clamp(_config.GetValue("Speech:TimeoutSeconds", 90), 5, 200));

    private long _lastWarmUpTicks; // Environment.TickCount64 of the last ping; 0 = never

    // Fire-and-forget ping that wakes a scaled-to-zero sidecar. Called when a
    // client asks for speech status — i.e. when a drill appears on screen — so
    // the replica boots while the learner is still listening to the model
    // phrase, not after they have recorded. Throttled; never throws.
    public void WarmUp()
    {
        // A hosted provider has no cold start, so there is nothing to wake.
        if (!IsConfigured || UsesGroq) return;

        var now = Environment.TickCount64;
        var last = Interlocked.Read(ref _lastWarmUpTicks);
        if (last != 0 && now - last < 60_000) return;
        if (Interlocked.CompareExchange(ref _lastWarmUpTicks, now, last) != last) return;

        _ = Task.Run(async () =>
        {
            try
            {
                var client = _http.CreateClient();
                client.Timeout = Timeout;
                using var resp = await client.GetAsync($"{WhisperUrl}/health");
            }
            catch (Exception ex)
            {
                _log.LogDebug(ex, "Whisper warm-up ping to {Url} failed.", WhisperUrl);
            }
        });
    }

    // Host of the speech provider in use, without path or credentials — safe
    // to show an admin.
    public string? Host =>
        Uri.TryCreate(UsesGroq ? GroqBaseUrl : WhisperUrl, UriKind.Absolute, out var uri) ? uri.Authority : null;

    // A live check for the backoffice. Short timeout on purpose: a sidecar
    // that has scaled to zero will miss it, and the caller says so rather
    // than holding the page for the half minute a cold start takes.
    public async Task<(bool Reachable, string Detail, long Milliseconds)> PingAsync(CancellationToken ct)
    {
        if (!IsConfigured) return (false, "Speech scoring is not enabled.", 0);

        var started = Environment.TickCount64;
        try
        {
            var client = _http.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(6);

            if (UsesGroq)
            {
                // Listing models costs nothing and proves both reachability and
                // that the API key is accepted.
                using var req = new HttpRequestMessage(HttpMethod.Get, $"{GroqBaseUrl}/models");
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", GroqApiKey);
                using var groq = await client.SendAsync(req, ct);
                var groqMs = Environment.TickCount64 - started;
                return groq.IsSuccessStatusCode
                    ? (true, $"Groq accepted the API key (model {GroqModel}).", groqMs)
                    : ((int)groq.StatusCode is 401 or 403)
                        ? (false, "Groq rejected the API key.", groqMs)
                        : (false, $"Groq answered {(int)groq.StatusCode}.", groqMs);
            }

            using var resp = await client.GetAsync($"{WhisperUrl}/health", ct);
            var ms = Environment.TickCount64 - started;
            return resp.IsSuccessStatusCode
                ? (true, "Sidecar answered its health check.", ms)
                : (false, $"Sidecar answered {(int)resp.StatusCode}.", ms);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            return (false,
                UsesGroq
                    ? "No answer from Groq within 6 seconds."
                    : "No answer within 6 seconds. If the sidecar scales to zero this is normal when idle — it is waking now; try again in half a minute.",
                Environment.TickCount64 - started);
        }
    }

    // Whisper language code for the course's target language (what the learner
    // is speaking). Speech:Language still overrides globally if set.
    private string LanguageFor(Models.Course? course) =>
        _config["Speech:Language"] ?? course?.SttLanguage ?? "sw";

    public record WordScore(string Word, bool Ok);
    public record AssessResult(
        string Transcription,
        int Score,          // ordered word match, 0..100
        int Completeness,   // unordered coverage of target words, 0..100
        double? Confidence, // avg Whisper word probability, 0..100
        double? Wpm,        // words per minute, if timing available
        List<WordScore> Words,
        string ReferenceText);

    // Transcribes the audio with the configured provider and scores it against referenceText.
    // Returns null if speech scoring isn't configured or no provider could be reached.
    public async Task<AssessResult?> AssessAsync(
        Stream audio, string? contentType, string? fileName, string referenceText,
        Models.Course? course = null, CancellationToken ct = default)
    {
        if (!IsConfigured) return null;

        var transcription = await TranscribeAsync(audio, contentType, fileName, LanguageFor(course), ct);
        if (transcription is null) return null;

        var refTokens = Tokens(referenceText);
        var hypTokens = Tokens(transcription.Text);

        var (lcs, refOk) = AlignLcs(refTokens, hypTokens);
        int score = refTokens.Length == 0 ? 0 : (int)Math.Round(100.0 * lcs / refTokens.Length);
        int completeness = refTokens.Length == 0 ? 0 : (int)Math.Round(100.0 * Coverage(refTokens, hypTokens) / refTokens.Length);

        double? confidence = transcription.AvgProbability is { } p ? Math.Round(p * 100, 0) : null;
        double? wpm = (transcription.Duration is { } d && d > 0.2 && hypTokens.Length > 0)
            ? Math.Round(hypTokens.Length / d * 60, 0)
            : null;

        var words = new List<WordScore>(refTokens.Length);
        for (int i = 0; i < refTokens.Length; i++)
            words.Add(new WordScore(refTokens[i], refOk[i]));

        return new AssessResult(transcription.Text, score, completeness, confidence, wpm, words, referenceText.Trim());
    }

    // Plain transcription for free speech (conversation practice), where there
    // is no reference phrase to score against. `vocabularyHint` is passed to
    // Whisper as its initial prompt so expected words come back spelled the
    // expected way. Returns null when speech isn't configured or the sidecar
    // can't be reached.
    public async Task<string?> TranscribeFreeAsync(
        Stream audio, string? contentType, string? fileName,
        Models.Course? course = null, string? vocabularyHint = null, CancellationToken ct = default)
    {
        if (!IsConfigured) return null;
        var t = await TranscribeAsync(audio, contentType, fileName, LanguageFor(course), ct, vocabularyHint);
        return t?.Text;
    }

    internal sealed record Transcription(string Text, double? Duration, double? AvgProbability);

    // Transcribes with the configured provider. The audio is buffered first so
    // a failed hosted call can be retried on the sidecar with the same bytes.
    private async Task<Transcription?> TranscribeAsync(
        Stream audio, string? contentType, string? fileName, string language, CancellationToken ct,
        string? prompt = null)
    {
        byte[] bytes;
        using (var buffer = new MemoryStream())
        {
            await audio.CopyToAsync(buffer, ct);
            bytes = buffer.ToArray();
        }

        if (!UsesGroq)
            return await TranscribeViaSidecarAsync(bytes, contentType, fileName, language, prompt, ct);

        var hosted = await TranscribeViaGroqAsync(bytes, contentType, fileName, language, prompt, ct);
        if (hosted is not null || !FallbackToSidecar || ct.IsCancellationRequested) return hosted;

        _log.LogWarning("Groq transcription failed; falling back to the Whisper sidecar.");
        return await TranscribeViaSidecarAsync(bytes, contentType, fileName, language, prompt, ct);
    }

    private static MultipartFormDataContent AudioForm(byte[] bytes, string? contentType, string? fileName)
    {
        var form = new MultipartFormDataContent();
        var audioContent = new ByteArrayContent(bytes);
        audioContent.Headers.ContentType =
            MediaTypeHeaderValue.TryParse(contentType, out var parsed) ? parsed : new MediaTypeHeaderValue("application/octet-stream");
        // The extension matters: both providers pick the decoder from it.
        form.Add(audioContent, "file", string.IsNullOrWhiteSpace(fileName) ? "audio.webm" : fileName);
        return form;
    }

    // Groq's hosted Whisper, via its OpenAI-compatible transcription endpoint.
    private async Task<Transcription?> TranscribeViaGroqAsync(
        byte[] bytes, string? contentType, string? fileName, string language, string? prompt, CancellationToken ct)
    {
        try
        {
            var client = _http.CreateClient();
            client.Timeout = GroqTimeout;

            using var form = AudioForm(bytes, contentType, fileName);
            form.Add(new StringContent(GroqModel), "model");
            form.Add(new StringContent(language), "language");
            // verbose_json carries the duration and per-segment confidence.
            form.Add(new StringContent("verbose_json"), "response_format");
            form.Add(new StringContent("0"), "temperature");
            if (!string.IsNullOrWhiteSpace(prompt))
                form.Add(new StringContent(prompt), "prompt");

            using var req = new HttpRequestMessage(HttpMethod.Post, $"{GroqBaseUrl}/audio/transcriptions")
            {
                Content = form,
            };
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", GroqApiKey);

            using var resp = await client.SendAsync(req, ct);
            if (!resp.IsSuccessStatusCode)
            {
                _log.LogWarning("Groq transcribe returned {Status}: {Body}",
                    (int)resp.StatusCode, await resp.Content.ReadAsStringAsync(ct));
                return null;
            }

            using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
            return ParseVerboseJson(doc.RootElement);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Groq transcription at {Url} failed.", GroqBaseUrl);
            return null;
        }
    }

    // Reads an OpenAI-style verbose_json transcription. Unlike the sidecar there
    // is no voice-activity filter in front of the model, and Whisper invents
    // text for silence ("Kwa hivyo." is its Swahili favourite) with a perfectly
    // confident log-probability — so the only usable signal is the model's own
    // no_speech_prob. Measured on whisper-large-v3: real speech 0.00–0.04,
    // digital silence 0.70, a steady tone 0.96. Faint room noise came in at
    // 0.32 and still gets through; that is the price of not rejecting quiet
    // speakers. Confidence comes from the kept segments' average log-probability.
    private const double NoSpeechThreshold = 0.5;

    internal static Transcription ParseVerboseJson(JsonElement root)
    {
        double? duration = root.TryGetProperty("duration", out var d) && d.ValueKind == JsonValueKind.Number
            ? d.GetDouble() : null;

        if (!root.TryGetProperty("segments", out var segs) || segs.ValueKind != JsonValueKind.Array)
        {
            var whole = root.TryGetProperty("text", out var t) ? (t.GetString() ?? "") : "";
            return new Transcription(whole.Trim(), duration, null);
        }

        var text = new StringBuilder();
        double logProbSum = 0; int kept = 0;
        foreach (var seg in segs.EnumerateArray())
        {
            double? avgLogProb = seg.TryGetProperty("avg_logprob", out var lp) && lp.ValueKind == JsonValueKind.Number
                ? lp.GetDouble() : null;
            double noSpeech = seg.TryGetProperty("no_speech_prob", out var ns) && ns.ValueKind == JsonValueKind.Number
                ? ns.GetDouble() : 0;
            if (noSpeech >= NoSpeechThreshold) continue;

            var piece = seg.TryGetProperty("text", out var st) ? (st.GetString() ?? "").Trim() : "";
            if (piece.Length == 0) continue;
            if (text.Length > 0) text.Append(' ');
            text.Append(piece);
            if (avgLogProb is { } v) { logProbSum += v; kept++; }
        }

        double? avgProb = kept > 0 ? Math.Clamp(Math.Exp(logProbSum / kept), 0, 1) : null;
        return new Transcription(text.ToString(), duration, avgProb);
    }

    // The self-hosted faster-whisper sidecar (whisper-service/).
    private async Task<Transcription?> TranscribeViaSidecarAsync(
        byte[] bytes, string? contentType, string? fileName, string language, string? prompt, CancellationToken ct)
    {
        try
        {
            var client = _http.CreateClient();
            client.Timeout = Timeout;

            using var form = AudioForm(bytes, contentType, fileName);
            if (!string.IsNullOrWhiteSpace(prompt))
                form.Add(new StringContent(prompt), "prompt");

            using var req = new HttpRequestMessage(HttpMethod.Post, $"{WhisperUrl}/transcribe?lang={language}")
            {
                Content = form,
            };
            // Shared secret for a sidecar that is reachable over a network (see
            // deploy/azure-whisper-deploy.sh). Unset for a localhost sidecar.
            var apiKey = _config["Speech:ApiKey"];
            if (!string.IsNullOrWhiteSpace(apiKey))
                req.Headers.TryAddWithoutValidation("X-Api-Key", apiKey.Trim());

            using var resp = await client.SendAsync(req, ct);
            if (!resp.IsSuccessStatusCode)
            {
                _log.LogWarning("Whisper transcribe returned {Status}: {Body}",
                    (int)resp.StatusCode, await resp.Content.ReadAsStringAsync(ct));
                return null;
            }

            using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
            var root = doc.RootElement;
            var text = root.TryGetProperty("text", out var t) ? (t.GetString() ?? "") : "";
            double? duration = root.TryGetProperty("duration", out var d) && d.ValueKind == JsonValueKind.Number
                ? d.GetDouble() : null;

            double? avgProb = null;
            if (root.TryGetProperty("words", out var wsEl) && wsEl.ValueKind == JsonValueKind.Array && wsEl.GetArrayLength() > 0)
            {
                double sum = 0; int n = 0;
                foreach (var w in wsEl.EnumerateArray())
                    if (w.TryGetProperty("probability", out var pr) && pr.ValueKind == JsonValueKind.Number)
                    { sum += pr.GetDouble(); n++; }
                if (n > 0) avgProb = sum / n;
            }

            return new Transcription(text.Trim(), duration, avgProb);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Whisper sidecar at {Url} unreachable.", WhisperUrl);
            return null;
        }
    }

    // --- scoring helpers ---

    // Ordered longest-common-subsequence alignment: returns the LCS length and a
    // per-reference-token flag marking which target words the learner actually said
    // (in order). Used both for the score and the green/red word highlighting.
    private static (int lcs, bool[] refOk) AlignLcs(string[] refT, string[] hypT)
    {
        int n = refT.Length, m = hypT.Length;
        var ok = new bool[n];
        if (n == 0 || m == 0) return (0, ok);

        var dp = new int[n + 1, m + 1];
        for (int i = n - 1; i >= 0; i--)
            for (int j = m - 1; j >= 0; j--)
                dp[i, j] = Near(refT[i], hypT[j])
                    ? dp[i + 1, j + 1] + 1
                    : Math.Max(dp[i + 1, j], dp[i, j + 1]);

        int a = 0, b = 0;
        while (a < n && b < m)
        {
            if (Near(refT[a], hypT[b])) { ok[a] = true; a++; b++; }
            else if (dp[a + 1, b] >= dp[a, b + 1]) a++;
            else b++;
        }
        return (dp[0, 0], ok);
    }

    // Unordered overlap: how many target words appear anywhere in the hypothesis.
    private static int Coverage(string[] refT, string[] hypT)
    {
        var used = new bool[hypT.Length];
        int hit = 0;
        foreach (var r in refT)
            for (int j = 0; j < hypT.Length; j++)
                if (!used[j] && Near(r, hypT[j])) { used[j] = true; hit++; break; }
        return hit;
    }

    // Two words "match" if identical, or (for words of 4+ letters) within one edit.
    // This forgives Whisper's own spelling variance on isolated Swahili words
    // (e.g. asante→"asanti", jambo→"jambu") without letting genuinely different
    // words slip through. Short words (ni, na, wa) must match exactly.
    private static bool Near(string a, string b)
    {
        if (a == b) return true;
        if (Math.Max(a.Length, b.Length) < 4) return false;
        return Levenshtein(a, b) <= 1;
    }

    private static int Levenshtein(string a, string b)
    {
        var prev = new int[b.Length + 1];
        var cur = new int[b.Length + 1];
        for (int j = 0; j <= b.Length; j++) prev[j] = j;
        for (int i = 1; i <= a.Length; i++)
        {
            cur[0] = i;
            for (int j = 1; j <= b.Length; j++)
            {
                int cost = a[i - 1] == b[j - 1] ? 0 : 1;
                cur[j] = Math.Min(Math.Min(cur[j - 1] + 1, prev[j] + 1), prev[j - 1] + cost);
            }
            (prev, cur) = (cur, prev);
        }
        return prev[b.Length];
    }

    private static string[] Tokens(string s)
    {
        var sb = new StringBuilder(s.Length);
        foreach (var ch in s.ToLowerInvariant())
            sb.Append(char.IsLetterOrDigit(ch) ? ch : ' ');
        return sb.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries);
    }
}
