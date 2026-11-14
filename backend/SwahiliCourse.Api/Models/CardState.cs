namespace SwahiliCourse.Api.Models;

// Per-item review state — the memory the daily Dose is built from.
//
// LessonProgress tracks whole lessons; this tracks the individual things inside
// them, which is what makes a review queue possible: answering an item moves its
// due date, and tomorrow's Dose is assembled from what has come due. Unlike the
// 31 lessons, the queue never empties.
//
// See docs/DAILY-PRACTICE-LOOP.md.
public class CardState
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    // An account is fixed to one course direction, but the column is carried
    // anyway so a restart (or a future second direction) can't resurrect the
    // other direction's cards.
    public string CourseId { get; set; } = Courses.Default;

    // Stable identity for the item, in the language being learned: the target
    // side of a vocab pair ("maji"), so the same word met again in a later
    // lesson is the same card rather than a second copy of it. Later kinds get
    // a prefix — "methali:<n>", "phrase:<lessonId>:<n>".
    public string ItemKey { get; set; } = string.Empty;

    // "vocab" today; "phrase" | "methali" once those pools exist.
    public string ItemKind { get; set; } = ItemKinds.Vocab;

    // The lesson this item was first met in — for attribution in the UI, not
    // for scheduling.
    public int SourceLessonId { get; set; }

    // Leitner box; ReviewScheduler.Intervals maps it to a wait in days.
    public int Box { get; set; }
    public DateTime DueAt { get; set; } = DateTime.UtcNow;

    // Times this item was known and then forgotten. A high count is the signal
    // for a leech — an item that keeps coming back and should be reworked
    // rather than drilled.
    public int Lapses { get; set; }

    // 0..100, shown to the learner as the strength bar.
    public int Strength { get; set; }

    // "Nitakumbuka hii" — pinned items get priority in future Doses.
    public bool Pinned { get; set; }

    public DateTime? LastSeenAt { get; set; }

    // Best word-match score the Whisper sidecar has returned for this item.
    public int BestSpeechScore { get; set; }
}

public static class ItemKinds
{
    public const string Vocab = "vocab";
    public const string Phrase = "phrase";
    public const string Methali = "methali";
}

// How a single item is put to the learner in a Dose. The kind is what the item
// *is*; the exercise is what you're asked to do with it today.
public static class DoseExercises
{
    // Recognise: target word shown, pick its meaning.
    public const string Tambua = "tambua";
    // Produce: meaning shown, pick the target word.
    public const string Tunga = "tunga";
    // Speak: say the target word aloud, scored by the Whisper sidecar.
    public const string Sema = "sema";
    // Receive: a proverb handed to the learner, with its meaning. Not a test
    // — reading it is the interaction — and it joins the queue afterwards.
    public const string Methali = "methali";
}
