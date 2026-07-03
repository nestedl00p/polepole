using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace SwahiliCourse.Api.Services;

// Speech-to-text pronunciation scoring. Forwards recorded learner audio to a
// self-hosted Whisper sidecar (faster-whisper) for transcription, then scores
// the transcription against the target phrase:
//   • word match (ordered)  — did they say the right words, in order?
//   • completeness          — how many target words were spoken at all?
//   • confidence            — Whisper's average per-word probability
//   • words-per-minute      — rough fluency from word timestamps
//
// The Whisper service is optional/self-hosted. When it isn't reachable or
// Speech:Enabled is false, IsConfigured is false and the frontend hides the
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
        _config.GetValue("Speech:Enabled", false) && !string.IsNullOrWhiteSpace(WhisperUrl);

    private string WhisperUrl => (_config["Speech:WhisperUrl"] ?? "http://localhost:8081").TrimEnd('/');
    private string Language => _config["Speech:Language"] ?? "sw";

    public record WordScore(string Word, bool Ok);
    public record AssessResult(
        string Transcription,
        int Score,          // ordered word match, 0..100
        int Completeness,   // unordered coverage of target words, 0..100
        double? Confidence, // avg Whisper word probability, 0..100
        double? Wpm,        // words per minute, if timing available
        List<WordScore> Words,
        string ReferenceText);

    // Transcribes the audio via the Whisper sidecar and scores it against referenceText.
    // Returns null if speech scoring isn't configured or the sidecar can't be reached.
    public async Task<AssessResult?> AssessAsync(
        Stream audio, string? contentType, string? fileName, string referenceText, CancellationToken ct = default)
    {
        if (!IsConfigured) return null;

        var transcription = await TranscribeAsync(audio, contentType, fileName, ct);
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

    private sealed record Transcription(string Text, double? Duration, double? AvgProbability);

    private async Task<Transcription?> TranscribeAsync(Stream audio, string? contentType, string? fileName, CancellationToken ct)
    {
        try
        {
            var client = _http.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(30);

            using var form = new MultipartFormDataContent();
            var audioContent = new StreamContent(audio);
            audioContent.Headers.ContentType =
                MediaTypeHeaderValue.Parse(string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType);
            form.Add(audioContent, "file", string.IsNullOrWhiteSpace(fileName) ? "audio.webm" : fileName);

            using var resp = await client.PostAsync($"{WhisperUrl}/transcribe?lang={Language}", form, ct);
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
