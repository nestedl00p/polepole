using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SwahiliCourse.Api.Data;
using SwahiliCourse.Api.DTOs;
using SwahiliCourse.Api.Models;
using SwahiliCourse.Api.Services;

namespace SwahiliCourse.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class QuizController : AuthedController
{
    private readonly AppDbContext _db;
    private readonly LessonCatalog _catalog;

    public QuizController(AppDbContext db, LessonCatalog catalog)
    {
        _db = db; _catalog = catalog;
    }

    private const double PassThreshold = 0.7; // 70% to pass and unlock the next lesson

    [HttpPost("submit")]
    public async Task<ActionResult<QuizResultDto>> Submit(QuizSubmissionDto dto)
    {
        var user = await _db.Users.FindAsync(CurrentUserId);
        if (user is null) return Unauthorized();

        var lesson = _catalog.GetById(dto.LessonId);
        if (lesson is null) return NotFound();

        var answerMap = dto.Answers.ToDictionary(a => a.QuestionId, a => a.Answer ?? string.Empty);
        var feedback = new List<QuestionFeedback>();
        int correct = 0;

        foreach (var q in lesson.Quiz)
        {
            answerMap.TryGetValue(q.Id, out var given);
            given ??= string.Empty;
            bool isRight = IsCorrect(q, given);
            if (isRight) correct++;
            feedback.Add(new QuestionFeedback(q.Id, isRight, q.Answer, given));
        }

        int total = lesson.Quiz.Count;
        bool passed = total == 0 || (double)correct / total >= PassThreshold;

        // Persist progress.
        var pr = await _db.LessonProgress
            .FirstOrDefaultAsync(p => p.UserId == user.Id && p.LessonId == dto.LessonId);
        if (pr is null)
        {
            pr = new LessonProgress { UserId = user.Id, LessonId = dto.LessonId, LessonViewed = true };
            _db.LessonProgress.Add(pr);
        }

        pr.QuizScore = correct;
        pr.QuizTotal = total;
        pr.UpdatedAt = DateTime.UtcNow;

        int xpEarned = 0;
        bool firstPass = passed && !pr.QuizCompleted;

        if (correct > pr.BestQuizScore) pr.BestQuizScore = correct;

        if (passed)
        {
            if (!pr.QuizCompleted)
            {
                pr.QuizCompleted = true;
                pr.CompletedAt = DateTime.UtcNow;
                // Award full XP on first pass, scaled by accuracy.
                xpEarned = (int)Math.Round(lesson.XpReward * ((double)correct / Math.Max(total, 1)));
                user.TotalXp += xpEarned;
                UpdateStreak(user);
            }
        }

        await _db.SaveChangesAsync();

        return Ok(new QuizResultDto(dto.LessonId, correct, total, xpEarned, passed, feedback));
    }

    private static bool IsCorrect(QuizQuestion q, string given)
    {
        string Normalize(string s) => new string(
            s.Trim().ToLowerInvariant()
             .Where(c => !char.IsPunctuation(c))
             .ToArray()).Replace("  ", " ").Trim();

        var a = Normalize(q.Answer);
        var g = Normalize(given);

        if (q.Type == "multiple_choice")
            return string.Equals(q.Answer.Trim(), given.Trim(), StringComparison.OrdinalIgnoreCase);

        // translate / fill_blank: accept exact normalized match, or answer contained
        // (handles minor article/word differences gracefully).
        if (a == g) return true;

        // Allow the learner to omit/include leading pronouns like "I", "the".
        var aWords = a.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var gWords = g.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (aWords.Length > 1 && gWords.Length > 1)
        {
            // 85% word overlap counts as correct for free-text answers.
            int overlap = aWords.Count(w => gWords.Contains(w));
            if ((double)overlap / aWords.Length >= 0.85) return true;
        }
        return false;
    }

    private static void UpdateStreak(User user)
    {
        var today = DateTime.UtcNow.Date;
        if (user.LastActivityDate is null)
        {
            user.StreakCount = 1;
        }
        else
        {
            var last = user.LastActivityDate.Value.Date;
            if (last == today) { /* already counted today */ }
            else if (last == today.AddDays(-1)) user.StreakCount += 1;
            else user.StreakCount = 1; // streak broken, restart
        }
        user.LastActivityDate = today;
    }
}
