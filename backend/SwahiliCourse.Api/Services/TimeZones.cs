namespace SwahiliCourse.Api.Services;

// Validation for the time zone id a client sends.
//
// The value comes from the browser or device (Intl.DateTimeFormat().
// resolvedOptions().timeZone), so it is an IANA id like "Africa/Dar_es_Salaam".
// .NET resolves those on Windows too, but a client can send anything, and a
// zone this machine cannot resolve must not break sign-up or the streak — it
// falls back to UTC, which is what every account held before zones existed here.
public static class TimeZones
{
    public const string Default = "UTC";

    // Guards against an unbounded string reaching the database; real ids are
    // well under this.
    private const int MaxLength = 64;

    public static bool IsKnown(string? id)
    {
        if (string.IsNullOrWhiteSpace(id) || id.Length > MaxLength) return false;
        try
        {
            TimeZoneInfo.FindSystemTimeZoneById(id);
            return true;
        }
        catch (Exception e) when (e is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            return false;
        }
    }

    public static string Normalize(string? id) =>
        IsKnown(id) ? id!.Trim() : Default;
}
