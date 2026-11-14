using SwahiliCourse.Api.Models;

namespace SwahiliCourse.Api.Services;

// What a reminder says.
//
// It names the content — the actual words waiting in today's dose — and never
// the streak. "Don't lose your 12-day streak!" converts in the short term and
// manufactures regret, which is the one thing the design's ethics section rules
// out: the streak is a record of something true, not leverage. If this copy is
// ever "improved" to mention it, that is a regression, not a growth win.
//
// Written in the language the learner reads the course in, which is the
// opposite of the one they are learning.
//
// See docs/DAILY-PRACTICE-LOOP.md, "External triggers".
public static class ReminderCopy
{
    public const string Trip = "trip";
    public const string Family = "family";
    public const string Work = "work";
    public const string Curiosity = "curiosity";

    public static readonly IReadOnlySet<string> Whys =
        new HashSet<string>(StringComparer.Ordinal) { Trip, Family, Work, Curiosity };

    // After this many days away the copy reaches for the learner's own reason
    // rather than for the words, because the words are no longer fresh enough
    // to pull.
    public const int LapseDays = 3;

    // Words named in the body. Three is enough to be specific and still fit a
    // lock screen.
    private const int WordsNamed = 3;

    public record Message(string Title, string Body);

    public static Message Build(Course course, IReadOnlyList<string> targets, int itemCount, string? why, int? daysSinceLastDose)
    {
        var swahiliReader = course.SourceLanguage == "sw";
        var words = string.Join(", ", targets.Where(t => !string.IsNullOrWhiteSpace(t)).Take(WordsNamed));
        var tail = words.Length > 0 ? $" {words}…" : string.Empty;

        var size = swahiliReader
            ? $"Kadi {itemCount}, sekunde 90."
            : $"{itemCount} cards, 90 seconds.";

        var lapsed = daysSinceLastDose is int away && away >= LapseDays;
        var reason = lapsed ? WhyLine(why, swahiliReader) : null;

        var body = reason is null ? $"{size}{tail}" : $"{reason} {size}{tail}";
        return new Message("Dose ya leo", body);
    }

    // The learner's own stated reason, handed back to them. Curiosity gets no
    // line: "you started this out of curiosity" is not a reason to come back.
    private static string? WhyLine(string? why, bool swahiliReader) => (why, swahiliReader) switch
    {
        (Trip, false) => "You started this for the trip.",
        (Family, false) => "You started this for family.",
        (Work, false) => "You started this for work.",
        (Trip, true) => "Ulianza kwa ajili ya safari.",
        (Family, true) => "Ulianza kwa ajili ya familia.",
        (Work, true) => "Ulianza kwa ajili ya kazi.",
        _ => null,
    };
}
