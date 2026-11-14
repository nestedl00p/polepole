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

    // The learner's IANA time zone ("Africa/Dar_es_Salaam"), sent by the client.
    // Streak days are counted in this zone rather than UTC. Defaults to UTC so
    // accounts that predate this behave exactly as they did before.
    public string TimeZoneId { get; set; } = "UTC";

    // Gamification
    public int StreakCount { get; set; } = 0;
    // A calendar date in the learner's own zone, not an instant — the day the
    // streak was last credited.
    public DateTime? LastActivityDate { get; set; }

    // When the last rest day was spent, so one can be offered every 7 days.
    public DateTime? LastRestDayAt { get; set; }

    // When the last dose was completed, so a client can tell whether today is
    // already done without replaying the queue.
    public DateTime? LastDoseAt { get; set; }
    public int TotalXp { get; set; } = 0;

    // Comma-separated keys of milestones already shown, so none is handed out
    // twice and adding new thresholds later does not fire every one of them at
    // a long-standing learner.
    public string MilestonesSeen { get; set; } = string.Empty;

    public ICollection<LessonProgress> Progress { get; set; } = new List<LessonProgress>();
    public ICollection<CardState> Cards { get; set; } = new List<CardState>();
}
