using System.Text.Json;
using SwahiliCourse.Api.Models;

namespace SwahiliCourse.Api.Services;

// The lesson list for a single course direction, loaded once at startup.
// To edit course content you edit the course's lessons file — no code changes.
// Resolved per-course via CourseCatalog.
public class LessonCatalog
{
    private readonly List<Lesson> _lessons;

    private LessonCatalog(List<Lesson> lessons) => _lessons = lessons;

    public static LessonCatalog FromFile(string path)
    {
        var json = File.ReadAllText(path);
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        return new LessonCatalog(JsonSerializer.Deserialize<List<Lesson>>(json, options) ?? new());
    }

    public static LessonCatalog Empty() => new(new List<Lesson>());

    public IReadOnlyList<Lesson> All => _lessons;

    public Lesson? GetById(int id) => _lessons.FirstOrDefault(l => l.Id == id);

    public int TotalLessons => _lessons.Count;

    // Returns the lesson without quiz answers (so the frontend can't cheat).
    public Lesson GetSafe(Lesson lesson)
    {
        return new Lesson
        {
            Id = lesson.Id,
            Week = lesson.Week,
            Title = lesson.Title,
            Subtitle = lesson.Subtitle,
            Theme = lesson.Theme,
            Blocks = lesson.Blocks,
            Vocabulary = lesson.Vocabulary,
            XpReward = lesson.XpReward,
            Quiz = lesson.Quiz.Select(q => new QuizQuestion
            {
                Id = q.Id,
                Type = q.Type,
                Prompt = q.Prompt,
                Options = q.Options,
                Answer = string.Empty,   // strip the answer
                Hint = q.Hint
            }).ToList()
        };
    }
}
