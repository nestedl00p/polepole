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
    private readonly LessonCatalog _catalog;
    public ReviewController(AppDbContext db, LessonCatalog catalog) { _db = db; _catalog = catalog; }

    // Aggregated flashcard deck from every lesson the user has unlocked/viewed.
    [HttpGet("flashcards")]
    public async Task<ActionResult<object>> Flashcards()
    {
        var viewedLessonIds = await _db.LessonProgress
            .Where(p => p.UserId == CurrentUserId && p.LessonViewed)
            .Select(p => p.LessonId)
            .ToListAsync();

        var cards = _catalog.All
            .Where(l => viewedLessonIds.Contains(l.Id))
            .SelectMany(l => l.Vocabulary.Select(v => new
            {
                swahili = v.Swahili,
                english = v.English,
                lessonId = l.Id,
                lessonTitle = l.Title
            }))
            .ToList();

        return Ok(new { count = cards.Count, cards });
    }

    // A mixed practice quiz drawn from all unlocked vocabulary (spaced-style refresh).
    [HttpGet("practice")]
    public async Task<ActionResult<object>> Practice([FromQuery] int count = 10)
    {
        var viewedLessonIds = await _db.LessonProgress
            .Where(p => p.UserId == CurrentUserId && p.LessonViewed)
            .Select(p => p.LessonId)
            .ToListAsync();

        var vocab = _catalog.All
            .Where(l => viewedLessonIds.Contains(l.Id))
            .SelectMany(l => l.Vocabulary)
            .ToList();

        if (vocab.Count < 4)
            return Ok(new { questions = Array.Empty<object>(), message = "Study a few more lessons to unlock practice." });

        var rnd = new Random();
        var picked = vocab.OrderBy(_ => rnd.Next()).Take(Math.Min(count, vocab.Count)).ToList();

        var questions = picked.Select((v, i) =>
        {
            // Build 3 distractors + the right answer.
            var distractors = vocab.Where(x => x.English != v.English)
                .OrderBy(_ => rnd.Next()).Take(3).Select(x => x.English).ToList();
            var options = distractors.Append(v.English).OrderBy(_ => rnd.Next()).ToList();
            return new
            {
                id = i + 1,
                type = "multiple_choice",
                prompt = $"What does '{v.Swahili}' mean?",
                options,
                answer = v.English
            };
        }).ToList();

        return Ok(new { questions });
    }
}
