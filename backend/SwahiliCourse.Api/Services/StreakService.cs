using SwahiliCourse.Api.Models;

namespace SwahiliCourse.Api.Services;

// The day streak: one place that decides what counts as a day and when a
// streak survives a miss.
//
// This used to live inside QuizController and fire only on a lesson quiz's
// first pass, which had two consequences worth naming:
//
//  - Review earned nothing, and once all 31 lessons were passed the streak
//    could never advance again. The gamification stopped working at exactly
//    the point a learner became a long-term user.
//  - Days were counted in UTC. Someone practising at 21:00 in Dar es Salaam
//    (UTC+3) was already on tomorrow's UTC date; someone at 20:00 in Mexico
//    City was still on yesterday's. Streaks broke for reasons invisible to the
//    learner, which is the fastest way to make a streak feel unfair.
//
// Both are fixed here: any practice counts (a dose or a quiz), and days are
// counted in the learner's own zone.
//
// See docs/DAILY-PRACTICE-LOOP.md.
public class StreakService
{
    // One rest day per seven. A single missed day is absorbed; miss twice and
    // the streak breaks, so the stake stays real. This is what stops a 40-day
    // streak dying because of one flight — removing the regret trap without
    // removing the stake.
    public const int RestDayCooldownDays = 7;

    public record StreakResult(
        int StreakCount,
        bool Advanced,
        bool RestDayUsed,
        bool AlreadyCountedToday);

    // The learner's zone, falling back to UTC for an id this machine does not
    // know. A bad zone must not take the API down, and UTC is what every
    // account held before time zones existed here.
    public TimeZoneInfo ZoneFor(User user)
    {
        if (string.IsNullOrWhiteSpace(user.TimeZoneId)) return TimeZoneInfo.Utc;
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(user.TimeZoneId);
        }
        catch (Exception e) when (e is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            return TimeZoneInfo.Utc;
        }
    }

    // What day it is where the learner is.
    public DateOnly TodayFor(User user, DateTime nowUtc) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(nowUtc, ZoneFor(user)));

    public DateOnly LocalDate(User user, DateTime instantUtc) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(
            DateTime.SpecifyKind(instantUtc, DateTimeKind.Utc), ZoneFor(user)));

    // Has the learner already finished a dose today, in their own zone?
    public bool HasDosedToday(User user, DateTime nowUtc) =>
        user.LastDoseAt is DateTime last && LocalDate(user, last) == TodayFor(user, nowUtc);

    // Record a day of practice. Idempotent within a day: the second dose or
    // quiz of the same day changes nothing.
    public StreakResult Record(User user, DateTime nowUtc)
    {
        var today = TodayFor(user, nowUtc);

        // LastActivityDate holds a calendar date in the learner's zone, not an
        // instant — which is why it is compared as a date and never converted.
        var last = user.LastActivityDate is DateTime d ? DateOnly.FromDateTime(d) : (DateOnly?)null;

        if (last is null)
        {
            user.StreakCount = 1;
            user.LastActivityDate = today.ToDateTime(TimeOnly.MinValue);
            return new StreakResult(user.StreakCount, Advanced: true, RestDayUsed: false, AlreadyCountedToday: false);
        }

        var gap = today.DayNumber - last.Value.DayNumber;

        // Same day, or a date earlier than the one already recorded — which a
        // learner flying west can genuinely produce. Never move the streak
        // backwards for it.
        if (gap <= 0)
            return new StreakResult(user.StreakCount, Advanced: false, RestDayUsed: false, AlreadyCountedToday: true);

        var restDayUsed = false;

        if (gap == 1)
        {
            user.StreakCount += 1;
        }
        else if (gap == 2 && RestDayAvailable(user, today))
        {
            // Exactly one missed day, and a rest day is going spare: bridge it.
            // The streak gains one for today rather than two — the forgiven day
            // was not practised, and claiming it was would be a lie told by a
            // counter the learner is supposed to trust.
            user.LastRestDayAt = nowUtc;
            user.StreakCount += 1;
            restDayUsed = true;
        }
        else
        {
            // Two or more missed days, or a miss with no rest day left.
            user.StreakCount = 1;
        }

        user.LastActivityDate = today.ToDateTime(TimeOnly.MinValue);
        return new StreakResult(user.StreakCount, Advanced: true, restDayUsed, AlreadyCountedToday: false);
    }

    // Rolling, not calendar-weekly: a rest day is available when none has been
    // spent in the last seven days. A weekly counter would hand out two in
    // quick succession across a week boundary.
    public bool RestDayAvailable(User user, DateOnly today)
    {
        if (user.LastRestDayAt is not DateTime spent) return true;
        return today.DayNumber - LocalDate(user, spent).DayNumber >= RestDayCooldownDays;
    }

    public bool RestDayAvailable(User user, DateTime nowUtc) =>
        RestDayAvailable(user, TodayFor(user, nowUtc));
}
