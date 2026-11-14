using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using SwahiliCourse.Api.Data;
using SwahiliCourse.Api.Models;

namespace SwahiliCourse.Api.Services;

// The authorization policy every /api/admin endpoint sits behind.
//
// The claim is not in the token. Program.cs adds it per request from the
// account's row (see OnTokenValidated), so granting or revoking the role needs
// no new sign-in and cannot be outlived by an old token.
public static class AdminPolicy
{
    public const string Name = "Admin";
    public const string Claim = "polepole:admin";

    // How stale User.LastSeenAt may get before a request refreshes it.
    public static readonly TimeSpan SeenThrottle = TimeSpan.FromMinutes(10);
}

// Account operations shared by the learner's own settings and the backoffice,
// so "restart" means the same thing whoever presses it.
public static class AccountAdmin
{
    // Back to day 1: lesson progress, streak and XP go; the account, its
    // settings and its review cards stay. Caller saves.
    public static void ResetProgress(AppDbContext db, User user, DateTime nowUtc)
    {
        db.LessonProgress.RemoveRange(db.LessonProgress.Where(p => p.UserId == user.Id));

        user.StartDate = nowUtc;
        user.StreakCount = 0;
        user.TotalXp = 0;
        user.LastActivityDate = null;
        user.LastRestDayAt = null;
        user.LastDoseAt = null;
    }

    // Startup bootstrap for the first admin(s). Promotes existing accounts
    // named in Admin:Emails; never demotes, and never creates an account.
    public static void PromoteConfiguredAdmins(AppDbContext db, string? configured, ILogger log)
    {
        var emails = (configured ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(e => e.ToLowerInvariant())
            .Distinct()
            .ToList();
        if (emails.Count == 0) return;

        var toPromote = db.Users.Where(u => emails.Contains(u.Email) && !u.IsAdmin).ToList();
        foreach (var user in toPromote)
        {
            user.IsAdmin = true;
            db.AdminAudit.Add(new AdminAuditEntry
            {
                AdminUserId = 0,
                AdminEmail = "system",
                Action = AdminActions.BootstrapAdmin,
                TargetUserId = user.Id,
                TargetEmail = user.Email,
                Detail = "Granted admin from the Admin:Emails setting at startup.",
            });
            log.LogWarning("Granted admin to {Email} from Admin:Emails.", user.Email);
        }
        if (toPromote.Count > 0) db.SaveChanges();

        var missing = emails.Except(db.Users.Where(u => emails.Contains(u.Email)).Select(u => u.Email)).ToList();
        if (missing.Count > 0)
            log.LogWarning(
                "Admin:Emails names {Count} address(es) with no account yet. Register first, then restart — registering does not grant admin.",
                missing.Count);
    }
}

// Writes the audit trail. Entries are added to the same DbContext as the
// change they describe and saved by the caller, so the two commit together:
// there is no admin change without its record, and no record of a change that
// did not happen.
public class AdminAudit
{
    private readonly AppDbContext _db;
    public AdminAudit(AppDbContext db) => _db = db;

    public void Record(ClaimsPrincipal admin, string action, User? target = null, string? detail = null)
    {
        int.TryParse(admin.FindFirstValue("sub") ?? admin.FindFirstValue(ClaimTypes.NameIdentifier), out var adminId);
        _db.AdminAudit.Add(new AdminAuditEntry
        {
            AdminUserId = adminId,
            AdminEmail = admin.FindFirstValue("email") ?? admin.FindFirstValue(ClaimTypes.Email) ?? string.Empty,
            Action = action,
            TargetUserId = target?.Id,
            TargetEmail = target?.Email,
            Detail = detail,
            CreatedAt = DateTime.UtcNow,
        });
    }
}
