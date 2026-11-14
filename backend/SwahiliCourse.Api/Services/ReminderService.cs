using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SwahiliCourse.Api.Data;
using SwahiliCourse.Api.Models;

namespace SwahiliCourse.Api.Services;

// Sends the day's one reminder: a push to the learner's phone at the time they
// picked, in their own zone, deep-linking into the Dose.
//
// Three rules, each of which is the design and not an implementation detail:
//
//  - One a day, at most. A second push for the same day is nagging.
//  - Never to someone who has already finished today's dose.
//  - Never late. A reminder set for 08:00 that could not go out until the
//    evening is dropped, not delivered at a time the learner did not choose.
//
// Web-only accounts have no push token and are skipped here; the browser shows
// their reminder itself while the app is open (see the web client's
// lib/reminders.js) and reports it through POST /api/user/reminders/shown.
//
// See docs/DAILY-PRACTICE-LOOP.md, "External triggers".
public class ReminderService : BackgroundService
{
    // How long after the chosen time a reminder may still go out. Wide enough
    // to ride out a restart or a failed send, narrow enough to stay "at the
    // time I picked".
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(60);

    private static readonly TimeSpan Tick = TimeSpan.FromMinutes(1);

    private const string DefaultExpoUrl = "https://exp.host/--/api/v2/push/send";

    private readonly IServiceScopeFactory _scopes;
    private readonly IHttpClientFactory _http;
    private readonly IConfiguration _config;
    private readonly StreakService _streaks;
    private readonly ILogger<ReminderService> _log;

    public ReminderService(
        IServiceScopeFactory scopes, IHttpClientFactory http, IConfiguration config,
        StreakService streaks, ILogger<ReminderService> log)
    {
        _scopes = scopes;
        _http = http;
        _config = config;
        _streaks = streaks;
        _log = log;
    }

    // An Expo push token as the SDK hands it out. Checked because the value is
    // client-supplied and ends up as the recipient of an outbound request.
    public static bool LooksLikePushToken(string? token) =>
        !string.IsNullOrWhiteSpace(token)
        && token.Length <= 200
        && (token.StartsWith("ExponentPushToken[", StringComparison.Ordinal)
            || token.StartsWith("ExpoPushToken[", StringComparison.Ordinal))
        && token.EndsWith(']');

    // Is this learner's reminder due right now? Pure, so the rules above can be
    // read (and checked) in one place.
    public static bool IsDue(User user, DateTime nowUtc, StreakService streaks)
    {
        if (!user.RemindersEnabled || string.IsNullOrEmpty(user.PushToken)) return false;
        if (streaks.HasDosedToday(user, nowUtc)) return false;

        var zone = streaks.ZoneFor(user);
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, zone);
        var today = DateOnly.FromDateTime(localNow);

        // Already reminded today.
        if (user.LastNotifiedAt is DateTime sent && streaks.LocalDate(user, sent) == today) return false;

        var chosen = today.ToDateTime(user.ReminderLocalTime);
        return localNow >= chosen && localNow < chosen + Window;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_config.GetValue("Reminders:Enabled", true))
        {
            _log.LogInformation("Reminders are disabled (Reminders:Enabled=false).");
            return;
        }

        using var timer = new PeriodicTimer(Tick);
        do
        {
            try
            {
                await SendDueAsync(DateTime.UtcNow, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception e)
            {
                // One bad pass must not end reminders for everyone until the
                // next deploy.
                _log.LogError(e, "Reminder pass failed; will try again on the next tick.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    // One pass. Public so it can be driven directly rather than waited for.
    public async Task<int> SendDueAsync(DateTime nowUtc, CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var doses = scope.ServiceProvider.GetRequiredService<DoseService>();

        // Whether a reminder is due depends on each learner's zone, which SQL
        // cannot evaluate, so the narrowing here is only "could be reminded at
        // all". That is every account with a phone registered — small enough
        // to walk once a minute at this scale; partition by UTC offset before
        // it stops being so.
        var candidates = await db.Users
            .Where(u => u.RemindersEnabled && u.PushToken != null && u.PushToken != "")
            .ToListAsync(ct);

        var sent = 0;
        foreach (var user in candidates)
        {
            if (!IsDue(user, nowUtc, _streaks)) continue;

            var dose = await doses.BuildAsync(user, ct);

            // Nothing to name. A reminder with no content would have to fall
            // back on "come back!", which is exactly the copy this is not.
            if (dose.Items.Count == 0) continue;

            // The key of a vocab card is the word being learned; a proverb's
            // key is an index, so proverbs are left out of the preview — and
            // stay a surprise.
            var targets = dose.Items
                .Where(i => i.Kind == ItemKinds.Vocab)
                .Select(i => i.ItemKey)
                .ToList();

            int? daysAway = user.LastDoseAt is DateTime last
                ? _streaks.TodayFor(user, nowUtc).DayNumber - _streaks.LocalDate(user, last).DayNumber
                : null;

            var message = ReminderCopy.Build(
                Courses.Get(user.CourseId), targets, dose.Items.Count, user.Why, daysAway);

            var outcome = await PushAsync(user.PushToken!, message, ct);
            if (outcome == PushOutcome.Sent)
            {
                user.LastNotifiedAt = nowUtc;
                sent++;
            }
            else if (outcome == PushOutcome.TokenDead)
            {
                // The app was uninstalled or the token rotated. Keeping it
                // would mean a failed request every minute of every window.
                user.PushToken = null;
            }
            // Anything else is transient: leave LastNotifiedAt alone and the
            // next tick retries, until the window closes.
        }

        await db.SaveChangesAsync(ct);
        return sent;
    }

    private enum PushOutcome { Sent, TokenDead, Failed }

    private async Task<PushOutcome> PushAsync(string token, ReminderCopy.Message message, CancellationToken ct)
    {
        var url = _config["Reminders:ExpoPushUrl"];
        if (string.IsNullOrWhiteSpace(url)) url = DefaultExpoUrl;

        try
        {
            var client = _http.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(10);

            using var response = await client.PostAsJsonAsync(url, new
            {
                to = token,
                title = message.Title,
                body = message.Body,
                sound = "default",
                // Lands in the Dose, not on the dashboard: one tap from the
                // lock screen to the first item.
                data = new { url = "polepole://dose" },
            }, ct);

            if (!response.IsSuccessStatusCode)
            {
                _log.LogWarning("Push service returned {Status}.", (int)response.StatusCode);
                return PushOutcome.Failed;
            }

            using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
            if (!json.RootElement.TryGetProperty("data", out var data)) return PushOutcome.Failed;

            // A single message comes back as one ticket; tolerate the array
            // form the batch API uses.
            var ticket = data.ValueKind == JsonValueKind.Array
                ? data.EnumerateArray().FirstOrDefault()
                : data;
            if (ticket.ValueKind != JsonValueKind.Object) return PushOutcome.Failed;

            var status = ticket.TryGetProperty("status", out var s) ? s.GetString() : null;
            if (status == "ok") return PushOutcome.Sent;

            var error = ticket.TryGetProperty("details", out var details)
                        && details.ValueKind == JsonValueKind.Object
                        && details.TryGetProperty("error", out var e)
                ? e.GetString()
                : null;

            _log.LogWarning("Push rejected: {Error}.", error ?? "unknown");
            return error == "DeviceNotRegistered" ? PushOutcome.TokenDead : PushOutcome.Failed;
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException)
        {
            if (ct.IsCancellationRequested) throw;
            _log.LogWarning(e, "Could not reach the push service.");
            return PushOutcome.Failed;
        }
    }
}
