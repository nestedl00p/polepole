using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SwahiliCourse.Api.Data;
using SwahiliCourse.Api.Services;

namespace SwahiliCourse.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class LessonsController : AuthedController
{
    private readonly AppDbContext _db;
    private readonly LessonCatalog _catalog;
    private readonly PaceService _pace;

    public LessonsController(AppDbContext db, LessonCatalog catalog, PaceService pace)
    {
        _db = db; _catalog = catalog; _pace = pace;
    }

    // Lightweight list for the dashboard: every lesson with its lock/progress state.
    [HttpGet]
    public async Task<ActionResult<object>> List()
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user is null) return Unauthorized();

        var progress = await _db.LessonProgress
            .Where(p => p.UserId == user.Id)
            .ToDictionaryAsync(p => p.LessonId);

        var items = _catalog.All.Select(l =>
        {
            progress.TryGetValue(l.Id, out var pr);
            return new
            {
                id = l.Id,
                week = l.Week,
                title = l.Title,
                subtitle = l.Subtitle,
                theme = l.Theme,
                xpReward = l.XpReward,
                vocabCount = l.Vocabulary.Count,
                quizCount = l.Quiz.Count,
                unlocked = _pace.IsUnlocked(user, l.Id, progress),
                lessonViewed = pr?.LessonViewed ?? false,
                quizCompleted = pr?.QuizCompleted ?? false,
                bestQuizScore = pr?.BestQuizScore ?? 0,
                quizTotal = pr?.QuizTotal ?? l.Quiz.Count
            };
        });

        return Ok(new
        {
            currentDay = _pace.CurrentScheduledDay(user),
            planLengthDays = user.PlanLengthDays,
            totalLessons = _catalog.TotalLessons,
            lessons = items
        });
    }

    // Full lesson content (answers stripped from quiz). Marks the lesson as viewed.
    [HttpGet("{id:int}")]
    public async Task<ActionResult<object>> Get(int id)
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user is null) return Unauthorized();

        var lesson = _catalog.GetById(id);
        if (lesson is null) return NotFound();

        var progress = await _db.LessonProgress
            .Where(p => p.UserId == user.Id)
            .ToDictionaryAsync(p => p.LessonId);

        if (!_pace.IsUnlocked(user, id, progress))
            return StatusCode(423, new { message = "This lesson is locked. Complete the previous lesson first." });

        // Mark viewed.
        if (!progress.TryGetValue(id, out var pr))
        {
            pr = new Models.LessonProgress { UserId = user.Id, LessonId = id };
            _db.LessonProgress.Add(pr);
        }
        if (!pr.LessonViewed)
        {
            pr.LessonViewed = true;
            pr.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        return Ok(_catalog.GetSafe(lesson));
    }
}
