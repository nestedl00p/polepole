namespace SwahiliCourse.Api.Models;

// A pronunciation attempt the learner chose to keep.
//
// Kept so that weeks later the app can play the first "ninahitaji" against
// today's — an asset that exists nowhere else and grows more valuable the
// longer someone stays. Saving is always an explicit tap; nothing is recorded
// to the server otherwise.
//
// The audio itself is a file on disk (see VoiceStore); this row is its index.
public class VoiceTake
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public string CourseId { get; set; } = Courses.Default;

    // The card this was a take of, and the text that was said.
    public string ItemKey { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;

    // Word-match score the Whisper sidecar gave it, 0..100.
    public int Score { get; set; }

    public string ContentType { get; set; } = "audio/webm";
    // File name inside the learner's own folder — generated, never client-supplied.
    public string FileName { get; set; } = string.Empty;
    public long SizeBytes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
