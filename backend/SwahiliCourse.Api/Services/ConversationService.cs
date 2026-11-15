using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using Anthropic;
using Anthropic.Exceptions;
using Anthropic.Models.Messages;
using SwahiliCourse.Api.Models;

namespace SwahiliCourse.Api.Services;

// The "brain" of conversation practice. Whisper (SpeechService) turns the
// learner's speech into text and TtsService speaks the answer; this decides
// what the role-play partner says back, and whether the learner's line
// deserves a correction.
//
// One Claude call per learner turn, stateless: the client holds the transcript
// and sends it with each turn, so nothing is stored. The scenario itself always
// comes from the lesson catalog, never from the client.
//
// Optional. It answers only when it is switched on (Conversation:Enabled, or
// the backoffice switch that overrides it) and an API key is configured;
// otherwise the lesson block tells the learner the partner is unavailable.
public class ConversationService
{
    private readonly IConfiguration _config;
    private readonly ILogger<ConversationService> _log;
    private readonly Lazy<AnthropicClient> _client;

    public ConversationService(IConfiguration config, ILogger<ConversationService> log)
    {
        _config = config; _log = log;
        _client = new Lazy<AnthropicClient>(() => new AnthropicClient
        {
            ApiKey = ApiKey,
            // A learner is waiting with a spinner; a slow answer is worse than none.
            Timeout = TimeSpan.FromSeconds(30),
            MaxRetries = 1,
        });
    }

    private string? ApiKey
    {
        get
        {
            var key = _config["Conversation:ApiKey"];
            if (string.IsNullOrWhiteSpace(key)) key = Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY");
            return string.IsNullOrWhiteSpace(key) ? null : key.Trim();
        }
    }

    public bool ApiKeySet => ApiKey is not null;

    // ---- the on/off switch ----
    // Conversation:Enabled is the default. An admin can override it from the
    // backoffice (System page); that choice is stored in ServiceSettings, read
    // once at startup and kept here so each request doesn't cost a query. Null
    // means no admin has touched the switch.
    private volatile object? _adminSwitch; // boxed bool, or null

    public bool? AdminSwitch => (bool?)_adminSwitch;
    public void SetAdminSwitch(bool? on) => _adminSwitch = on;

    public bool SwitchedOn => AdminSwitch ?? _config.GetValue("Conversation:Enabled", false);

    // On, and able to answer: the switch alone is not enough without a key.
    public bool IsConfigured => SwitchedOn && ApiKeySet;

    public string Model => _config["Conversation:Model"] is { Length: > 0 } m ? m.Trim() : "claude-sonnet-5-5";

    // Learner turns in one role-play. Short on purpose: a beginner runs out of
    // things to say, and it bounds what one conversation can cost.
    public int MaxTurns => Math.Clamp(_config.GetValue("Conversation:MaxTurns", 8), 2, 20);

    // ---- per-account daily allowance ----
    // Every turn is a paid model call, so each account gets a daily budget.
    // Kept in memory: a restart hands everyone a fresh day, which is an
    // acceptable leak for a single small instance and saves a table.
    public int DailyTurnLimit => Math.Max(1, _config.GetValue("Conversation:DailyTurnLimit", 40));
    private readonly ConcurrentDictionary<int, (DateOnly Day, int Used)> _usage = new();
    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    public int TurnsLeft(int userId) =>
        _usage.TryGetValue(userId, out var u) && u.Day == Today ? Math.Max(0, DailyTurnLimit - u.Used) : DailyTurnLimit;

    public bool TrySpendTurn(int userId)
    {
        var spent = false;
        _usage.AddOrUpdate(userId,
            _ => { spent = true; return (Today, 1); },
            (_, u) =>
            {
                var used = u.Day == Today ? u.Used : 0;
                spent = used < DailyTurnLimit;
                return (Today, spent ? used + 1 : used);
            });
        return spent;
    }

    // Hands a turn back when the model call failed — the learner got nothing for it.
    public void RefundTurn(int userId) =>
        _usage.AddOrUpdate(userId, _ => (Today, 0), (_, u) => (u.Day, Math.Max(0, u.Used - 1)));

    // ---- the model call ----

    // One line of the role-play so far. Role is "partner" or "learner".
    public record Turn(string Role, string Text);

    public record Reply(
        string Text,         // what the partner says, in the language being learned
        string Translation,  // the same, in the language the lessons are written in
        string Feedback,     // one short correction for the learner, or ""
        bool Done);          // the role-play has reached its end

    private static readonly IReadOnlyDictionary<string, JsonElement> ReplySchema =
        new Dictionary<string, JsonElement>
        {
            ["type"] = JsonSerializer.SerializeToElement("object"),
            ["properties"] = JsonSerializer.SerializeToElement(new
            {
                reply = new { type = "string" },
                translation = new { type = "string" },
                feedback = new { type = "string" },
                done = new { type = "boolean" },
            }),
            ["required"] = JsonSerializer.SerializeToElement(new[] { "reply", "translation", "feedback", "done" }),
            ["additionalProperties"] = JsonSerializer.SerializeToElement(false),
        };

    // Returns the partner's next line, or null when the model could not be
    // reached or declined — the caller reports the partner as unavailable.
    public async Task<Reply?> ReplyAsync(
        Course course, Lesson lesson, IEnumerable<string> knownWords, ConversationScenario scenario,
        IReadOnlyList<Turn> history, string learnerLine, bool lastTurn, CancellationToken ct)
    {
        if (!IsConfigured) return null;

        try
        {
            var response = await _client.Value.Messages.Create(new MessageCreateParams
            {
                Model = Model,
                // Room for the reply plus whatever brief thinking the model does first.
                MaxTokens = 4096,
                System = SystemPrompt(course, lesson, knownWords, scenario),
                // The reply is a sentence or two that a learner is waiting on, so
                // effort is low. Thinking is left at the model's default: Sonnet
                // 5.5 rejects a request that disables it, and at low effort it
                // thinks briefly if at all. Haiku does accept "disabled", and
                // there it saves a little time.
                Thinking = Model.StartsWith("claude-haiku", StringComparison.OrdinalIgnoreCase)
                    ? (ThinkingConfigParam?)new ThinkingConfigDisabled()
                    : null,
                OutputConfig = new OutputConfig
                {
                    Effort = Effort.Low,
                    Format = new JsonOutputFormat { Schema = ReplySchema },
                },
                Messages = [new UserMessageParam { Content = TurnPrompt(scenario, history, learnerLine, lastTurn) }],
            }, cancellationToken: ct);

            if (response.StopReason == "refusal" || response.StopReason == "max_tokens")
            {
                _log.LogWarning("Conversation reply stopped early ({Reason}) on lesson {Lesson}.",
                    response.StopReason, lesson.Id);
                return null;
            }

            var json = string.Concat(response.Content.Select(b => b.Value).OfType<TextBlock>().Select(t => t.Text));
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var text = root.GetProperty("reply").GetString()?.Trim() ?? "";
            if (text.Length == 0) return null;

            return new Reply(
                text,
                root.GetProperty("translation").GetString()?.Trim() ?? "",
                root.GetProperty("feedback").GetString()?.Trim() ?? "",
                root.GetProperty("done").GetBoolean());
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw; // the learner navigated away — not a failure worth logging
        }
        catch (AnthropicRateLimitException ex)
        {
            _log.LogWarning(ex, "Conversation model is rate limited.");
            return null;
        }
        catch (AnthropicApiException ex)
        {
            // Bad key, unknown model, malformed request: configuration, not weather.
            _log.LogError(ex, "Conversation model rejected the request (model {Model}).", Model);
            return null;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Conversation model call failed.");
            return null;
        }
    }

    private static string LanguageName(string code) => code == "sw" ? "Swahili" : "English";

    private static string SystemPrompt(
        Course course, Lesson lesson, IEnumerable<string> knownWords, ConversationScenario s)
    {
        var target = LanguageName(course.TargetLanguage);
        var source = LanguageName(course.SourceLanguage);

        return $"""
            You are the conversation partner in a spoken role-play inside PolePole, an app that teaches {target} to {source} speakers. The learner is a beginner who has reached lesson {lesson.Id} of the course ("{lesson.Title}"). They speak into a microphone, their speech is transcribed automatically, and your reply is read aloud to them by a text-to-speech voice. This is often the first time they have used {target} with anyone, so the aim is for them to come away feeling they managed a real exchange.

            Your character: {s.Role}
            The scene, as it was described to the learner: {s.Setting}
            What the learner is trying to do: {s.Goal}

            How to play it:
            - `reply` is your next line, in character, in {target} only. Keep it to one or two short sentences, because the learner has to follow it by ear, and leave them an easy next thing to say — usually a simple question that moves them toward their goal.
            - Stay within what a learner at this point can understand. The words they have met so far are listed at the end; prefer those, and when you need a word outside the list, choose a very common one.
            - The learner's lines come from speech recognition, which misspells short {target} words and drops punctuation. Read them charitably: when a word is a letter or two away from one that fits the conversation, take it that they said the right word. Never comment on spelling, capitals or punctuation.
            - If a line is in {source}, or you cannot tell what they meant, stay in character and say your previous line again in simpler words so they can try once more.
            - `translation` is your reply in {source}, for the learner to check their understanding.
            - `feedback` is a note to the learner in {source}, outside the role-play. Use it only when they made a real mistake in word choice or grammar, or when there is a clearly more natural way to say what they meant: one short, kind sentence that shows the better phrasing. When their line was fine, return an empty string; most turns need no note, and praise is not needed.
            - Set `done` to true when the learner has done what they set out to do and the exchange has come to a natural close, or when you are told this is the final turn. Make that reply a goodbye in character, with no further question.

            Words the learner has met so far: {string.Join(", ", knownWords)}
            """;
    }

    private static string TurnPrompt(
        ConversationScenario s, IReadOnlyList<Turn> history, string learnerLine, bool lastTurn)
    {
        var sb = new StringBuilder();
        sb.AppendLine("The role-play so far:");
        sb.AppendLine($"You: {s.Opening}");
        foreach (var t in history)
            sb.AppendLine($"{(t.Role == "learner" ? "Learner" : "You")}: {t.Text}");
        sb.AppendLine();
        sb.AppendLine("The learner's new line, as transcribed:");
        sb.AppendLine(learnerLine);
        if (lastTurn)
        {
            sb.AppendLine();
            sb.AppendLine("This is the final turn of the session: answer them and close the conversation.");
        }
        return sb.ToString();
    }
}
