namespace SwahiliCourse.Api.DTOs;

public record RegisterDto(string Email, string Password, string DisplayName, int PlanLengthDays, string? CourseId, string? TimeZoneId);
public record LoginDto(string Email, string Password);
public record AuthResponse(string Token, UserDto User);

public record UserDto(
    int Id, string Email, string DisplayName, int PlanLengthDays,
    DateTime StartDate, int StreakCount, int TotalXp, int CurrentDay,
    string TimeZoneId, bool RestDayAvailable, bool DoneToday,
    CourseDto Course);

// The learner's course direction — drives labels, which side of a vocab pair is
// the prompt, and which language is spoken/scored.
public record CourseDto(
    string Id, string Title, string Subtitle, string Description,
    string TargetLanguage, string SourceLanguage, string TtsLocale, string Flag);

public record UpdatePaceDto(int PlanLengthDays);

public record QuizSubmissionDto(int LessonId, List<QuizAnswerDto> Answers);
public record QuizAnswerDto(int QuestionId, string Answer);

public record QuizResultDto(
    int LessonId, int Score, int Total, int XpEarned,
    bool Passed, List<QuestionFeedback> Feedback);

public record QuestionFeedback(int QuestionId, bool Correct, string CorrectAnswer, string YourAnswer);

public record ProgressDto(
    int LessonId, bool LessonViewed, bool QuizCompleted,
    int BestQuizScore, int QuizTotal, bool Unlocked);

// --- Dose ya leo (the daily practice loop) ---

// `message` is set instead of items when the learner has not met enough words
// to build a dose yet.
public record DoseDto(string Date, int Size, List<DoseItemDto> Items, string? Message, bool AlreadyDoneToday);

// One item as the learner sees it. The correct answer is not here on purpose;
// it comes back from POST /api/dose/answer once a choice has been made.
public record DoseItemDto(
    string ItemKey, string Kind, string Exercise,
    // What is shown: the target word for `tambua`, its meaning for `tunga` and `sema`.
    string Prompt,
    // The target-language word, when the learner is allowed to see it (the
    // prompt for `tambua`, the thing to say for `sema`). Null for `tunga`,
    // where naming it would be the answer.
    string? Target,
    List<string> Options,
    int Strength, int Box, int LessonId, string LessonTitle);

public record DoseAnswerDto(string ItemKey, string Exercise, string? Answer, int? SpeechScore);

public record DoseAnswerResultDto(
    string ItemKey, bool Correct, string CorrectAnswer,
    int Box, int Strength, DateTime DueAt, int IntervalDays, int Lapses);

public record UpdateTimeZoneDto(string TimeZoneId);

// Closing a dose. ItemsAnswered is counted server-side from the cards actually
// touched today, so an empty session cannot claim a streak day.
public record DoseCompleteResultDto(
    string Date, int ItemsAnswered,
    int StreakCount, bool StreakAdvanced, bool RestDayUsed,
    bool AlreadyCountedToday, bool RestDayAvailable);
