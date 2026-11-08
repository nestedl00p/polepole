using SwahiliCourse.Api.Models;

namespace SwahiliCourse.Api.Services;

// Spaced repetition over Leitner boxes: a right answer moves an item up a box
// and so further into the future, a wrong answer moves it down and brings it
// back soon.
//
// Deliberately not SM-2. At this deck size (a few hundred words) the interval
// ladder performs about as well, and it has the large advantage of being
// explainable to the learner — "box 4, back in 16 days" — where an ease factor
// is not.
public class ReviewScheduler
{
    // Wait in days for boxes 0..5. Box 0 is "due again this session".
    public static readonly int[] Intervals = { 0, 1, 3, 7, 16, 35 };

    public static int MaxBox => Intervals.Length - 1;

    // What each box is worth on the learner's 0..100 strength bar. Reaching the
    // top box means "known", not "finished" — it still comes back every 35 days.
    private static int BoxStrength(int box) =>
        (int)Math.Round(100.0 * box / MaxBox);

    // Create the state for an item the learner is meeting for the first time.
    public CardState NewCard(int userId, string courseId, string itemKey, string itemKind, int sourceLessonId) =>
        new()
        {
            UserId = userId,
            CourseId = courseId,
            ItemKey = itemKey,
            ItemKind = itemKind,
            SourceLessonId = sourceLessonId,
            Box = 0,
            DueAt = DateTime.UtcNow,
            Strength = 0,
        };

    // Apply one answer. Returns the card so callers can read the new strength.
    //
    // speechScore is the Whisper word-match percentage for a spoken item, and is
    // null for the tap-only exercises.
    public CardState Grade(CardState card, bool correct, int? speechScore, DateTime now)
    {
        if (correct)
        {
            // One box at a time, even on a perfect answer: skipping boxes is how
            // an item gets a 35-day interval it hasn't earned and then lapses.
            card.Box = Math.Min(card.Box + 1, MaxBox);
        }
        else
        {
            // Down one box rather than back to zero. A single slip on a word
            // you've known for a month shouldn't cost the whole month, and
            // Lapses already records that it happened.
            if (card.Box > 0) card.Lapses++;
            card.Box = Math.Max(card.Box - 1, 0);
        }

        card.Strength = BoxStrength(card.Box);
        card.DueAt = now.AddDays(Intervals[card.Box]);
        card.LastSeenAt = now;

        if (speechScore is int score && score > card.BestSpeechScore)
            card.BestSpeechScore = Math.Clamp(score, 0, 100);

        return card;
    }

    public int IntervalDays(CardState card) => Intervals[Math.Clamp(card.Box, 0, MaxBox)];
}
