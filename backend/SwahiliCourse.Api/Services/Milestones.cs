using SwahiliCourse.Api.DTOs;

namespace SwahiliCourse.Api.Services;

// Thresholds the learner was not counting toward.
//
// A progress bar the learner can watch fill is predictable and stops paying
// out. These are not shown anywhere until one is crossed, so they arrive as
// news — which is the whole reason they exist.
//
// Each is awarded once. User.MilestonesSeen records the keys so a card cannot
// be handed out twice, and so adding new thresholds later does not
// retroactively fire every one of them at a long-standing learner — it fires
// only the ones they have genuinely just crossed.
public static class Milestones
{
    public record Threshold(string Key, int At, string Title, string Detail);

    // Words met: anything that has survived at least one review.
    private static readonly int[] MetWords = { 10, 25, 50, 100, 200, 400 };

    // Words at the top box — known well enough to go 35 days between reviews.
    private static readonly int[] MasteredWords = { 1, 10, 25, 50, 100 };

    // Proverbs collected.
    private static readonly int[] Methali = { 1, 5, 10, 20 };

    public static List<MilestoneDto> CrossedBy(
        int metWords, int masteredWords, int methaliCollected, ISet<string> alreadySeen)
    {
        var crossed = new List<MilestoneDto>();

        void Check(string prefix, IEnumerable<int> thresholds, int actual, Func<int, (string, string)> copy)
        {
            foreach (var at in thresholds)
            {
                if (actual < at) continue;
                var key = $"{prefix}:{at}";
                if (!alreadySeen.Add(key)) continue;
                var (title, detail) = copy(at);
                crossed.Add(new MilestoneDto(key, title, detail));
            }
        }

        Check("met", MetWords, metWords, at => (
            $"{at} words",
            "That many are in your review queue now, coming back on their own schedule."));

        Check("mastered", MasteredWords, masteredWords, at => (
            at == 1 ? "First word mastered" : $"{at} words mastered",
            at == 1
                ? "It reached the top box — you will not see it again for over a month."
                : $"{at} words are at full strength, more than a month between reviews."));

        Check("methali", Methali, methaliCollected, at => (
            at == 1 ? "First methali" : $"{at} methali",
            at == 1
                ? "A proverb is the one thing here you can repeat to someone else today."
                : $"{at} proverbs collected. Try one out loud on someone."));

        return crossed;
    }

    public static HashSet<string> Parse(string? seen) =>
        string.IsNullOrWhiteSpace(seen)
            ? new HashSet<string>(StringComparer.Ordinal)
            : new HashSet<string>(seen.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
                StringComparer.Ordinal);

    public static string Serialize(IEnumerable<string> keys) => string.Join(',', keys);
}
