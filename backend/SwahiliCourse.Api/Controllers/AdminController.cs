using System.Diagnostics;
using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SwahiliCourse.Api.Data;
using SwahiliCourse.Api.Models;
using SwahiliCourse.Api.Services;

namespace SwahiliCourse.Api.Controllers;

// Backoffice: the read-outs about the whole service — who is using it, what
// the course content looks like, whether the moving parts are healthy — and
// the audit trail. Account management is in AdminUsersController.
//
// Nothing here returns a secret. Configuration is reported as "set" or "not
// set", never as its value.
[ApiController]
[Authorize(Policy = AdminPolicy.Name)]
[Route("api/admin")]
public class AdminController : AuthedController
{
    private const int SeriesDays = 30;

    private readonly AppDbContext _db;
    private readonly AdminAudit _audit;
    private readonly CourseCatalog _courses;
    private readonly HabitReport _habit;
    private readonly TtsService _tts;
    private readonly SpeechService _speech;
    private readonly VoiceStore _voice;
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;

    public AdminController(
        AppDbContext db, AdminAudit audit, CourseCatalog courses, HabitReport habit,
        TtsService tts, SpeechService speech, VoiceStore voice,
        IConfiguration config, IWebHostEnvironment env)
    {
        _db = db; _audit = audit; _courses = courses; _habit = habit;
        _tts = tts; _speech = speech; _voice = voice; _config = config; _env = env;
    }

    // GET /api/admin/overview
    [HttpGet("overview")]
    public async Task<IActionResult> Overview(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var from = today.AddDays(-(SeriesDays - 1));
        var fromInstant = from.ToDateTime(TimeOnly.MinValue);

        var users = _db.Users.AsNoTracking();
        var day = now.AddDays(-1);
        var week = now.AddDays(-7);
        var month = now.AddDays(-30);

        var byCourse = await users.GroupBy(u => u.CourseId)
            .Select(g => new { CourseId = g.Key, Count = g.Count() }).ToListAsync(ct);

        // Sign-ups are bucketed by UTC day; practice by each learner's own
        // calendar day, which is how PracticeDay is keyed. Near midnight the
        // two can disagree by one day — fine for a trend line.
        var signupInstants = await users.Where(u => u.CreatedAt >= fromInstant)
            .Select(u => u.CreatedAt).ToListAsync(ct);
        var signups = signupInstants.GroupBy(DateOnly.FromDateTime).ToDictionary(g => g.Key, g => g.Count());

        var practice = (await _db.PracticeDays.AsNoTracking().Where(d => d.Day >= from)
                .GroupBy(d => d.Day)
                .Select(g => new { Day = g.Key, Learners = g.Count(), Doses = g.Count(d => d.DoseCompletedAt != null) })
                .ToListAsync(ct))
            .ToDictionary(d => d.Day);

        var series = Enumerable.Range(0, SeriesDays).Select(i =>
        {
            var d = from.AddDays(i);
            practice.TryGetValue(d, out var p);
            return new
            {
                date = d.ToString("yyyy-MM-dd"),
                signups = signups.GetValueOrDefault(d),
                practising = p?.Learners ?? 0,
                doses = p?.Doses ?? 0,
            };
        }).ToList();

        var recent = await users.OrderByDescending(u => u.CreatedAt).Take(8)
            .Select(u => new { u.Id, u.Email, u.DisplayName, u.CourseId, u.CreatedAt })
            .ToListAsync(ct);

        return Ok(new
        {
            generatedAt = now,
            users = new
            {
                total = await users.CountAsync(ct),
                admins = await users.CountAsync(u => u.IsAdmin, ct),
                suspended = await users.CountAsync(u => u.IsDisabled, ct),
                new7d = await users.CountAsync(u => u.CreatedAt >= week, ct),
                new30d = await users.CountAsync(u => u.CreatedAt >= month, ct),
                seen24h = await users.CountAsync(u => u.LastSeenAt >= day, ct),
                seen7d = await users.CountAsync(u => u.LastSeenAt >= week, ct),
                seen30d = await users.CountAsync(u => u.LastSeenAt >= month, ct),
                withPhone = await users.CountAsync(u => u.PushToken != null && u.PushToken != "", ct),
                byCourse = Courses.All.Select(c => new
                {
                    c.Id, c.Title, c.Flag,
                    count = byCourse.FirstOrDefault(b => b.CourseId == c.Id)?.Count ?? 0,
                }),
            },
            totals = new
            {
                lessonsCompleted = await _db.LessonProgress.CountAsync(p => p.QuizCompleted, ct),
                dosesCompleted = await _db.PracticeDays.CountAsync(d => d.DoseCompletedAt != null, ct),
                cards = await _db.CardStates.CountAsync(ct),
                voiceTakes = await _db.VoiceTakes.CountAsync(ct),
            },
            series,
            recentSignups = recent,
        });
    }

    // GET /api/admin/content — what each course contains, how far learners get
    // through it, and anything in the lesson files that looks wrong.
    [HttpGet("content")]
    public async Task<IActionResult> Content(CancellationToken ct)
    {
        var learners = await _db.Users.AsNoTracking().GroupBy(u => u.CourseId)
            .Select(g => new { CourseId = g.Key, Count = g.Count() }).ToListAsync(ct);

        var reach = await _db.LessonProgress.AsNoTracking()
            .Join(_db.Users, p => p.UserId, u => u.Id,
                (p, u) => new { u.CourseId, p.LessonId, p.LessonViewed, p.QuizCompleted, p.BestQuizScore, p.QuizTotal })
            .GroupBy(x => new { x.CourseId, x.LessonId })
            .Select(g => new
            {
                g.Key.CourseId, g.Key.LessonId,
                Viewed = g.Count(x => x.LessonViewed),
                Completed = g.Count(x => x.QuizCompleted),
                Score = g.Sum(x => x.QuizCompleted ? x.BestQuizScore : 0),
                OutOf = g.Sum(x => x.QuizCompleted ? x.QuizTotal : 0),
            })
            .ToListAsync(ct);

        var courses = _courses.AllCourses.Select(pair =>
        {
            var (course, catalog) = pair;
            var lessons = catalog.All;
            return new
            {
                course.Id, course.Title, course.Subtitle, course.Flag,
                course.TargetLanguage, course.SourceLanguage,
                course.LessonsFile, course.MethaliFile,
                learners = learners.FirstOrDefault(l => l.CourseId == course.Id)?.Count ?? 0,
                lessonCount = lessons.Count,
                vocabCount = lessons.Sum(l => l.Vocabulary.Count),
                quizCount = lessons.Sum(l => l.Quiz.Count),
                methaliCount = _courses.MethaliFor(course.Id).Count,
                issues = Validate(lessons),
                lessons = lessons.Select(l =>
                {
                    var r = reach.FirstOrDefault(x => x.CourseId == course.Id && x.LessonId == l.Id);
                    return new
                    {
                        l.Id, l.Week, l.Title, l.Subtitle, l.XpReward,
                        blocks = l.Blocks.Count,
                        vocab = l.Vocabulary.Count,
                        quiz = l.Quiz.Count,
                        viewed = r?.Viewed ?? 0,
                        completed = r?.Completed ?? 0,
                        averageScore = r is null || r.OutOf == 0 ? (double?)null : Math.Round((double)r.Score / r.OutOf, 3),
                    };
                }),
            };
        });

        return Ok(new { courses });
    }

    private record ContentIssue(string Severity, int? LessonId, string Message);

    // Checks for the mistakes a lessons file can carry without anything
    // failing loudly: the app starts, and one learner in one lesson gets a
    // question that cannot be answered.
    private static List<ContentIssue> Validate(IReadOnlyList<Lesson> lessons)
    {
        var issues = new List<ContentIssue>();
        if (lessons.Count == 0)
        {
            issues.Add(new("error", null, "The lessons file is missing or empty — this course has no content."));
            return issues;
        }

        foreach (var dup in lessons.GroupBy(l => l.Id).Where(g => g.Count() > 1))
            issues.Add(new("error", dup.Key, $"Lesson id {dup.Key} is used by {dup.Count()} lessons."));

        // Unlocking a lesson looks for the quiz on id − 1, so a gap strands
        // everything after it.
        var ids = lessons.Select(l => l.Id).Distinct().OrderBy(i => i).ToList();
        if (ids[0] != 1 || ids[^1] != ids.Count)
            issues.Add(new("error", null, $"Lesson ids should run 1 to {ids.Count} without gaps; found {ids[0]} to {ids[^1]}."));

        foreach (var dup in lessons.SelectMany(l => l.Quiz.Select(q => new { l.Id, q })).GroupBy(x => x.q.Id).Where(g => g.Count() > 1))
            issues.Add(new("error", dup.First().Id,
                $"Quiz question id {dup.Key} is used {dup.Count()} times (lessons {string.Join(", ", dup.Select(x => x.Id).Distinct())})."));

        foreach (var lesson in lessons)
        {
            if (lesson.Quiz.Count == 0)
                issues.Add(new("warning", lesson.Id, "No quiz questions — the lesson cannot be passed, so the next one never unlocks."));

            foreach (var q in lesson.Quiz)
            {
                if (string.IsNullOrWhiteSpace(q.Answer))
                    issues.Add(new("error", lesson.Id, $"Question {q.Id} has no answer."));
                else if (q.Options.Count > 0 && !q.Options.Any(o => string.Equals(o.Trim(), q.Answer.Trim(), StringComparison.OrdinalIgnoreCase)))
                    issues.Add(new("error", lesson.Id, $"Question {q.Id}: the answer \"{q.Answer}\" is not among its options."));

                if (string.IsNullOrWhiteSpace(q.Prompt))
                    issues.Add(new("warning", lesson.Id, $"Question {q.Id} has an empty prompt."));
            }

            if (lesson.Vocabulary.Any(v => string.IsNullOrWhiteSpace(v.Swahili) || string.IsNullOrWhiteSpace(v.English)))
                issues.Add(new("warning", lesson.Id, "A vocabulary entry is missing one of its two sides."));
        }

        return issues;
    }

    // GET /api/admin/habit — the habit-test report (see Services/HabitReport).
    // The X-Report-Key endpoint remains for scripts; this is the same data for
    // someone signed in.
    [HttpGet("habit")]
    public async Task<IActionResult> Habit(CancellationToken ct) =>
        Ok(await _habit.BuildAsync(DateTime.UtcNow, ct));

    // GET /api/admin/system — the state of the things that can be misconfigured.
    [HttpGet("system")]
    public async Task<IActionResult> System(CancellationToken ct)
    {
        var connection = _db.Database.GetDbConnection();
        var dbPath = Path.GetFullPath(connection.DataSource);
        var dbFile = new FileInfo(dbPath);
        var applied = (await _db.Database.GetAppliedMigrationsAsync(ct)).ToList();
        var pending = (await _db.Database.GetPendingMigrationsAsync(ct)).ToList();

        var dataDir = _config["DataDir"];
        var ttsCache = _tts.CacheUsage();
        var voiceUsage = _voice.Usage();
        var process = Process.GetCurrentProcess();
        var corsSetting = _config["Cors:AllowedOrigins"];

        return Ok(new
        {
            app = new
            {
                environment = _env.EnvironmentName,
                version = Assembly.GetExecutingAssembly()
                    .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion,
                runtime = global::System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription,
                startedAt = process.StartTime.ToUniversalTime(),
                memoryBytes = process.WorkingSet64,
                serverTime = DateTime.UtcNow,
            },
            database = new
            {
                path = dbPath,
                sizeBytes = dbFile.Exists ? dbFile.Length : 0,
                // Without DataDir the database lives in the app's working
                // directory, which a container throws away on restart.
                persistent = !string.IsNullOrWhiteSpace(dataDir),
                appliedMigrations = applied.Count,
                latestMigration = applied.LastOrDefault(),
                pendingMigrations = pending,
                rows = new
                {
                    users = await _db.Users.CountAsync(ct),
                    lessonProgress = await _db.LessonProgress.CountAsync(ct),
                    cards = await _db.CardStates.CountAsync(ct),
                    practiceDays = await _db.PracticeDays.CountAsync(ct),
                    voiceTakes = await _db.VoiceTakes.CountAsync(ct),
                    auditEntries = await _db.AdminAudit.CountAsync(ct),
                },
            },
            tts = new
            {
                provider = _tts.Provider,
                configured = _tts.IsConfigured,
                warmupEnabled = _config.GetValue("Tts:Warmup:Enabled", true),
                cacheFiles = ttsCache.Files,
                cacheBytes = ttsCache.Bytes,
            },
            speech = new
            {
                enabled = _speech.IsConfigured,
                host = _speech.Host,
                apiKeySet = !string.IsNullOrWhiteSpace(_config["Speech:ApiKey"]),
            },
            voice = new { files = voiceUsage.Files, bytes = voiceUsage.Bytes },
            reminders = new
            {
                enabled = _config.GetValue("Reminders:Enabled", true),
                phonesRegistered = await _db.Users.CountAsync(u => u.PushToken != null && u.PushToken != "", ct),
                optedIn = await _db.Users.CountAsync(u => u.RemindersEnabled, ct),
            },
            security = new
            {
                corsOrigins = string.IsNullOrWhiteSpace(corsSetting)
                    ? new[] { "(development defaults: localhost:5173, localhost:3000)" }
                    : corsSetting.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
                habitReportKeySet = !string.IsNullOrWhiteSpace(_config["Habit:ReportKey"]),
                bootstrapAdminsConfigured = (_config["Admin:Emails"] ?? string.Empty)
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Length,
            },
        });
    }

    // POST /api/admin/system/speech/ping — a live check of the Whisper sidecar.
    // Separate from /system because it waits on the network.
    [HttpPost("system/speech/ping")]
    public async Task<IActionResult> PingSpeech(CancellationToken ct)
    {
        var (reachable, detail, ms) = await _speech.PingAsync(ct);
        return Ok(new { reachable, detail, milliseconds = ms });
    }

    // POST /api/admin/system/tts-cache/clear
    [HttpPost("system/tts-cache/clear")]
    public async Task<IActionResult> ClearTtsCache(CancellationToken ct)
    {
        var removed = _tts.ClearCache();
        _audit.Record(User, AdminActions.TtsCacheClear, detail: $"Removed {removed} cached clip(s).");
        await _db.SaveChangesAsync(ct);
        return Ok(new { removed });
    }

    // GET /api/admin/audit?page=1 — newest first.
    [HttpGet("audit")]
    public async Task<IActionResult> Audit(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = _db.AdminAudit.AsNoTracking();
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(a => a.CreatedAt).ThenByDescending(a => a.Id)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);

        return Ok(new { total, page, pageSize, items });
    }
}
