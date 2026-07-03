namespace SwahiliCourse.Api.Models;

// The course content (lessons) lives in code/seed data rather than being user-editable,
// so it is stored as a static catalog. Progress is what we persist per-user.

public class Lesson
{
    public int Id { get; set; }          // 1..30 (the "day" number)
    public int Week { get; set; }        // 1..4
    public string Title { get; set; } = string.Empty;
    public string Subtitle { get; set; } = string.Empty;
    public string Theme { get; set; } = string.Empty;

    // Rich content blocks rendered by the frontend (text, tables, callouts, dialogues).
    public List<ContentBlock> Blocks { get; set; } = new();

    // Vocabulary introduced this lesson (also feeds flashcards & quizzes).
    public List<VocabItem> Vocabulary { get; set; } = new();

    // Quiz questions for this lesson.
    public List<QuizQuestion> Quiz { get; set; } = new();

    public int XpReward { get; set; } = 100;
}

public class ContentBlock
{
    // type: "heading" | "paragraph" | "callout" | "table" | "dialogue" | "list" | "verbBuilder"
    public string Type { get; set; } = "paragraph";
    public string? Heading { get; set; }
    public string? Text { get; set; }
    public string? CalloutTitle { get; set; }
    public List<string>? Lines { get; set; }
    public List<string>? TableHeaders { get; set; }
    public List<List<string>>? TableRows { get; set; }
    public List<DialogueLine>? Dialogue { get; set; }

    // verbBuilder (interactive grammar "formula" widget) config — passed through to the frontend.
    public string? Mode { get; set; }            // tense | negative | subjunctive | object
    public string? Tense { get; set; }           // present | past | future | perfect
    public string? Marker { get; set; }          // na | li | ta | me ...
    public string? Intro { get; set; }
    public List<string>? StemKeys { get; set; }

    // pronunciationDrill (speak-and-check) config — phrases the learner records.
    public List<PronunciationPrompt>? Prompts { get; set; }
}

public class PronunciationPrompt
{
    public string Swahili { get; set; } = string.Empty;
    public string English { get; set; } = string.Empty;
}

public class DialogueLine
{
    public string Speaker { get; set; } = string.Empty;
    public string Swahili { get; set; } = string.Empty;
    public string English { get; set; } = string.Empty;
}

public class VocabItem
{
    public string Swahili { get; set; } = string.Empty;
    public string English { get; set; } = string.Empty;
}

public class QuizQuestion
{
    public int Id { get; set; }
    // type: "multiple_choice" | "translate" | "fill_blank" | "match"
    public string Type { get; set; } = "multiple_choice";
    public string Prompt { get; set; } = string.Empty;
    public List<string> Options { get; set; } = new();   // for multiple_choice / match
    public string Answer { get; set; } = string.Empty;   // canonical answer
    public string? Hint { get; set; }
}
