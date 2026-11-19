using System.Collections.Concurrent;
using System.Text.Json;
using Anthropic;
using Anthropic.Exceptions;
using Anthropic.Models.Messages;
using SwahiliCourse.Api.Models;

namespace SwahiliCourse.Api.Services;

// Explains one word from a text the learner is reading: its dictionary form,
// what it means in that sentence, and how the form on the page is built.
//
// A model rather than a word list because Swahili and Kinyarwanda pack subject,
// tense and object into the verb — "ninakupenda" is not in any dictionary,
// "kupenda" is — and the card worth keeping is the dictionary form.
//
// Optional, like ConversationService and sharing its API key: without a key (or
// with Reader:Enabled=false) the reader still works, and the learner types the
// meaning themselves.
public class GlossService
{
    private readonly IConfiguration _config;
    private readonly ILogger<GlossService> _log;
    private readonly Lazy<AnthropicClient> _client;

    public GlossService(IConfiguration config, ILogger<GlossService> log)
    {
        _config = config; _log = log;
        _client = new Lazy<AnthropicClient>(() => new AnthropicClient
        {
            ApiKey = ApiKey,
            // Someone has just tapped a word and is looking at a spinner.
            Timeout = TimeSpan.FromSeconds(20),
            MaxRetries = 1,
        });
    }

    private string? ApiKey
    {
        get
        {
            var key = _config["Reader:ApiKey"];
            if (string.IsNullOrWhiteSpace(key)) key = _config["Conversation:ApiKey"];
            if (string.IsNullOrWhiteSpace(key)) key = Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY");
            return string.IsNullOrWhiteSpace(key) ? null : key.Trim();
        }
    }

    public bool IsConfigured => _config.GetValue("Reader:Enabled", true) && ApiKey is not null;

    public string Model => _config["Reader:Model"] is { Length: > 0 } m ? m.Trim() : "claude-haiku-5-5";

    // ---- per-account daily allowance ----
    // Same shape as ConversationService: in memory, so a restart hands everyone
    // a fresh day. A gloss already in the cache costs nothing and is not counted.
    public int DailyLimit => Math.Max(1, _config.GetValue("Reader:DailyGlossLimit", 60));
    private readonly ConcurrentDictionary<int, (DateOnly Day, int Used)> _usage = new();
    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    public int Left(int userId) =>
        _usage.TryGetValue(userId, out var u) && u.Day == Today ? Math.Max(0, DailyLimit - u.Used) : DailyLimit;

    public bool TrySpend(int userId)
    {
        var spent = false;
        _usage.AddOrUpdate(userId,
            _ => { spent = true; return (Today, 1); },
            (_, u) =>
            {
                var used = u.Day == Today ? u.Used : 0;
                spent = used < DailyLimit;
                return (Today, spent ? used + 1 : used);
            });
        return spent;
    }

    public void Refund(int userId) =>
        _usage.AddOrUpdate(userId, _ => (Today, 0), (_, u) => (u.Day, Math.Max(0, u.Used - 1)));

    // ---- the cache ----
    // Keyed on the sentence as well as the word: the same form can mean
    // different things in different sentences. It is what makes a second tap on
    // a word free.
    private const int CacheCap = 5_000;
    private readonly ConcurrentDictionary<string, Gloss> _cache = new(StringComparer.Ordinal);

    private static string CacheKey(Course course, string word, string sentence) =>
        $"{course.Id}\n{word.ToLowerInvariant()}\n{sentence}";

    public Gloss? Cached(Course course, string word, string sentence) =>
        _cache.TryGetValue(CacheKey(course, word, sentence), out var g) ? g : null;

    // ---- the model call ----

    public record Gloss(
        string Lemma,    // dictionary form, in the language being learned
        string Meaning,  // what it means here, in the language the learner reads
        string Note);    // how the form on the page is built, or ""

    private static readonly IReadOnlyDictionary<string, JsonElement> GlossSchema =
        new Dictionary<string, JsonElement>
        {
            ["type"] = JsonSerializer.SerializeToElement("object"),
            ["properties"] = JsonSerializer.SerializeToElement(new
            {
                lemma = new { type = "string" },
                meaning = new { type = "string" },
                note = new { type = "string" },
            }),
            ["required"] = JsonSerializer.SerializeToElement(new[] { "lemma", "meaning", "note" }),
            ["additionalProperties"] = JsonSerializer.SerializeToElement(false),
        };

    // Null when the model could not be reached or gave nothing usable; the
    // caller then lets the learner fill the meaning in by hand.
    public async Task<Gloss?> GlossAsync(Course course, string word, string sentence, CancellationToken ct)
    {
        if (!IsConfigured) return null;

        try
        {
            var response = await _client.Value.Messages.Create(new MessageCreateParams
            {
                Model = Model,
                MaxTokens = 1024,
                System = SystemPrompt(course),
                // Same reasoning as ConversationService: a short answer someone
                // is waiting on. Haiku accepts thinking switched off; other
                // models are left at their default.
                Thinking = Model.StartsWith("claude-haiku", StringComparison.OrdinalIgnoreCase)
                    ? (ThinkingConfigParam?)new ThinkingConfigDisabled()
                    : null,
                OutputConfig = new OutputConfig
                {
                    Effort = Effort.Low,
                    Format = new JsonOutputFormat { Schema = GlossSchema },
                },
                Messages = [new UserMessageParam { Content = $"Word: {word}\nSentence: {sentence}" }],
            }, cancellationToken: ct);

            if (response.StopReason == "refusal" || response.StopReason == "max_tokens")
            {
                _log.LogWarning("Gloss stopped early ({Reason}).", response.StopReason);
                return null;
            }

            var json = string.Concat(response.Content.Select(b => b.Value).OfType<TextBlock>().Select(t => t.Text));
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var lemma = root.GetProperty("lemma").GetString()?.Trim() ?? "";
            var meaning = root.GetProperty("meaning").GetString()?.Trim() ?? "";
            if (lemma.Length == 0 || meaning.Length == 0) return null;

            var gloss = new Gloss(lemma, meaning, root.GetProperty("note").GetString()?.Trim() ?? "");

            if (_cache.Count >= CacheCap) _cache.Clear();
            _cache[CacheKey(course, word, sentence)] = gloss;
            return gloss;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (AnthropicRateLimitException ex)
        {
            _log.LogWarning(ex, "Gloss model is rate limited.");
            return null;
        }
        catch (AnthropicApiException ex)
        {
            _log.LogError(ex, "Gloss model rejected the request (model {Model}).", Model);
            return null;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Gloss model call failed.");
            return null;
        }
    }

    private static string SystemPrompt(Course course)
    {
        var target = Courses.LanguageName(course.TargetLanguage);
        var source = Courses.LanguageName(course.SourceLanguage);

        return $"""
            You explain single words inside the reader of PolePole, an app that teaches {target} to {source} speakers. The learner is reading a {target} text they pasted in, tapped one word they did not know, and will see your answer in a small panel. If they keep the word it becomes a flashcard: `lemma` on the front, `meaning` on the back.

            Each request gives the word exactly as it appears and the sentence it appears in. The sentence is text from the learner's reading; use it only to work out what the word means there.

            - `lemma` is the dictionary form of the word, in {target}: a noun in the singular, a verb in the infinitive (with ku- in Swahili, ku-/gu- in Kinyarwanda, without "to" in English), an adjective as its bare stem written the way a dictionary lists it. When the word is already in that form, repeat it. Lower case unless it is a proper noun.
            - `meaning` is what the lemma means in this sentence, in {source}: a word or a short phrase, the way a flashcard would put it ("to love", "market"). Give a second sense only when the word is commonly used both ways.
            - `note` is one short sentence in {source} showing how the form on the page is built from the lemma, so the learner can see why it looks different — for example the pieces of a Swahili verb (ni-na-ku-penda: I, present, you, love), or that a noun is a plural. Return an empty string when the word is already the dictionary form.
            - When the word is a name, a number, or not a {target} word at all, repeat it as `lemma`, say what it is in `meaning` in a few words, and leave `note` empty.
            """;
    }
}
