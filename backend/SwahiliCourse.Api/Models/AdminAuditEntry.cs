namespace SwahiliCourse.Api.Models;

// One thing an admin did in the backoffice.
//
// Deliberately not foreign-keyed to Users: the record of "who deleted this
// account" has to outlive both the account and, eventually, the admin. The
// emails are copied in for the same reason — an id alone means nothing once
// its row is gone.
public class AdminAuditEntry
{
    public int Id { get; set; }

    public int AdminUserId { get; set; }
    public string AdminEmail { get; set; } = string.Empty;

    // "user.suspend", "user.delete", "system.tts-cache.clear" — see AdminActions.
    public string Action { get; set; } = string.Empty;

    // The account acted on, when there is one.
    public int? TargetUserId { get; set; }
    public string? TargetEmail { get; set; }

    // What changed, in a sentence. Never a password or a token.
    public string? Detail { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public static class AdminActions
{
    public const string UserUpdate = "user.update";
    public const string UserGrantAdmin = "user.grant-admin";
    public const string UserRevokeAdmin = "user.revoke-admin";
    public const string UserSuspend = "user.suspend";
    public const string UserReactivate = "user.reactivate";
    public const string UserPasswordReset = "user.password-reset";
    public const string UserResetProgress = "user.reset-progress";
    public const string UserDelete = "user.delete";
    public const string UserExport = "user.export";
    public const string TtsCacheClear = "system.tts-cache.clear";
    public const string BootstrapAdmin = "system.bootstrap-admin";
}
