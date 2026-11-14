using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using SwahiliCourse.Api.Data;
using SwahiliCourse.Api.DTOs;
using SwahiliCourse.Api.Models;
using SwahiliCourse.Api.Services;

namespace SwahiliCourse.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
// Unauthenticated by necessity, so rate limiting is what bounds password guessing.
[EnableRateLimiting("auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly TokenService _tokens;
    private readonly PaceService _pace;
    private readonly StreakService _streaks;
    private readonly TasterService _taster;
    private readonly ReviewScheduler _scheduler;

    public AuthController(
        AppDbContext db, TokenService tokens, PaceService pace, StreakService streaks,
        TasterService taster, ReviewScheduler scheduler)
    {
        _db = db; _tokens = tokens; _pace = pace; _streaks = streaks;
        _taster = taster; _scheduler = scheduler;
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password))
            return BadRequest(new { message = "Email and password are required." });

        if (dto.Password.Length < 6)
            return BadRequest(new { message = "Password must be at least 6 characters." });

        var email = dto.Email.Trim().ToLowerInvariant();
        if (await _db.Users.AnyAsync(u => u.Email == email))
            return Conflict(new { message = "An account with that email already exists." });

        var plan = dto.PlanLengthDays <= 0 ? 30 : Math.Clamp(dto.PlanLengthDays, 30, 365);

        // An account is bound to one course direction for its lifetime.
        if (!string.IsNullOrWhiteSpace(dto.CourseId) && !Courses.IsValid(dto.CourseId))
            return BadRequest(new { message = "Unknown course." });
        var courseId = Courses.Get(dto.CourseId).Id;

        var user = new User
        {
            Email = email,
            DisplayName = string.IsNullOrWhiteSpace(dto.DisplayName) ? email.Split('@')[0] : dto.DisplayName.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            PlanLengthDays = plan,
            CourseId = courseId,
            // Streak days are counted here, so an unrecognised or missing zone
            // falls back to UTC rather than being rejected at sign-up.
            TimeZoneId = TimeZones.Normalize(dto.TimeZoneId),
            StartDate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        // Someone who did the taster before signing up keeps what they did
        // there: their answers become their first cards.
        if (dto.TasterAnswers is { Count: > 0 }
            && _taster.Seed(user, dto.TasterAnswers, _scheduler, DateTime.UtcNow) > 0)
        {
            await _db.SaveChangesAsync();
        }

        return Ok(new AuthResponse(_tokens.CreateToken(user), ToDto(user)));
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginDto dto)
    {
        var email = dto.Email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);

        if (user is null || !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
            return Unauthorized(new { message = "Invalid email or password." });

        // Only after the password checks out, so this cannot be used to probe
        // which addresses have accounts.
        if (user.IsDisabled)
            return StatusCode(StatusCodes.Status403Forbidden,
                new { message = "This account has been suspended. Contact support if you think that is a mistake." });

        return Ok(new AuthResponse(_tokens.CreateToken(user), ToDto(user)));
    }

    private UserDto ToDto(User u) => UserMapper.ToDto(u, _pace, _streaks);
}
