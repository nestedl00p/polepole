namespace SwahiliCourse.Api.Models;

// A switch an admin can flip in the backoffice without a redeploy. One row per
// setting; a missing row means "use the value from configuration".
//
// Only on/off style operational settings belong here. Secrets stay in
// configuration (environment variables / user-secrets), never in this table.
public class ServiceSetting
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public static class ServiceSettingKeys
{
    // "true" | "false" — overrides Conversation:Enabled.
    public const string ConversationEnabled = "conversation.enabled";
}
