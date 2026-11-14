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

    // How an answer went. ElapsedMs is how long the learner took to answer,
    // measured by the client from the moment the item appeared.
    public record Answer(bool Correct, int? ElapsedMs = null, int? SpeechScore = null);

    // A tap answered this fast was known, not worked out.
    private const int FastMs = 2_500;
    // Past this the learner was reconstructing it, or distracted.
    private const int SlowMs = 9_000;

    // What each box is worth on the learner's 0..100 strength bar. Reaching the
    // top box means "known", not "finished" — it still comes back every 35 days.
    private static int BoxStrength(int box) =>
        (int)Math.Round(100.0 * box / MaxBox);

    // 0..1, how convincing the answer was. Correctness is most of it; speed and
    // (for a spoken item) the pronunciation score decide the rest.
    //
    // This is what makes the strength bar move by an amount the learner cannot
    // predict while still being entirely earned — the variability comes from
    // how they actually answered, never from a random number. A bar that moved
    // randomly would be a lie told by the one number the learner is meant to
    // read.
    public static double Quality(Answer answer)
    {
        if (!answer.Correct) return 0;

        // No timing from the client: assume a middling answer rather than
        // rewarding or punishing a client that did not report.
        var speed = 0.5;
        if (answer.ElapsedMs is int ms)
        {
            if (ms <= FastMs) speed = 1.0;
            else if (ms >= SlowMs) speed = 0.0;
            else speed = 1.0 - (double)(ms - FastMs) / (SlowMs - FastMs);
        }

        // A spoken item carries its own measure of how well it went.
        if (answer.SpeechScore is int score)
        {
            var said = Math.Clamp((score - 50) / 50.0, 0, 1);
            return Math.Clamp(0.5 + 0.3 * said + 0.2 * speed, 0, 1);
        }

        return Math.Clamp(0.6 + 0.4 * speed, 0, 1);
    }

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
    public CardState Grade(CardState card, Answer answer, DateTime now)
    {
        if (answer.Correct)
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

        // Strength chases the new box's level rather than snapping to it, and a
        // sharper answer closes more of the gap. So the bar always moves, and
        // how far is the part the learner cannot call in advance.
        var quality = Quality(answer);
        var target = BoxStrength(card.Box);
        var pull = 0.55 + 0.45 * quality;
        card.Strength = Math.Clamp(
            (int)Math.Round(card.Strength + (target - card.Strength) * pull), 0, 100);

        card.DueAt = now.AddDays(Intervals[card.Box]);
        card.LastSeenAt = now;

        if (answer.SpeechScore is int speech && speech > card.BestSpeechScore)
            card.BestSpeechScore = Math.Clamp(speech, 0, 100);

        return card;
    }

    public int IntervalDays(CardState card) => Intervals[Math.Clamp(card.Box, 0, MaxBox)];
}
