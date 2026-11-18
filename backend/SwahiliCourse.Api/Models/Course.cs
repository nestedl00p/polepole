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

    // "sw" | "en" | "rw" — what the learner is learning.
    public string TargetLanguage { get; set; } = "sw";
    // "en" | "sw" — the language the lessons are written in.
    public string SourceLanguage { get; set; } = "en";

    // Speech settings for the TARGET language (that's what gets spoken/scored).
    public string TtsLocale { get; set; } = "sw-KE";
    public string TtsVoice { get; set; } = "sw-KE-ZuriNeural";
    public string SttLanguage { get; set; } = "sw";

    // False while no natural voice exists for the target language. Clients then
    // hide the 🔊 buttons instead of reading the text in the wrong language's
    // voice, and the server synthesizes nothing for the course.
    public bool HasAudio { get; set; } = true;

    // False while no speech recogniser handles the target language. The Dose
    // then asks no spoken item, since it could only be scored wrongly.
    public bool HasSpeechCheck { get; set; } = true;

    public string LessonsFile { get; set; } = "lessons.json";

    // Proverbs and idioms for this direction. They belong to no lesson — they
    // are the surprise the Dose can hand out — so they live in their own file.
    public string MethaliFile { get; set; } = "methali.json";
    public string Flag { get; set; } = "🇹🇿";
}

// The available courses. Add a direction here + drop in its lessons file.
//
// Lesson files name the two sides of every pair "swahili" and "english" for
// historical reasons. Read them as: "swahili" = the language being learned,
// "english" = its translation — except in the English course, where the two
// are swapped. Use Sides() rather than reading the fields directly.
public static class Courses
{
    public const string Swahili = "sw";
    public const string English = "en";
    public const string Kinyarwanda = "rw";
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
            MethaliFile = "methali.json",
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
            MethaliFile = "methali-en.json",
            Flag = "🇬🇧",
        },
        new Course
        {
            Id = Kinyarwanda,
            Title = "Iga Ikinyarwanda",
            Subtitle = "Learn Kinyarwanda, buhoro buhoro",
            Description = "For English speakers learning Kinyarwanda — the first lessons are in; more are on the way.",
            TargetLanguage = "rw",
            SourceLanguage = "en",
            // Neither Azure nor Google ships a Kinyarwanda voice, and browsers
            // have none either, so the course runs silent until a voice is
            // wired in (a self-hosted model such as MMS). Set TtsVoice and flip
            // HasAudio when there is one.
            TtsLocale = "rw-RW",
            TtsVoice = "",
            HasAudio = false,
            // Stock Whisper has no Kinyarwanda; the fine-tuned checkpoints run
            // under the Swahili language token. Until one is deployed, lessons
            // must not use pronunciationDrill / conversation blocks.
            SttLanguage = "sw",
            HasSpeechCheck = false,
            LessonsFile = "lessons-rw.json",
            MethaliFile = "methali-rw.json",
            Flag = "🇷🇼",
        },
    };

    public static Course Get(string? id) =>
        All.FirstOrDefault(c => string.Equals(c.Id, id, StringComparison.OrdinalIgnoreCase)) ?? All[0];

    public static string LanguageName(string code) => code switch
    {
        "sw" => "Swahili",
        "rw" => "Kinyarwanda",
        _ => "English",
    };

    // (target, source) for a stored pair — the side being learned first.
    public static (string Target, string Source) Sides(this Course course, string swahili, string english) =>
        course.TargetLanguage == "en" ? (english, swahili) : (swahili, english);

    public static bool IsValid(string? id) =>
        All.Any(c => string.Equals(c.Id, id, StringComparison.OrdinalIgnoreCase));
}
