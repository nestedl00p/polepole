using SwahiliCourse.Api.Models;

namespace SwahiliCourse.Api.Services;

// Computes pacing: given a user's chosen plan length and start date,
// works out which lesson "day" they should currently be on, and whether
// a given lesson is unlocked.
public class PaceService
{
    private readonly CourseCatalog _courses;
    public PaceService(CourseCatalog courses) => _courses = courses;

    // Lesson count for the user's own course direction.
    public int TotalLessons(User user) => _courses.For(user.CourseId).TotalLessons;

    // Which lesson number the user is scheduled to have reached today (1-based, capped at total).
    public int CurrentScheduledDay(User user)
    {
        var daysElapsed = (DateTime.UtcNow.Date - user.StartDate.Date).Days;
        if (daysElapsed < 0) daysElapsed = 0;

        var total = TotalLessons(user);
        if (total <= 0) return 1;                   // course content not authored yet
        var plan = Math.Max(user.PlanLengthDays, 1);

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
