namespace SwahiliCourse.Api.Models;

public class LessonProgress
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public int LessonId { get; set; }   // matches Lesson.Id (the day number)

    public bool LessonViewed { get; set; }
    public bool QuizCompleted { get; set; }
    public int QuizScore { get; set; }       // number correct
    public int QuizTotal { get; set; }       // out of how many
    public int BestQuizScore { get; set; }

    public DateTime? CompletedAt { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
