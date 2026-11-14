namespace SwahiliCourse.Api.Models;

// A proverb or idiom, in the language being learned plus its meaning.
//
// Unlike vocabulary, a methali is not keyed on its own text: the text is long
// and gets edited for wording, and a card should survive that. It is keyed on
// its position in the course's methali file instead, so appending to the file
// is safe and reordering it is not.
public class Methali
{
    // Set by the catalog from the file order; not present in the JSON.
    public int Index { get; set; }

    // The proverb, in the language being learned.
    public string Target { get; set; } = string.Empty;

    // What it means, in the language the learner already speaks.
    public string Source { get; set; } = string.Empty;

    // One line of context: where it is used, or what it literally says. This is
    // what makes a proverb repeatable to another person rather than just
    // another phrase to memorise.
    public string Note { get; set; } = string.Empty;

    public string Key => $"{ItemKinds.Methali}:{Index}";
}
