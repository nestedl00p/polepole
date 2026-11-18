using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using SwahiliCourse.Api.Data;
using SwahiliCourse.Api.Models;
using SwahiliCourse.Api.Services;

namespace SwahiliCourse.Api.Controllers;

// Conversation practice: a spoken role-play with an AI partner, one turn per
// request. Each turn chains the three services —
//   learner audio → Whisper (SpeechService) → Claude (ConversationService) → TTS
// — and returns what was heard, the partner's reply and its audio together.
//
// Signed-in learners only, unlike the anonymous pronunciation drill: every
// turn is a paid model call, so it is tied to an account with a daily allowance.
[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("media")]
public class ConversationController : AuthedController
{
    private const int MaxLineLength = 300;

    private readonly AppDbContext _db;
    private readonly CourseCatalog _courses;
    private readonly PaceService _pace;
    private readonly SpeechService _speech;
    private readonly TtsService _tts;
    private readonly ConversationService _conversation;

    public ConversationController(
        AppDbContext db, CourseCatalog courses, PaceService pace,
        SpeechService speech, TtsService tts, ConversationService conversation)
    {
        _db = db; _courses = courses; _pace = pace;
        _speech = speech; _tts = tts; _conversation = conversation;
    }

    // GET /api/conversation/status — whether the partner is available, whether
    // the learner can speak (Whisper) or must type, and what is left of today's
    // allowance. Called as the block appears, so like /api/speech/status it is
    // also the cue to wake a sidecar that has scaled to zero.
    [HttpGet("status")]
    public IActionResult Status()
    {
        _speech.WarmUp();
        return Ok(new
        {
            enabled = _conversation.IsConfigured,
            speech = _speech.IsConfigured,
            turnsLeft = _conversation.TurnsLeft(CurrentUserId),
            maxTurns = _conversation.MaxTurns,
        });
    }

    // POST /api/conversation/turn  (multipart/form-data)
    //   lessonId  the lesson whose conversation block is being played
    //   file      the learner's recorded line            ┐ one of the two
    //   text      the learner's line, typed instead      ┘
    //   history   JSON [{ "role": "learner"|"partner", "text": "…" }] — the turns
    //             so far, not counting the scenario's opening line
    //
    // 200 { heard, unclear, reply, translation, feedback, done, audio, audioType, turnsLeft }
    //     unclear=true means nothing was made out of the recording: no reply, and
    //     no turn spent — the learner just tries again.
    // 429 today's allowance is used up · 503 the partner (or Whisper) is unavailable
    [HttpPost("turn")]
    [RequestSizeLimit(15_000_000)]
    public async Task<IActionResult> Turn(
        [FromForm] int lessonId, [FromForm] IFormFile? file, [FromForm] string? text,
        [FromForm] string? history, CancellationToken ct)
    {
        if (!_conversation.IsConfigured)
            return StatusCode(503, new { message = "Conversation practice is not available right now." });

        var user = await _db.Users.FindAsync([CurrentUserId], ct);
        if (user is null) return Unauthorized();

        var course = Courses.Get(user.CourseId);
        var catalog = _courses.For(user.CourseId);
        var lesson = catalog.GetById(lessonId);
        var scenario = lesson?.Blocks.FirstOrDefault(b => b.Type == "conversation" && b.Scenario is not null)?.Scenario;
        if (lesson is null || scenario is null) return NotFound();

        var progress = await _db.LessonProgress
            .Where(p => p.UserId == user.Id)
            .ToDictionaryAsync(p => p.LessonId, ct);
        if (!_pace.IsUnlocked(user, lessonId, progress))
            return StatusCode(423, new { message = "This lesson is locked. Complete the previous lesson first." });

        if (!TryParseHistory(history, out var turns))
            return BadRequest(new { message = "history is not valid." });

        var learnerTurns = turns.Count(t => t.Role == "learner");
        if (learnerTurns >= _conversation.MaxTurns)
            return BadRequest(new { message = "This conversation has ended. Start a new one." });

        // --- what did the learner say? ---
        string heard;
        if (file is { Length: > 0 })
        {
            await using var stream = file.OpenReadStream();
            var transcript = await _speech.TranscribeFreeAsync(
                stream, file.ContentType, file.FileName, course, VocabularyHint(course, lesson, scenario), ct);
            if (transcript is null)
                return StatusCode(503, new { message = "Couldn't reach the speech service. Try again, or type your answer." });
            heard = transcript.Trim();
        }
        else
        {
            heard = (text ?? "").Trim();
            if (heard.Any(char.IsControl)) return BadRequest(new { message = "text has invalid characters." });
        }

        if (heard.Length > MaxLineLength) heard = heard[..MaxLineLength];

        // Silence, or a clip Whisper made nothing of: no model call, no turn spent.
        if (heard.Length == 0)
            return Ok(new { heard = "", unclear = true, turnsLeft = _conversation.TurnsLeft(user.Id) });

        if (!_conversation.TrySpendTurn(user.Id))
            return StatusCode(429, new { message = "That's all the conversation practice for today. Come back tomorrow!" });

        var reply = await _conversation.ReplyAsync(
            course, lesson, KnownWords(course, catalog, lesson), scenario, turns, heard,
            lastTurn: learnerTurns + 1 >= _conversation.MaxTurns, ct);
        if (reply is null)
        {
            _conversation.RefundTurn(user.Id);
            return StatusCode(503, new { message = "Your conversation partner didn't answer. Try again in a moment." });
        }

        // Spoken by the course voice when cloud TTS is on; otherwise the client
        // reads the reply with the device voice. Not cached: no two replies match.
        var audio = await _tts.SynthesizeAsync(reply.Text, course, ct, cache: false);

        return Ok(new
        {
            heard,
            unclear = false,
            reply = reply.Text,
            translation = reply.Translation,
            feedback = reply.Feedback,
            done = reply.Done || learnerTurns + 1 >= _conversation.MaxTurns,
            audio = audio is { Bytes.Length: > 0 } ? Convert.ToBase64String(audio.Bytes) : null,
            audioType = audio?.ContentType,
            turnsLeft = _conversation.TurnsLeft(user.Id),
        });
    }

    private sealed record HistoryItem(string? Role, string? Text);

    // The transcript is held by the client, so it is treated as untrusted input:
    // bounded in length, restricted to the two known roles, stripped of control
    // characters. The scenario and instructions never come from here.
    private bool TryParseHistory(string? json, out List<ConversationService.Turn> turns)
    {
        turns = new();
        if (string.IsNullOrWhiteSpace(json)) return true;

        List<HistoryItem>? items;
        try
        {
            items = JsonSerializer.Deserialize<List<HistoryItem>>(
                json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch (JsonException) { return false; }

        if (items is null) return true;
        if (items.Count > _conversation.MaxTurns * 2) return false;

        foreach (var item in items)
        {
            if (item.Role is not ("learner" or "partner")) return false;
            var line = new string((item.Text ?? "").Where(c => !char.IsControl(c)).ToArray()).Trim();
            if (line.Length == 0) continue;
            if (line.Length > MaxLineLength) line = line[..MaxLineLength];
            turns.Add(new ConversationService.Turn(item.Role, line));
        }
        return true;
    }

    private static string Target(Course course, VocabItem v) =>
        course.Sides(v.Swahili, v.English).Target;

    // Everything taught up to and including this lesson, most recent first, so
    // the model keeps to words the learner has actually met.
    private static List<string> KnownWords(Course course, LessonCatalog catalog, Lesson lesson) =>
        catalog.All
            .Where(l => l.Id <= lesson.Id)
            .OrderByDescending(l => l.Id)
            .SelectMany(l => l.Vocabulary)
            .Select(v => Target(course, v).Trim())
            .Where(w => w.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(250)
            .ToList();

    // What Whisper should expect to hear: the scenario's helper phrases first,
    // then this lesson's words. Whisper only reads the tail of a long prompt and
    // the sidecar caps it, so the most relevant words go last.
    private static string VocabularyHint(Course course, Lesson lesson, ConversationScenario scenario)
    {
        var words = lesson.Vocabulary.Select(v => Target(course, v))
            .Concat(scenario.Phrases.Select(p => p.Swahili))
            .Append(scenario.Opening)
            .Select(w => w.Trim())
            .Where(w => w.Length > 0);
        var hint = string.Join(", ", words);
        return hint.Length > 600 ? hint[^600..] : hint;
    }
}
