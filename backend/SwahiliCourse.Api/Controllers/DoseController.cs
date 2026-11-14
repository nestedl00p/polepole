using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using SwahiliCourse.Api.Data;
using SwahiliCourse.Api.DTOs;
using SwahiliCourse.Api.Models;
using SwahiliCourse.Api.Services;

namespace SwahiliCourse.Api.Controllers;

// "Dose ya leo" — the daily practice loop. Five items drawn from what has come
// due, answered one at a time; each answer moves that item's due date, so
// today's session is what builds tomorrow's.
//
// See docs/DAILY-PRACTICE-LOOP.md.
[ApiController]
[Authorize]
[Route("api/[controller]")]
public class DoseController : AuthedController
{
    private readonly AppDbContext _db;
    private readonly DoseService _dose;
    private readonly PracticeLog _practice;
    private readonly TasterService _taster;

    public DoseController(AppDbContext db, DoseService dose, PracticeLog practice, TasterService taster)
    {
        _db = db;
        _dose = dose;
        _practice = practice;
        _taster = taster;
    }

    // The Dose screen was opened. Separate from GET /api/dose because the
    // dashboard fetches the dose too, to draw its hero — and a dashboard visit
    // is not the learner starting their practice. Whether the open came before
    // the day's reminder is decided here, from the server's own record of when
    // that reminder went out; the client is not asked.
    [HttpPost("open")]
    public async Task<IActionResult> Open(CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([CurrentUserId], ct);
        if (user is null) return Unauthorized();

        var now = DateTime.UtcNow;
        var day = await _practice.OpenAsync(user, now, ct);
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Two opens for the same new day arrived together — two tabs, a
            // phone and a laptop, or React re-running an effect — and the
            // other one created the day's row first. The unique index did its
            // job; drop our duplicate and report the row that won.
            _db.ChangeTracker.Clear();
            user = await _db.Users.FindAsync([CurrentUserId], ct);
            if (user is null) return Unauthorized();
            day = await _practice.OpenAsync(user, now, ct);
            await _db.SaveChangesAsync(ct);
        }

        return Ok(new { date = day.Day.ToString("yyyy-MM-dd"), unprompted = day.OpenedUnprompted });
    }

    // The pre-signup Dose: three items and a proverb, no account. Anonymous on
    // purpose — it is what a visitor gets before being asked for anything.
    [HttpGet("taster")]
    [AllowAnonymous]
    public ActionResult<TasterDto> Taster([FromQuery] string? course) => Ok(_taster.Build(course));

    // Grades one taster answer. Stateless: nothing is stored until an account
    // exists, at which point registration replays the answers.
    [HttpPost("taster/answer")]
    [AllowAnonymous]
    [EnableRateLimiting("media")]
    public ActionResult<TasterResultDto> TasterAnswer(TasterGradeDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ItemKey) || string.IsNullOrWhiteSpace(dto.Exercise))
            return BadRequest(new { message = "itemKey and exercise are required." });

        var result = _taster.Grade(dto.Course, dto.ItemKey, dto.Exercise, dto.Answer);
        return result is null ? NotFound(new { message = "That item is not in the taster." }) : Ok(result);
    }

    // Today's items. Stable within the calendar day: a reload returns the same
    // dose rather than reshuffling it, and answered items drop out as their due
    // dates move into the future.
    [HttpGet]
    public async Task<ActionResult<DoseDto>> Today(CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([CurrentUserId], ct);
        if (user is null) return Unauthorized();

        return Ok(await _dose.BuildAsync(user, ct));
    }

    // One answer. Grading is server-side — the client posts the learner's
    // choice, not a verdict — and the response carries the item's new strength
    // so the UI can show the bar move.
    [HttpPost("answer")]
    public async Task<ActionResult<DoseAnswerResultDto>> Answer(DoseAnswerDto dto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.ItemKey))
            return BadRequest(new { error = "itemKey is required." });

        if (!DoseService.IsKnownExercise(dto.Exercise))
            return BadRequest(new { error = $"Unknown exercise '{dto.Exercise}'." });

        var user = await _db.Users.FindAsync([CurrentUserId], ct);
        if (user is null) return Unauthorized();

        // A key the learner has not unlocked is a 404 rather than a wrong
        // answer, so a stale client cannot quietly bury a card it should not
        // have been shown.
        var item = await _dose.FindAsync(user, dto.ItemKey, ct);
        if (item is null) return NotFound(new { error = "That item is not in your deck." });

        var (card, correct, xp) = await _dose.AnswerAsync(
            user, item, dto.Exercise, dto.Answer, dto.SpeechScore, dto.ElapsedMs, ct);

        // Revealed only now that the answer is in — which is also why it was not
        // in the GET payload.
        var correctAnswer = dto.Exercise == DoseExercises.Tambua ? item.Source : item.Target;

        return Ok(new DoseAnswerResultDto(
            card.ItemKey,
            correct,
            correctAnswer,
            card.Box,
            card.Strength,
            card.DueAt,
            _dose.IntervalDays(card),
            card.Lapses,
            xp,
            user.TotalXp));
    }

    // Close the session: credits the day in the learner's own time zone and
    // returns where the streak now stands. Safe to call twice — a second
    // completion on the same day comes back AlreadyCountedToday with nothing
    // changed.
    [HttpPost("complete")]
    public async Task<ActionResult<DoseCompleteResultDto>> Complete(CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([CurrentUserId], ct);
        if (user is null) return Unauthorized();

        return Ok(await _dose.CompleteAsync(user, ct));
    }
}
