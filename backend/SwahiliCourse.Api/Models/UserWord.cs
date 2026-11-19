namespace SwahiliCourse.Api.Models;

// A word the learner added themselves, from something they were reading.
//
// Every other card gets its meaning from the lesson catalog; CardState only
// carries a key and a schedule. A word the course never taught has no catalog
// entry to look up, so its two sides live here. Its review state is still an
// ordinary CardState with the same key (ItemKind "own"), which is what puts it
// in the flashcard deck and the daily Dose alongside the course's words.
public class UserWord
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public string CourseId { get; set; } = Courses.Default;

    // The dictionary form, in the language being learned. This is the card's
    // key (CardState.ItemKey), so one word is one card however many inflected
    // forms of it the learner taps.
    public string Target { get; set; } = string.Empty;

    // Its meaning, in the language the learner reads the course in.
    public string Source { get; set; } = string.Empty;

    // The form as it stood in the text ("ninakupenda" for "kupenda"), and the
    // sentence it stood in — what makes the card a memory of something read
    // rather than a dictionary entry.
    public string SeenAs { get; set; } = string.Empty;
    public string Context { get; set; } = string.Empty;

    // One line on how the seen form is built, when it differs from Target.
    public string Note { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
