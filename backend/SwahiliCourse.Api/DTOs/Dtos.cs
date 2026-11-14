namespace SwahiliCourse.Api.DTOs;

public record RegisterDto(
    string Email, string Password, string DisplayName, int PlanLengthDays, string? CourseId, string? TimeZoneId,
    // What the learner answered in the pre-signup taster, so "keep your
    // progress" is true: the server re-grades these and seeds their cards.
    List<TasterAnswerDto>? TasterAnswers = null);
public record LoginDto(string Email, string Password);
public record AuthResponse(string Token, UserDto User);

public record UserDto(
    int Id, string Email, string DisplayName, int PlanLengthDays,
    DateTime StartDate, int StreakCount, int TotalXp, int CurrentDay,
    string TimeZoneId, bool RestDayAvailable, bool DoneToday,
    // "HH:mm" in the learner's own zone.
    string ReminderLocalTime, bool RemindersEnabled, bool HasPushToken, string? Why,
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
public record DoseDto(
    string Date, int Size, List<DoseItemDto> Items, string? Message, bool AlreadyDoneToday,
    // The last seven days, oldest first, for the strip on the dashboard hero.
    List<PracticeDayDto> Week);

// One dot on the last-7-days strip.
public record PracticeDayDto(string Date, bool Practised, bool IsToday);

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
    int Strength, int Box, int LessonId, string LessonTitle,
    // One line of context, for a proverb. Null for vocabulary.
    string? Note,
    // "Nitakumbuka hii" — whether the learner has pinned this card.
    bool Pinned = false);

public record DoseAnswerDto(
    string ItemKey, string Exercise, string? Answer, int? SpeechScore,
    // Milliseconds from the item appearing to the learner answering. Feeds the
    // strength bar and the XP award; optional, and a client that omits it is
    // treated as middling rather than punished.
    int? ElapsedMs);

public record DoseAnswerResultDto(
    string ItemKey, bool Correct, string CorrectAnswer,
    int Box, int Strength, DateTime DueAt, int IntervalDays, int Lapses,
    int XpEarned, int TotalXp);

public record UpdateTimeZoneDto(string TimeZoneId);

// Closing a dose. ItemsAnswered is counted server-side from the cards actually
// touched today, so an empty session cannot claim a streak day.
public record DoseCompleteResultDto(
    string Date, int ItemsAnswered,
    int StreakCount, bool StreakAdvanced, bool RestDayUsed,
    bool AlreadyCountedToday, bool RestDayAvailable,
    int XpEarned, int TotalXp, List<MilestoneDto> Milestones,
    List<PracticeDayDto> Week,
    // At most one of the three below is set on any one completion, so the
    // card never turns into a questionnaire.
    //
    // True once, after 14 days running of opening the dose before the reminder.
    bool OfferStopReminders = false,
    // True once, at day 30: "what makes you open this?"
    bool AskHabitQuestion = false,
    // At most weekly: something the learner can now say, to send to someone.
    ShareOfferDto? ShareOffer = null);

// VoiceTakeId is set when the offer is the learner's own recording.
public record ShareOfferDto(string Text, string Gloss, int? VoiceTakeId);

// A threshold the learner has just crossed. Shown once, never counted toward.
public record MilestoneDto(string Key, string Title, string Detail);

// --- Reminders, the why, and the habit question ---

// Every field is optional: null leaves that setting as it is. An empty
// PushToken clears it (signing out of the phone).
public record UpdateRemindersDto(bool? Enabled, string? LocalTime, string? PushToken, string? TimeZoneId);
public record UpdateWhyDto(string? Why);
public record HabitAnswerDto(string? Answer);

// --- The taster: three items before any account exists ---

public record TasterDto(string CourseId, List<DoseItemDto> Items, TasterMethaliDto? Methali);
public record TasterMethaliDto(string Target, string Source, string? Note);
public record TasterAnswerDto(string ItemKey, string Exercise, string? Answer);
public record TasterGradeDto(string? Course, string ItemKey, string Exercise, string? Answer);
public record TasterResultDto(string ItemKey, bool Correct, string CorrectAnswer);

// --- Pins and kept voice takes ---

public record PinDto(string ItemKey, bool Pinned);
public record VoiceTakeDto(int Id, string ItemKey, string Text, int Score, DateTime CreatedAt);
