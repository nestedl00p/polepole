namespace SwahiliCourse.Api.Models;

// One row per learner per calendar day in their own zone — what they did with
// the Dose that day.
//
// This is the habit-test instrument. User.LastDoseAt can say whether today is
// done, but not what happened last Tuesday, and the question the design turns
// on is a per-day one: did they open the Dose, and did they open it before the
// day's reminder fired? It is also what draws the last-7-days strip.
//
// See docs/DAILY-PRACTICE-LOOP.md, "Habit testing".
public class PracticeDay
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    // A calendar date where the learner was, not an instant.
    public DateOnly Day { get; set; }

    // First time the Dose screen was opened that day. Loading the dashboard
    // does not count — the hero fetches the dose too, and counting that would
    // make every visit an "open".
    public DateTime? DoseOpenedAt { get; set; }

    // True when that first open came before any reminder had gone out that day.
    // Decided once, at the first open, and never revised: a reminder that
    // arrives after the learner already started did not prompt them.
    public bool OpenedUnprompted { get; set; }

    // First completion that day; "endelea" rounds do not move it.
    public DateTime? DoseCompletedAt { get; set; }
    public int ItemsAnswered { get; set; }

    // Open → first completion, for the median-duration target (75–120s).
    public int? DurationSeconds { get; set; }

    // A lesson quiz passed that day. The streak credits it, so the strip has to
    // show it or the two would disagree.
    public DateTime? QuizPassedAt { get; set; }
}
