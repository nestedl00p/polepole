using SwahiliCourse.Api.Models;

namespace SwahiliCourse.Api.Services;

// What an answer is worth.
//
// The numbers are small and every one of them carries jitter, because the point
// is not the quantity — it is that the learner cannot add up the total before
// they finish. The old lesson award was XpReward × accuracy, paid once on a
// quiz's first pass: exactly predictable, and therefore worth nothing as a
// reward after the second time you saw it.
//
// The jitter is a genuine random number, unlike the strength bar, which is
// driven by how the answer actually went. That difference is deliberate:
// strength is a claim about what the learner knows and must stay honest, while
// XP is a token and can afford to be playful.
//
// See docs/DAILY-PRACTICE-LOOP.md.
public static class DoseXp
{
    // Recognising is the cheapest item, producing costs more thought, saying it
    // out loud costs the most.
    private static int Base(string exercise) => exercise switch
    {
        DoseExercises.Tambua => 4,
        DoseExercises.Tunga => 6,
        DoseExercises.Sema => 8,
        DoseExercises.Methali => 10,
        _ => 4,
    };

    private const int MaxJitter = 3;
    private const int CompletionBase = 5;
    private const int CompletionJitter = 5;

    // One answered item. Quality is ReviewScheduler.Quality — so a fast, sure
    // answer pays more than a slow one, and a wrong answer still pays the
    // jitter rather than nothing, because turning up for an item you got wrong
    // is the behaviour worth keeping.
    public static int ForAnswer(string exercise, bool correct, double quality, Random rng)
    {
        var jitter = rng.Next(0, MaxJitter + 1);
        if (!correct) return jitter;

        var earned = Base(exercise) * (0.6 + 0.4 * quality);
        return (int)Math.Round(earned) + jitter;
    }

    // Paid once per day, for closing the dose rather than for how much was in it.
    public static int ForCompletion(Random rng) =>
        CompletionBase + rng.Next(0, CompletionJitter + 1);
}
