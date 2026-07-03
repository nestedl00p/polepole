using System.Text.Json;
using SwahiliCourse.Api.Models;

namespace SwahiliCourse.Api.Services;

// Loads the static lesson catalog from lessons.json once at startup.
// To edit course content, you simply edit Data/lessons.json - no code changes needed.
public class LessonCatalog
{
    private readonly List<Lesson> _lessons;

    public LessonCatalog(IWebHostEnvironment env)
    {
        var path = Path.Combine(env.ContentRootPath, "Data", "lessons.json");
        var json = File.ReadAllText(path);
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        _lessons = JsonSerializer.Deserialize<List<Lesson>>(json, options) ?? new();
    }

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
