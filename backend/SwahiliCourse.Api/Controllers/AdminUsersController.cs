using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SwahiliCourse.Api.Data;
using SwahiliCourse.Api.Models;
using SwahiliCourse.Api.Services;

namespace SwahiliCourse.Api.Controllers;

// Backoffice: finding, inspecting and managing learner accounts.
//
// Every change writes an AdminAuditEntry in the same save. Three things an
// admin cannot do to their own account — remove their admin role, suspend it,
// delete it — which is also what guarantees the last admin can never be
// removed from inside the backoffice.
[ApiController]
[Authorize(Policy = AdminPolicy.Name)]
[Route("api/admin/users")]
public class AdminUsersController : AuthedController
{
    private const int MaxPageSize = 100;
    // Cards forgotten this many times are leeches — worth a look, not a drill.
    private const int LeechLapses = 3;

    private readonly AppDbContext _db;
    private readonly AdminAudit _audit;
    private readonly PaceService _pace;
    private readonly CourseCatalog _courses;
    private readonly VoiceStore _voice;

    public AdminUsersController(
        AppDbContext db, AdminAudit audit, PaceService pace, CourseCatalog courses, VoiceStore voice)
    {
        _db = db; _audit = audit; _pace = pace; _courses = courses; _voice = voice;
    }

    public record UpdateUserDto(string? DisplayName, string? Email, int? PlanLengthDays);
    public record RoleDto(bool IsAdmin);
    public record StatusDto(bool Disabled);
    public record PasswordDto(string? NewPassword);

    // GET /api/admin/users?search=&course=sw&status=suspended&sort=seen&page=1
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? search, [FromQuery] string? course, [FromQuery] string? status,
        [FromQuery] string? sort, [FromQuery] int page = 1, [FromQuery] int pageSize = 25,
        CancellationToken ct = default)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        var query = _db.Users.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            // "#42" or a bare number also finds the account with that id.
            var byId = int.TryParse(term.TrimStart('#'), out var id) ? id : -1;
            query = query.Where(u =>
                u.Email.Contains(term) || u.DisplayName.ToLower().Contains(term) || u.Id == byId);
        }

        if (!string.IsNullOrWhiteSpace(course)) query = query.Where(u => u.CourseId == course);

        query = status switch
        {
            "active" => query.Where(u => !u.IsDisabled),
            "suspended" => query.Where(u => u.IsDisabled),
            "admin" => query.Where(u => u.IsAdmin),
            _ => query,
        };

        var total = await query.CountAsync(ct);

        query = sort switch
        {
            "seen" => query.OrderByDescending(u => u.LastSeenAt).ThenByDescending(u => u.Id),
            "xp" => query.OrderByDescending(u => u.TotalXp).ThenByDescending(u => u.Id),
            "streak" => query.OrderByDescending(u => u.StreakCount).ThenByDescending(u => u.Id),
            "email" => query.OrderBy(u => u.Email),
            _ => query.OrderByDescending(u => u.CreatedAt).ThenByDescending(u => u.Id),
        };

        var items = await query
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(u => new
            {
                u.Id, u.Email, u.DisplayName, u.CourseId, u.CreatedAt, u.LastSeenAt, u.LastDoseAt,
                u.StreakCount, u.TotalXp, u.IsAdmin, u.IsDisabled,
                LessonsCompleted = u.Progress.Count(p => p.QuizCompleted),
            })
            .ToListAsync(ct);

        return Ok(new { total, page, pageSize, items });
    }

    // GET /api/admin/users/42 — everything the backoffice shows about one account.
    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        var u = await _db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (u is null) return NotFound(new { message = "No such account." });

        var now = DateTime.UtcNow;
        var catalog = _courses.For(u.CourseId);

        var progress = await _db.LessonProgress.AsNoTracking()
            .Where(p => p.UserId == id).OrderBy(p => p.LessonId).ToListAsync(ct);

        var practice = await _db.PracticeDays.AsNoTracking()
            .Where(d => d.UserId == id).OrderByDescending(d => d.Day).Take(30).ToListAsync(ct);

        var cards = _db.CardStates.AsNoTracking().Where(c => c.UserId == id);
        var cardTotal = await cards.CountAsync(ct);
        var boxes = await cards.GroupBy(c => c.Box)
            .Select(g => new { Box = g.Key, Count = g.Count() })
            .OrderBy(b => b.Box).ToListAsync(ct);

        var voice = await _db.VoiceTakes.AsNoTracking().Where(v => v.UserId == id)
            .GroupBy(v => 1).Select(g => new { Count = g.Count(), Bytes = g.Sum(v => v.SizeBytes) })
            .FirstOrDefaultAsync(ct);

        var audit = await _db.AdminAudit.AsNoTracking()
            .Where(a => a.TargetUserId == id).OrderByDescending(a => a.CreatedAt).Take(20).ToListAsync(ct);

        return Ok(new
        {
            user = new
            {
                u.Id, u.Email, u.DisplayName, u.CourseId,
                courseTitle = Courses.Get(u.CourseId).Title,
                u.CreatedAt, u.LastSeenAt, u.LastDoseAt, u.StartDate, u.PlanLengthDays,
                currentDay = _pace.CurrentScheduledDay(u),
                totalLessons = catalog.TotalLessons,
                u.TimeZoneId, u.StreakCount, u.TotalXp, u.IsAdmin, u.IsDisabled,
                u.RemindersEnabled,
                reminderLocalTime = u.ReminderLocalTime.ToString("HH:mm"),
                hasPushToken = !string.IsNullOrEmpty(u.PushToken),
                u.LastNotifiedAt, u.Why, u.HabitAnswer,
                isSelf = u.Id == CurrentUserId,
            },
            progress = progress.Select(p => new
            {
                p.LessonId,
                title = catalog.GetById(p.LessonId)?.Title ?? $"Lesson {p.LessonId}",
                p.LessonViewed, p.QuizCompleted, p.BestQuizScore, p.QuizTotal, p.CompletedAt,
            }),
            practice = practice.Select(d => new
            {
                day = d.Day.ToString("yyyy-MM-dd"),
                opened = d.DoseOpenedAt != null,
                d.OpenedUnprompted,
                completed = d.DoseCompletedAt != null,
                d.ItemsAnswered, d.DurationSeconds,
                quizPassed = d.QuizPassedAt != null,
            }),
            cards = new
            {
                total = cardTotal,
                due = await cards.CountAsync(c => c.DueAt <= now, ct),
                pinned = await cards.CountAsync(c => c.Pinned, ct),
                leeches = await cards.CountAsync(c => c.Lapses >= LeechLapses, ct),
                averageStrength = cardTotal == 0 ? 0 : (int)Math.Round(await cards.AverageAsync(c => c.Strength, ct)),
                boxes,
            },
            voice = new { count = voice?.Count ?? 0, bytes = voice?.Bytes ?? 0 },
            audit,
        });
    }

    // PUT /api/admin/users/42 — name, email, plan length. Null leaves a field alone.
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateUserDto dto, CancellationToken ct)
    {
        var u = await _db.Users.FindAsync([id], ct);
        if (u is null) return NotFound(new { message = "No such account." });

        var changes = new List<string>();

        if (dto.DisplayName is not null)
        {
            var name = dto.DisplayName.Trim();
            if (name.Length is 0 or > 80)
                return BadRequest(new { message = "Display name must be 1–80 characters." });
            if (name != u.DisplayName) { changes.Add($"name \"{u.DisplayName}\" → \"{name}\""); u.DisplayName = name; }
        }

        if (dto.Email is not null)
        {
            var email = dto.Email.Trim().ToLowerInvariant();
            if (email.Length > 254 || !System.Net.Mail.MailAddress.TryCreate(email, out _))
                return BadRequest(new { message = "That is not an email address." });
            if (email != u.Email)
            {
                if (await _db.Users.AnyAsync(x => x.Email == email && x.Id != id, ct))
                    return Conflict(new { message = "Another account already uses that email." });
                changes.Add($"email {u.Email} → {email}");
                u.Email = email;
            }
        }

        if (dto.PlanLengthDays is int plan)
        {
            // Same bounds the learner's own settings enforce.
            plan = Math.Clamp(plan, 30, 365);
            if (plan != u.PlanLengthDays) { changes.Add($"plan {u.PlanLengthDays} → {plan} days"); u.PlanLengthDays = plan; }
        }

        if (changes.Count > 0)
        {
            _audit.Record(User, AdminActions.UserUpdate, u, string.Join("; ", changes));
            await _db.SaveChangesAsync(ct);
        }
        return NoContent();
    }

    [HttpPost("{id:int}/role")]
    public async Task<IActionResult> SetRole(int id, RoleDto dto, CancellationToken ct)
    {
        if (id == CurrentUserId)
            return BadRequest(new { message = "You cannot change your own admin role. Ask another admin." });

        var u = await _db.Users.FindAsync([id], ct);
        if (u is null) return NotFound(new { message = "No such account." });

        if (u.IsAdmin != dto.IsAdmin)
        {
            u.IsAdmin = dto.IsAdmin;
            _audit.Record(User, dto.IsAdmin ? AdminActions.UserGrantAdmin : AdminActions.UserRevokeAdmin, u);
            await _db.SaveChangesAsync(ct);
        }
        return NoContent();
    }

    [HttpPost("{id:int}/status")]
    public async Task<IActionResult> SetStatus(int id, StatusDto dto, CancellationToken ct)
    {
        if (id == CurrentUserId)
            return BadRequest(new { message = "You cannot suspend your own account." });

        var u = await _db.Users.FindAsync([id], ct);
        if (u is null) return NotFound(new { message = "No such account." });

        if (u.IsDisabled != dto.Disabled)
        {
            u.IsDisabled = dto.Disabled;
            _audit.Record(User, dto.Disabled ? AdminActions.UserSuspend : AdminActions.UserReactivate, u);
            await _db.SaveChangesAsync(ct);
        }
        return NoContent();
    }

    // There is no email in this app, so no self-service "forgot password": an
    // admin setting a new one, and telling the learner out of band, is the
    // recovery path.
    [HttpPost("{id:int}/password")]
    public async Task<IActionResult> SetPassword(int id, PasswordDto dto, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(dto.NewPassword) || dto.NewPassword.Length < 8)
            return BadRequest(new { message = "The new password must be at least 8 characters." });
        if (dto.NewPassword.Length > 128)
            return BadRequest(new { message = "The new password is too long." });

        var u = await _db.Users.FindAsync([id], ct);
        if (u is null) return NotFound(new { message = "No such account." });

        u.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
        _audit.Record(User, AdminActions.UserPasswordReset, u);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:int}/reset-progress")]
    public async Task<IActionResult> ResetProgress(int id, CancellationToken ct)
    {
        var u = await _db.Users.FindAsync([id], ct);
        if (u is null) return NotFound(new { message = "No such account." });

        AccountAdmin.ResetProgress(_db, u, DateTime.UtcNow);
        _audit.Record(User, AdminActions.UserResetProgress, u, "Lesson progress, streak and XP reset to day 1.");
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    // Permanent. Progress, cards, practice history and voice takes go with the
    // account (database cascade); the recordings on disk are removed here.
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (id == CurrentUserId)
            return BadRequest(new { message = "You cannot delete your own account from the backoffice." });

        var u = await _db.Users.FindAsync([id], ct);
        if (u is null) return NotFound(new { message = "No such account." });

        _audit.Record(User, AdminActions.UserDelete, u, $"Deleted \"{u.DisplayName}\" ({u.CourseId} course, {u.TotalXp} XP).");
        _db.Users.Remove(u);
        await _db.SaveChangesAsync(ct);

        // After the commit: a failed delete must not leave an account whose
        // recordings are already gone.
        _voice.DeleteAll(id);
        return NoContent();
    }

    // Everything held about one account, as a file — for a learner who asks
    // what is stored about them. No password hash and no push token.
    [HttpGet("{id:int}/export")]
    public async Task<IActionResult> Export(int id, CancellationToken ct)
    {
        var u = await _db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (u is null) return NotFound(new { message = "No such account." });

        var payload = new
        {
            exportedAt = DateTime.UtcNow,
            account = new
            {
                u.Id, u.Email, u.DisplayName, u.CourseId, u.CreatedAt, u.StartDate, u.PlanLengthDays,
                u.TimeZoneId, u.StreakCount, u.TotalXp, u.LastActivityDate, u.LastDoseAt, u.LastSeenAt,
                u.RemindersEnabled, reminderLocalTime = u.ReminderLocalTime.ToString("HH:mm"),
                u.Why, u.HabitAnswer, u.MilestonesSeen, u.IsAdmin, u.IsDisabled,
            },
            lessonProgress = await _db.LessonProgress.AsNoTracking().Where(p => p.UserId == id)
                .OrderBy(p => p.LessonId)
                .Select(p => new { p.LessonId, p.LessonViewed, p.QuizCompleted, p.QuizScore, p.QuizTotal, p.BestQuizScore, p.CompletedAt, p.UpdatedAt })
                .ToListAsync(ct),
            practiceDays = await _db.PracticeDays.AsNoTracking().Where(d => d.UserId == id)
                .OrderBy(d => d.Day)
                .Select(d => new { d.Day, d.DoseOpenedAt, d.OpenedUnprompted, d.DoseCompletedAt, d.ItemsAnswered, d.DurationSeconds, d.QuizPassedAt })
                .ToListAsync(ct),
            cards = await _db.CardStates.AsNoTracking().Where(c => c.UserId == id)
                .OrderBy(c => c.ItemKey)
                .Select(c => new { c.ItemKey, c.ItemKind, c.SourceLessonId, c.Box, c.DueAt, c.Lapses, c.Strength, c.Pinned, c.LastSeenAt, c.BestSpeechScore })
                .ToListAsync(ct),
            voiceTakes = await _db.VoiceTakes.AsNoTracking().Where(v => v.UserId == id)
                .OrderBy(v => v.CreatedAt)
                .Select(v => new { v.Id, v.ItemKey, v.Text, v.Score, v.ContentType, v.SizeBytes, v.CreatedAt })
                .ToListAsync(ct),
        };

        // Tracked only so the audit entry can be saved; nothing else changes.
        _audit.Record(User, AdminActions.UserExport, u);
        await _db.SaveChangesAsync(ct);

        var json = JsonSerializer.SerializeToUtf8Bytes(payload, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true,
        });
        return File(json, "application/json", $"polepole-account-{id}.json");
    }
}
