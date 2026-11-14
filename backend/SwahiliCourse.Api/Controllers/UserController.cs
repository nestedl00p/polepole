using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SwahiliCourse.Api.Data;
using SwahiliCourse.Api.DTOs;
using SwahiliCourse.Api.Services;

namespace SwahiliCourse.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class UserController : AuthedController
{
    private readonly AppDbContext _db;
    private readonly PaceService _pace;
    private readonly StreakService _streaks;

    public UserController(AppDbContext db, PaceService pace, StreakService streaks)
    {
        _db = db; _pace = pace; _streaks = streaks;
    }

    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> Me()
    {
        var u = await _db.Users.FindAsync(CurrentUserId);
        if (u is null) return NotFound();
        return UserMapper.ToDto(u, _pace, _streaks);
    }

    // Change the pace, e.g. extend the 30-day plan to 60 or 90 days.
    [HttpPut("pace")]
    public async Task<ActionResult<UserDto>> UpdatePace(UpdatePaceDto dto)
    {
        var u = await _db.Users.FindAsync(CurrentUserId);
        if (u is null) return NotFound();

        // Allow 30 (the base) up to a full year. Learners can only extend or keep,
        // never compress below the 30-day design.
        u.PlanLengthDays = Math.Clamp(dto.PlanLengthDays, 30, 365);
        await _db.SaveChangesAsync();

        return UserMapper.ToDto(u, _pace, _streaks);
    }

    // Optional: let a user restart the course (reset start date & progress).
    [HttpPost("restart")]
    public async Task<ActionResult<UserDto>> Restart()
    {
        var u = await _db.Users.FindAsync(CurrentUserId);
        if (u is null) return NotFound();

        var progress = _db.LessonProgress.Where(p => p.UserId == u.Id);
        _db.LessonProgress.RemoveRange(progress);

        u.StartDate = DateTime.UtcNow;
        u.StreakCount = 0;
        u.TotalXp = 0;
        u.LastActivityDate = null;
        u.LastRestDayAt = null;
        u.LastDoseAt = null;
        await _db.SaveChangesAsync();

        return UserMapper.ToDto(u, _pace, _streaks);
    }

    // The learner's time zone, sent by the client (Intl.DateTimeFormat().
    // resolvedOptions().timeZone). Streak days are counted in it, so a learner
    // who moves gets their days counted where they now are.
    [HttpPut("timezone")]
    public async Task<ActionResult<UserDto>> UpdateTimeZone(UpdateTimeZoneDto dto)
    {
        var u = await _db.Users.FindAsync(CurrentUserId);
        if (u is null) return NotFound();

        if (!TimeZones.IsKnown(dto.TimeZoneId))
            return BadRequest(new { message = "Unknown time zone." });

        u.TimeZoneId = TimeZones.Normalize(dto.TimeZoneId);
        await _db.SaveChangesAsync();

        return UserMapper.ToDto(u, _pace, _streaks);
    }

    // Reminder settings: on/off, the local time, the phone's push token, and
    // the zone that time is in. Any field left null is not touched, so the
    // phone can register its token without knowing the rest.
    [HttpPut("reminders")]
    public async Task<ActionResult<UserDto>> UpdateReminders(UpdateRemindersDto dto)
    {
        var u = await _db.Users.FindAsync(CurrentUserId);
        if (u is null) return NotFound();

        if (dto.LocalTime is not null)
        {
            if (!TimeOnly.TryParseExact(dto.LocalTime, "HH:mm", out var time))
                return BadRequest(new { message = "localTime must be HH:mm, e.g. 08:00." });
            u.ReminderLocalTime = time;
            // The first time the learner picks a time themselves is a step on
            // the habit path, so it is recorded rather than inferred later.
            u.ReminderChosenAt ??= DateTime.UtcNow;
        }

        if (dto.TimeZoneId is not null)
        {
            if (!TimeZones.IsKnown(dto.TimeZoneId))
                return BadRequest(new { message = "Unknown time zone." });
            u.TimeZoneId = TimeZones.Normalize(dto.TimeZoneId);
        }

        if (dto.PushToken is not null)
        {
            if (dto.PushToken.Length == 0)
            {
                u.PushToken = null;
            }
            else
            {
                if (!ReminderService.LooksLikePushToken(dto.PushToken))
                    return BadRequest(new { message = "That is not an Expo push token." });

                // A phone belongs to whoever is signed in on it now. Without
                // this, signing in as a second account would leave the first
                // one's reminders arriving on the same device.
                var others = await _db.Users
                    .Where(x => x.PushToken == dto.PushToken && x.Id != u.Id)
                    .ToListAsync();
                foreach (var other in others) other.PushToken = null;

                u.PushToken = dto.PushToken;
            }
        }

        if (dto.Enabled is bool enabled) u.RemindersEnabled = enabled;

        await _db.SaveChangesAsync();
        return UserMapper.ToDto(u, _pace, _streaks);
    }

    // The browser showed today's reminder itself. There is no push service on
    // the web path, so this is how the server learns a reminder went out —
    // which it must, to tell a prompted open from an unprompted one.
    [HttpPost("reminders/shown")]
    public async Task<IActionResult> ReminderShown()
    {
        var u = await _db.Users.FindAsync(CurrentUserId);
        if (u is null) return NotFound();

        u.LastNotifiedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // "What's your why?" — asked after the first dose, not before sign-up.
    // Null clears it.
    [HttpPut("why")]
    public async Task<ActionResult<UserDto>> UpdateWhy(UpdateWhyDto dto)
    {
        var u = await _db.Users.FindAsync(CurrentUserId);
        if (u is null) return NotFound();

        if (!string.IsNullOrWhiteSpace(dto.Why) && !ReminderCopy.Whys.Contains(dto.Why))
            return BadRequest(new { message = "why must be one of: trip, family, work, curiosity." });

        u.Why = string.IsNullOrWhiteSpace(dto.Why) ? null : dto.Why;
        await _db.SaveChangesAsync();
        return UserMapper.ToDto(u, _pace, _streaks);
    }

    // The answer to the day-30 question, "what makes you open this?".
    [HttpPost("habit-answer")]
    public async Task<IActionResult> HabitAnswer(HabitAnswerDto dto)
    {
        var u = await _db.Users.FindAsync(CurrentUserId);
        if (u is null) return NotFound();

        var answer = dto.Answer?.Trim();
        if (string.IsNullOrEmpty(answer)) return BadRequest(new { message = "answer is required." });

        u.HabitAnswer = answer.Length > 280 ? answer[..280] : answer;
        u.HabitAskedAt ??= DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
