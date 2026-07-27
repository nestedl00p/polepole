using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SwahiliCourse.Api.Data;
using SwahiliCourse.Api.Services;

namespace SwahiliCourse.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class ReviewController : AuthedController
{
    private readonly AppDbContext _db;
    private readonly CourseCatalog _courses;
    public ReviewController(AppDbContext db, CourseCatalog courses) { _db = db; _courses = courses; }

    // Vocab pairs are stored the same way in both courses (swahili + english);
    // which side is the "target" (the one being learned and spoken aloud)
    // depends on the learner's course direction.
    private static (string target, string source) Sides(Models.VocabItem v, Models.Course course) =>
        course.TargetLanguage == "en" ? (v.English, v.Swahili) : (v.Swahili, v.English);

    // Aggregated flashcard deck from every lesson the user has unlocked/viewed.
    [HttpGet("flashcards")]
    public async Task<ActionResult<object>> Flashcards()
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user is null) return Unauthorized();
        var course = Models.Courses.Get(user.CourseId);

        var viewedLessonIds = await _db.LessonProgress
            .Where(p => p.UserId == CurrentUserId && p.LessonViewed)
            .Select(p => p.LessonId)
            .ToListAsync();

        var cards = _courses.For(user.CourseId).All
            .Where(l => viewedLessonIds.Contains(l.Id))
            .SelectMany(l => l.Vocabulary.Select(v =>
            {
                var (target, source) = Sides(v, course);
                return new
                {
                    // Direction-aware: `target` is the word being learned (card front,
                    // and what the 🔊 button speaks). `source` is its translation.
                    target,
                    source,
                    // Kept for compatibility with existing clients.
                    swahili = v.Swahili,
                    english = v.English,
                    lessonId = l.Id,
                    lessonTitle = l.Title
                };
            }))
            .ToList();

        return Ok(new { count = cards.Count, cards });
    }

    // A mixed practice quiz drawn from all unlocked vocabulary (spaced-style refresh).
    [HttpGet("practice")]
    public async Task<ActionResult<object>> Practice([FromQuery] int count = 10)
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user is null) return Unauthorized();
        var course = Models.Courses.Get(user.CourseId);

        var viewedLessonIds = await _db.LessonProgress
            .Where(p => p.UserId == CurrentUserId && p.LessonViewed)
            .Select(p => p.LessonId)
            .ToListAsync();

        var vocab = _courses.For(user.CourseId).All
            .Where(l => viewedLessonIds.Contains(l.Id))
            .SelectMany(l => l.Vocabulary)
            .ToList();

        if (vocab.Count < 4)
        {
            var msg = course.SourceLanguage == "sw"
                ? "Soma masomo machache zaidi ili kufungua mazoezi."
                : "Study a few more lessons to unlock practice.";
            return Ok(new { questions = Array.Empty<object>(), message = msg });
        }

        var rnd = new Random();
        var picked = vocab.OrderBy(_ => rnd.Next()).Take(Math.Min(count, vocab.Count)).ToList();

        var questions = picked.Select((v, i) =>
        {
            // Ask about the target-language word; the options are its translations
            // in the language the learner already speaks.
            var (target, source) = Sides(v, course);
            var distractors = vocab
                .Select(x => Sides(x, course).source)
                .Where(s => s != source)
                .Distinct()
                .OrderBy(_ => rnd.Next()).Take(3).ToList();
            var options = distractors.Append(source).OrderBy(_ => rnd.Next()).ToList();
            return new
            {
                id = i + 1,
                type = "multiple_choice",
                prompt = course.SourceLanguage == "sw"
                    ? $"'{target}' ina maana gani?"
                    : $"What does '{target}' mean?",
                options,
                answer = source
            };
        }).ToList();

        return Ok(new { questions });
    }
}
