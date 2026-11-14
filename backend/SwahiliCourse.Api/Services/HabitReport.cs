using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SwahiliCourse.Api.Data;
using SwahiliCourse.Api.Models;

namespace SwahiliCourse.Api.Services;

// Reads the habit test: has a habit formed, and for whom?
//
// The five numbers below are the targets the design sets for the first cohort.
// They are computed from PracticeDay rows rather than from page views, because
// the claim being tested is specific — that learners come back *without being
// asked* — and only the per-day record of open-versus-reminder can answer it.
//
// Definitions, since each of these can be counted more than one way:
//
//  - Completion rate: of the days a dose was opened, the share on which it
//    was also finished. A completion with no recorded open (an older client
//    that never reports one) is left out rather than pushing the rate past 1.
//  - Median duration: open → first completion, over days that have both.
//  - D7 unprompted: of learners at least 7 days old, the share who opened a
//    dose unprompted on their 7th day (sign-up day is day 0).
//  - D30 habitual: of learners at least 30 days old, the share with 5 or more
//    unprompted opens in the last 7 days.
//  - Doses per lesson: doses finished ÷ lesson quizzes passed.
//
// Days are each learner's own calendar days, the same ones the streak counts.
//
// See docs/DAILY-PRACTICE-LOOP.md, "Habit testing".
public class HabitReport
{
    public const int HabitualOpens = 5;
    public const int HabitualWindowDays = 7;

    private readonly AppDbContext _db;
    private readonly StreakService _streaks;

    public HabitReport(AppDbContext db, StreakService streaks)
    {
        _db = db;
        _streaks = streaks;
    }

    public record Targets(
        string CompletionRate, string MedianDurationSeconds, string D7UnpromptedRate,
        string D30HabitualRate, string DosesPerLesson);

    public record Cohort(
        // ISO week of sign-up, "2026-W46". "all" for the roll-up.
        string SignupWeek, int Learners,
        int DaysOpened, int DaysCompleted, double? CompletionRate,
        int? MedianDurationSeconds,
        int D7Eligible, int D7Unprompted, double? D7UnpromptedRate,
        int D30Eligible, int D30Habitual, double? D30HabitualRate,
        int LessonsCompleted, double? DosesPerLesson,
        // The hypothesised habit path, as counts of learners who took each step.
        int FirstDoseWithinHour, int ChoseReminderTime, int PinnedInWeekOne, int SevenDaysRunning,
        Dictionary<string, int> Why);

    public record Report(DateTime GeneratedAt, Targets Targets, Cohort All, List<Cohort> BySignupWeek, List<string> HabitAnswers);

    public async Task<Report> BuildAsync(DateTime nowUtc, CancellationToken ct = default)
    {
        // Whole-table reads: this is an occasional report over a beta-sized
        // user base, not a request path. Move it to SQL aggregates before the
        // tables stop fitting comfortably in memory.
        var users = await _db.Users.AsNoTracking().ToListAsync(ct);
        var days = (await _db.PracticeDays.AsNoTracking().ToListAsync(ct)).ToLookup(d => d.UserId);
        var lessonsDone = (await _db.LessonProgress.AsNoTracking()
                .Where(p => p.QuizCompleted)
                .Select(p => p.UserId)
                .ToListAsync(ct))
            .GroupBy(id => id).ToDictionary(g => g.Key, g => g.Count());
        var pins = (await _db.CardStates.AsNoTracking()
                .Where(c => c.PinnedAt != null)
                .Select(c => new { c.UserId, c.PinnedAt })
                .ToListAsync(ct))
            .ToLookup(c => c.UserId, c => c.PinnedAt!.Value);

        Cohort Summarise(string label, List<User> cohort)
        {
            int opened = 0, finishedOfOpened = 0, completed = 0, d7Eligible = 0, d7 = 0, d30Eligible = 0, d30 = 0;
            int lessons = 0, firstHour = 0, choseTime = 0, pinnedEarly = 0, sevenRunning = 0;
            var durations = new List<int>();
            var why = new Dictionary<string, int>(StringComparer.Ordinal);

            foreach (var u in cohort)
            {
                var mine = days[u.Id].ToList();
                var signup = _streaks.LocalDate(u, u.CreatedAt);
                var today = _streaks.TodayFor(u, nowUtc);
                var age = today.DayNumber - signup.DayNumber;

                opened += mine.Count(d => d.DoseOpenedAt != null);
                finishedOfOpened += mine.Count(d => d.DoseOpenedAt != null && d.DoseCompletedAt != null);
                completed += mine.Count(d => d.DoseCompletedAt != null);
                durations.AddRange(mine.Where(d => d.DurationSeconds != null).Select(d => d.DurationSeconds!.Value));

                var unprompted = mine
                    .Where(d => d.DoseOpenedAt != null && d.OpenedUnprompted)
                    .Select(d => d.Day)
                    .ToHashSet();

                if (age >= 7)
                {
                    d7Eligible++;
                    if (unprompted.Contains(signup.AddDays(7))) d7++;
                }

                if (age >= 30)
                {
                    d30Eligible++;
                    var from = today.AddDays(-(HabitualWindowDays - 1));
                    if (unprompted.Count(day => day >= from && day <= today) >= HabitualOpens) d30++;
                }

                lessons += lessonsDone.GetValueOrDefault(u.Id);

                if (mine.Any(d => d.DoseCompletedAt is DateTime done && (done - u.CreatedAt).TotalHours <= 1)) firstHour++;
                if (u.ReminderChosenAt != null) choseTime++;
                if (pins[u.Id].Any(at => (at - u.CreatedAt).TotalDays <= 7)) pinnedEarly++;
                if (LongestRun(mine.Where(d => d.DoseCompletedAt != null).Select(d => d.Day)) >= 7) sevenRunning++;

                var key = u.Why ?? "unset";
                why[key] = why.GetValueOrDefault(key) + 1;
            }

            return new Cohort(
                label, cohort.Count,
                opened, completed, Ratio(finishedOfOpened, opened),
                Median(durations),
                d7Eligible, d7, Ratio(d7, d7Eligible),
                d30Eligible, d30, Ratio(d30, d30Eligible),
                lessons, Ratio(completed, lessons),
                firstHour, choseTime, pinnedEarly, sevenRunning, why);
        }

        var byWeek = users
            .GroupBy(u => IsoWeek(u.CreatedAt))
            .OrderBy(g => g.Key, StringComparer.Ordinal)
            .Select(g => Summarise(g.Key, g.ToList()))
            .ToList();

        var answers = users
            .Where(u => !string.IsNullOrWhiteSpace(u.HabitAnswer))
            .Select(u => u.HabitAnswer!)
            .ToList();

        return new Report(
            nowUtc,
            new Targets("> 0.85", "75–120", "> 0.20", "> 0.05", "> 4"),
            Summarise("all", users), byWeek, answers);
    }

    private static double? Ratio(int numerator, int denominator) =>
        denominator == 0 ? null : Math.Round((double)numerator / denominator, 3);

    private static int? Median(List<int> values)
    {
        if (values.Count == 0) return null;
        values.Sort();
        var mid = values.Count / 2;
        return values.Count % 2 == 1 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
    }

    private static int LongestRun(IEnumerable<DateOnly> days)
    {
        var best = 0;
        var run = 0;
        DateOnly? previous = null;
        foreach (var day in days.Distinct().OrderBy(d => d))
        {
            run = previous is DateOnly p && day.DayNumber - p.DayNumber == 1 ? run + 1 : 1;
            best = Math.Max(best, run);
            previous = day;
        }
        return best;
    }

    private static string IsoWeek(DateTime instant) =>
        $"{ISOWeek.GetYear(instant)}-W{ISOWeek.GetWeekOfYear(instant):00}";
}
