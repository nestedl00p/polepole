namespace SwahiliCourse.Api.DTOs;

public record RegisterDto(string Email, string Password, string DisplayName, int PlanLengthDays, string? CourseId);
public record LoginDto(string Email, string Password);
public record AuthResponse(string Token, UserDto User);

public record UserDto(
    int Id, string Email, string DisplayName, int PlanLengthDays,
    DateTime StartDate, int StreakCount, int TotalXp, int CurrentDay,
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
