using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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

    public DoseController(AppDbContext db, DoseService dose)
    {
        _db = db;
        _dose = dose;
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
