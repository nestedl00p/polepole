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
}
