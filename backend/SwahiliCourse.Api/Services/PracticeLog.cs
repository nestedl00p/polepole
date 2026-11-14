using Microsoft.EntityFrameworkCore;
using SwahiliCourse.Api.Data;
using SwahiliCourse.Api.DTOs;
using SwahiliCourse.Api.Models;

namespace SwahiliCourse.Api.Services;

// Writes and reads the per-day practice record (PracticeDay).
//
// Everything the habit test asks is answered from here: did the learner open
// the Dose, did they open it before the reminder, did they finish, how long it
// took. Callers add to the context and leave saving to the request that owns
// the unit of work, so a day's row and the streak it belongs to commit together.
//
// See docs/DAILY-PRACTICE-LOOP.md, "Habit testing".
public class PracticeLog
{
    // Fourteen days running of starting unprompted is the point at which the
    // app offers to stop reminding.
    public const int UnpromptedRunForOffer = 14;

    public const int StripDays = 7;

    private readonly AppDbContext _db;
    private readonly StreakService _streaks;

    public PracticeLog(AppDbContext db, StreakService streaks)
    {
        _db = db;
        _streaks = streaks;
    }

    private async Task<PracticeDay> DayAsync(User user, DateOnly day, CancellationToken ct)
    {
        var row = await _db.PracticeDays.FirstOrDefaultAsync(d => d.UserId == user.Id && d.Day == day, ct);
        if (row is null)
        {
            row = new PracticeDay { UserId = user.Id, Day = day };
            _db.PracticeDays.Add(row);
        }
        return row;
    }

    // Was a reminder sent (or shown by the browser) earlier today, where the
    // learner is? That is the whole definition of a prompted open.
    public bool RemindedToday(User user, DateTime nowUtc) =>
        user.LastNotifiedAt is DateTime sent
        && sent <= nowUtc
        && _streaks.LocalDate(user, sent) == _streaks.TodayFor(user, nowUtc);

    // The Dose screen was opened. Only the first open of the day is recorded:
    // whether the day was prompted is a fact about how it started.
    public async Task<PracticeDay> OpenAsync(User user, DateTime nowUtc, CancellationToken ct = default)
    {
        var row = await DayAsync(user, _streaks.TodayFor(user, nowUtc), ct);
        if (row.DoseOpenedAt is null)
        {
            row.DoseOpenedAt = nowUtc;
            row.OpenedUnprompted = !RemindedToday(user, nowUtc);
        }
        return row;
    }

    // First completion of the day. Later "endelea" rounds leave it alone, so
    // the duration measured is that of the dose itself and not of however long
    // the learner chose to stay afterwards.
    public async Task<PracticeDay> CompleteAsync(
        User user, DateTime nowUtc, int itemsAnswered, CancellationToken ct = default)
    {
        var row = await DayAsync(user, _streaks.TodayFor(user, nowUtc), ct);
        if (row.DoseCompletedAt is null)
        {
            row.DoseCompletedAt = nowUtc;
            row.ItemsAnswered = itemsAnswered;
            if (row.DoseOpenedAt is DateTime opened && opened <= nowUtc)
                row.DurationSeconds = (int)Math.Min((nowUtc - opened).TotalSeconds, int.MaxValue);
        }
        return row;
    }

    public async Task QuizPassedAsync(User user, DateTime nowUtc, CancellationToken ct = default)
    {
        var row = await DayAsync(user, _streaks.TodayFor(user, nowUtc), ct);
        row.QuizPassedAt ??= nowUtc;
    }

    // The last seven days, oldest first. Reads rows already added to the
    // context in this request as well as saved ones, so a strip built straight
    // after completing shows today filled in.
    public async Task<List<PracticeDayDto>> WeekAsync(User user, DateTime nowUtc, CancellationToken ct = default)
    {
        var today = _streaks.TodayFor(user, nowUtc);
        var from = today.AddDays(-(StripDays - 1));

        var saved = await _db.PracticeDays
            .Where(d => d.UserId == user.Id && d.Day >= from && d.Day <= today)
            .ToListAsync(ct);

        var rows = saved
            .Concat(_db.PracticeDays.Local.Where(d => d.UserId == user.Id && d.Day >= from && d.Day <= today))
            .Distinct()
            .ToList();

        var practised = rows
            .Where(d => d.DoseCompletedAt != null || d.QuizPassedAt != null)
            .Select(d => d.Day)
            .ToHashSet();

        return Enumerable.Range(0, StripDays)
            .Select(i => from.AddDays(i))
            .Select(day => new PracticeDayDto(day.ToString("yyyy-MM-dd"), practised.Contains(day), day == today))
            .ToList();
    }

    // How many days in a row, ending today, the learner opened the Dose before
    // being reminded. A day with no open at all ends the run.
    public async Task<int> UnpromptedRunAsync(User user, DateTime nowUtc, CancellationToken ct = default)
    {
        var today = _streaks.TodayFor(user, nowUtc);
        var from = today.AddDays(-(UnpromptedRunForOffer - 1));

        var saved = await _db.PracticeDays
            .Where(d => d.UserId == user.Id && d.Day >= from && d.Day <= today)
            .ToListAsync(ct);

        var unprompted = saved
            .Concat(_db.PracticeDays.Local.Where(d => d.UserId == user.Id))
            .Where(d => d.DoseOpenedAt != null && d.OpenedUnprompted)
            .Select(d => d.Day)
            .ToHashSet();

        var run = 0;
        for (var day = today; unprompted.Contains(day); day = day.AddDays(-1)) run++;
        return run;
    }
}
