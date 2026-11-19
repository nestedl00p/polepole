using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using SwahiliCourse.Api.Data;
using SwahiliCourse.Api.Models;
using SwahiliCourse.Api.Services;

namespace SwahiliCourse.Api.Controllers;

// The reader: the learner pastes something written in the language they are
// learning, taps the words they do not know, and keeps the ones worth keeping
// as cards of their own.
//
// The text itself never comes here. The page splits it into words in the
// browser; this API sees one word and its sentence when a word is tapped, and
// stores only the words the learner chooses to add.
[ApiController]
[Authorize]
[Route("api/[controller]")]
[EnableRateLimiting("media")]
public class ReaderController : AuthedController
{
    private const int MaxWord = 60;
    private const int MaxMeaning = 120;
    private const int MaxSentence = 400;
    private const int MaxNote = 300;

    // A deck the learner builds by hand does not need to be unbounded.
    private const int MaxOwnWords = 2_000;

    private readonly AppDbContext _db;
    private readonly DoseService _dose;
    private readonly GlossService _gloss;

    public ReaderController(AppDbContext db, DoseService dose, GlossService gloss)
    {
        _db = db; _dose = dose; _gloss = gloss;
    }

    public record GlossRequest(string? Word, string? Sentence);
    public record AddWordRequest(string? Target, string? Source, string? SeenAs, string? Context, string? Note);

    // GET /api/reader/status — whether a tapped word gets an explanation, or
    // the learner fills the meaning in themselves.
    [HttpGet("status")]
    public IActionResult Status() =>
        Ok(new { gloss = _gloss.IsConfigured, glossesLeft = _gloss.Left(CurrentUserId) });

    // POST /api/reader/gloss { word, sentence }
    // 200 { lemma, meaning, note, glossesLeft }
    // 429 today's allowance is used up · 503 no explanation available — in
    // both cases the page falls back to the learner typing the meaning.
    [HttpPost("gloss")]
    public async Task<IActionResult> Gloss(GlossRequest dto, CancellationToken ct)
    {
        var word = Clean(dto.Word, MaxWord);
        var sentence = Clean(dto.Sentence, MaxSentence);
        if (word.Length == 0) return BadRequest(new { message = "word is required." });

        if (!_gloss.IsConfigured)
            return StatusCode(503, new { message = "Word explanations are not available right now." });

        var user = await _db.Users.FindAsync([CurrentUserId], ct);
        if (user is null) return Unauthorized();
        var course = Courses.Get(user.CourseId);

        var gloss = _gloss.Cached(course, word, sentence);
        if (gloss is null)
        {
            if (!_gloss.TrySpend(user.Id))
                return StatusCode(429, new { message = "That's all the word explanations for today." });

            gloss = await _gloss.GlossAsync(course, word, sentence, ct);
            if (gloss is null)
            {
                _gloss.Refund(user.Id);
                return StatusCode(503, new { message = "Couldn't explain that word. Try again in a moment." });
            }
        }

        return Ok(new
        {
            lemma = gloss.Lemma,
            meaning = gloss.Meaning,
            note = gloss.Note,
            glossesLeft = _gloss.Left(user.Id),
        });
    }

    // GET /api/reader/words — everything the learner has added, newest first.
    [HttpGet("words")]
    public async Task<IActionResult> Words(CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([CurrentUserId], ct);
        if (user is null) return Unauthorized();

        var words = await _db.UserWords.AsNoTracking()
            .Where(w => w.UserId == user.Id && w.CourseId == user.CourseId)
            .OrderByDescending(w => w.Id)
            .ToListAsync(ct);

        return Ok(new { words = words.Select(Shape) });
    }

    // POST /api/reader/words { target, source, seenAs, context, note }
    // 200 { added, word, itemKey }
    //     added=false means the course already teaches this word: nothing was
    //     stored, and the existing card was pinned instead (word is null).
    [HttpPost("words")]
    public async Task<IActionResult> Add(AddWordRequest dto, CancellationToken ct)
    {
        var target = Clean(dto.Target, MaxWord);
        var source = Clean(dto.Source, MaxMeaning);
        if (target.Length == 0 || source.Length == 0)
            return BadRequest(new { message = "The word and its meaning are both required." });

        var user = await _db.Users.FindAsync([CurrentUserId], ct);
        if (user is null) return Unauthorized();

        var count = await _db.UserWords.CountAsync(w => w.UserId == user.Id && w.CourseId == user.CourseId, ct);
        if (count >= MaxOwnWords)
            return BadRequest(new { message = "Your word list is full. Remove a few words to add more." });

        var (word, item) = await _dose.AddOwnWordAsync(
            user, target, source,
            Clean(dto.SeenAs, MaxWord), Clean(dto.Context, MaxSentence), Clean(dto.Note, MaxNote), ct);

        return Ok(new { added = word is not null, word = word is null ? null : Shape(word), itemKey = item.Key });
    }

    // DELETE /api/reader/words/{id} — the word and its review history.
    [HttpDelete("words/{id:int}")]
    public async Task<IActionResult> Remove(int id, CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([CurrentUserId], ct);
        if (user is null) return Unauthorized();

        return await _dose.RemoveOwnWordAsync(user, id, ct) ? NoContent() : NotFound();
    }

    private static object Shape(UserWord w) => new
    {
        id = w.Id,
        target = w.Target,
        source = w.Source,
        seenAs = w.SeenAs,
        context = w.Context,
        note = w.Note,
        createdAt = w.CreatedAt,
    };

    // Everything here is typed or pasted by the learner: control characters
    // out, runs of whitespace collapsed, length bounded.
    private static string Clean(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value)) return "";
        var chars = value.Select(c => char.IsControl(c) ? ' ' : c).ToArray();
        var text = string.Join(' ', new string(chars).Split(' ', StringSplitOptions.RemoveEmptyEntries));
        return text.Length > max ? text[..max].TrimEnd() : text;
    }
}
