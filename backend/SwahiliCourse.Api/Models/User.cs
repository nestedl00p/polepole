namespace SwahiliCourse.Api.Models;

public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;

    // Which course direction this account is learning ("sw" = Swahili for English
    // speakers, "en" = English for Swahili speakers). Chosen at registration and
    // fixed for the account, so LessonProgress (UserId, LessonId) never collides
    // between directions. Existing rows default to the original Swahili course.
    public string CourseId { get; set; } = Courses.Default;

    // Pacing: total number of days the learner wants to spread the 30 lessons over.
    // Defaults to 30 (one lesson per day) but can be extended (e.g. 60, 90).
    public int PlanLengthDays { get; set; } = 30;

    // When the learner started the course. Used to compute which day they "should" be on.
    public DateTime StartDate { get; set; } = DateTime.UtcNow;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Gamification
    public int StreakCount { get; set; } = 0;
    public DateTime? LastActivityDate { get; set; }
    public int TotalXp { get; set; } = 0;

    public ICollection<LessonProgress> Progress { get; set; } = new List<LessonProgress>();
}
