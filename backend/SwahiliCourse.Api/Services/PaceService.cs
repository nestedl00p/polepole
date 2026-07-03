using SwahiliCourse.Api.Models;

namespace SwahiliCourse.Api.Services;

// Computes pacing: given a user's chosen plan length and start date,
// works out which lesson "day" they should currently be on, and whether
// a given lesson is unlocked.
public class PaceService
{
    private readonly LessonCatalog _catalog;
    public PaceService(LessonCatalog catalog) => _catalog = catalog;

    // The 30 lessons are spread evenly across PlanLengthDays.
    // e.g. 30 lessons over 60 days = a new lesson roughly every 2 days.
    public int LessonsPerCalendarDay(User user)
    {
        return _catalog.TotalLessons; // total, used with ratio below
    }

    // Which lesson number the user is scheduled to have reached today (1-based, capped at total).
    public int CurrentScheduledDay(User user)
    {
        var daysElapsed = (DateTime.UtcNow.Date - user.StartDate.Date).Days;
        if (daysElapsed < 0) daysElapsed = 0;

        var total = _catalog.TotalLessons;          // 30
        var plan = Math.Max(user.PlanLengthDays, total >= 1 ? 1 : 1);

        // ratio of lessons to calendar days; at least lesson 1 from day 0.
        double lessonsPerDay = (double)total / plan;
        int scheduled = (int)Math.Floor(daysElapsed * lessonsPerDay) + 1;

        return Math.Clamp(scheduled, 1, total);
    }

    // A lesson is unlocked if:
    //  (a) it's within the scheduled window for today, AND
    //  (b) the previous lesson's quiz has been passed (sequential unlock).
    // Lesson 1 is always unlocked.
    public bool IsUnlocked(User user, int lessonId, IDictionary<int, LessonProgress> progressByLesson)
    {
        if (lessonId <= 1) return true;

        // Previous lesson must be completed (quiz passed).
        if (!progressByLesson.TryGetValue(lessonId - 1, out var prev) || !prev.QuizCompleted)
            return false;

        // And it must be within (or before) the scheduled day so users can't sprint
        // far ahead of their chosen pace - but they're free to go at or behind schedule.
        // We allow up to scheduled day; learners can always slow down, never forced faster.
        return lessonId <= CurrentScheduledDay(user) || AllowAhead;
    }

    // If you'd rather let motivated users race ahead regardless of the calendar,
    // flip this to true. Sequential unlock (passing the prior quiz) still applies.
    public bool AllowAhead { get; set; } = true;
}
