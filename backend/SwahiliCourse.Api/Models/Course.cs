namespace SwahiliCourse.Api.Models;

// A learning direction. The platform is symmetrical: each course names the
// language being learned (Target) and the language lessons are explained in
// (Source), plus the voice/STT settings that go with the target language.
//
// An account belongs to exactly one course (chosen at registration), so lesson
// progress never collides between directions.
public class Course
{
    public string Id { get; set; } = "sw";
    public string Title { get; set; } = "";
    public string Subtitle { get; set; } = "";
    public string Description { get; set; } = "";

    // "sw" | "en" — what the learner is learning.
    public string TargetLanguage { get; set; } = "sw";
    // "en" | "sw" — the language the lessons are written in.
    public string SourceLanguage { get; set; } = "en";

    // Speech settings for the TARGET language (that's what gets spoken/scored).
    public string TtsLocale { get; set; } = "sw-KE";
    public string TtsVoice { get; set; } = "sw-KE-ZuriNeural";
    public string SttLanguage { get; set; } = "sw";

    public string LessonsFile { get; set; } = "lessons.json";
    public string Flag { get; set; } = "🇹🇿";
}

// The available courses. Add a direction here + drop in its lessons file.
public static class Courses
{
    public const string Swahili = "sw";
    public const string English = "en";
    public const string Default = Swahili;

    public static readonly IReadOnlyList<Course> All = new List<Course>
    {
        new Course
        {
            Id = Swahili,
            Title = "Jifunze Kiswahili",
            Subtitle = "Learn Swahili, pole pole",
            Description = "For English speakers learning Swahili — 31 lessons from greetings to full conversations.",
            TargetLanguage = "sw",
            SourceLanguage = "en",
            TtsLocale = "sw-KE",
            TtsVoice = "sw-KE-ZuriNeural",
            SttLanguage = "sw",
            LessonsFile = "lessons.json",
            Flag = "🇹🇿",
        },
        new Course
        {
            Id = English,
            Title = "Jifunze Kiingereza",
            Subtitle = "Learn English, pole pole",
            Description = "Kwa wanaozungumza Kiswahili wanaojifunza Kiingereza — masomo 31, kutoka salamu hadi mazungumzo kamili.",
            TargetLanguage = "en",
            SourceLanguage = "sw",
            TtsLocale = "en-US",
            TtsVoice = "en-US-JennyNeural",
            SttLanguage = "en",
            LessonsFile = "lessons-en.json",
            Flag = "🇬🇧",
        },
    };

    public static Course Get(string? id) =>
        All.FirstOrDefault(c => string.Equals(c.Id, id, StringComparison.OrdinalIgnoreCase)) ?? All[0];

    public static bool IsValid(string? id) =>
        All.Any(c => string.Equals(c.Id, id, StringComparison.OrdinalIgnoreCase));
}
