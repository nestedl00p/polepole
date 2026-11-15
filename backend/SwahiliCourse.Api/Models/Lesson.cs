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
    // type: "heading" | "paragraph" | "callout" | "table" | "dialogue" | "list" | "quickCheck" | builders…
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

    // englishVerbBuilder config — curated verb list for the lesson
    // (the English-course counterpart of StemKeys).
    public List<string>? VerbKeys { get; set; }

    // sentenceBuilder config — the sentences to reorder. Without this the
    // component silently falls back to its built-in Swahili sentences.
    public List<SentenceChallenge>? Challenges { get; set; }

    // quickCheck config — in-lesson practice questions with instant feedback.
    // Unlike Quiz, answers are sent to the client: this is ungraded practice.
    public List<CheckQuestion>? Questions { get; set; }

    // conversation config — a spoken role-play with an AI partner. The client
    // only names the lesson; the server reads the scenario from the catalog, so
    // what the model is told can't be rewritten from the browser.
    public ConversationScenario? Scenario { get; set; }
}

// A role-play the learner speaks through, one turn at a time. Setting and
// Goal are shown to the learner (in the language the lessons are written in);
// Role is only ever read by the model.
public class ConversationScenario
{
    public string Setting { get; set; } = string.Empty;   // "You have just met Juma at a café in Arusha."
    public string Goal { get; set; } = string.Empty;      // "Greet him, say your name and where you are from."
    public string Role { get; set; } = string.Empty;      // "Juma, a friendly student from Arusha…" (English, for the model)

    // The partner's first line, in the language being learned, and its translation.
    public string Opening { get; set; } = string.Empty;
    public string OpeningTranslation { get; set; } = string.Empty;

    // Phrases the learner can lean on. Shown as hints, and passed to Whisper
    // as the words it should expect to hear. Same field convention as the
    // drill: Swahili = the language being learned, English = its translation.
    public List<PronunciationPrompt> Phrases { get; set; } = new();
}

public class CheckQuestion
{
    public string Prompt { get; set; } = string.Empty;
    public List<string> Options { get; set; } = new();
    public string Answer { get; set; } = string.Empty;
    public string? Explain { get; set; }
}

public class SentenceChallenge
{
    public List<string> Answer { get; set; } = new();
    public string En { get; set; } = string.Empty;
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
