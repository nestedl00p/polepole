using Microsoft.EntityFrameworkCore;
using SwahiliCourse.Api.Data;
using SwahiliCourse.Api.DTOs;
using SwahiliCourse.Api.Models;

namespace SwahiliCourse.Api.Services;

// Assembles "Dose ya leo" — the day's five review items.
//
// The habit unit is this, not the lesson: five items is small enough to do on a
// bad day, and because the queue is rebuilt from per-item due dates it still has
// something to offer after the last lesson is finished.
//
// See docs/DAILY-PRACTICE-LOOP.md.
public class DoseService
{
    public const int DoseSize = 5;

    // One correct answer plus three distractors.
    private const int OptionCount = 4;

    // A word pair cannot make a four-option question until the learner has met
    // four of them.
    private const int MinimumPool = OptionCount;

    // Word-match percentage from the Whisper sidecar that counts as said
    // correctly. Pronunciation is scored generously on purpose — the item is
    // there to get the learner talking, not to gate progress on an accent.
    public const int SemaPassScore = 70;

    private readonly AppDbContext _db;
    private readonly CourseCatalog _courses;
    private readonly ReviewScheduler _scheduler;

    public DoseService(AppDbContext db, CourseCatalog courses, ReviewScheduler scheduler)
    {
        _db = db;
        _courses = courses;
        _scheduler = scheduler;
    }

    // An item the learner has met: Target is the side being learned (and the
    // side spoken aloud), Source its translation.
    public record PoolItem(string Key, string Target, string Source, int LessonId, string LessonTitle);

    public async Task<DoseDto> BuildAsync(User user, CancellationToken ct = default)
    {
        var course = Courses.Get(user.CourseId);
        var pool = await PoolAsync(user, ct);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        if (pool.Count < MinimumPool)
        {
            var message = course.SourceLanguage == "sw"
                ? "Soma masomo machache zaidi ili kufungua dose ya leo."
                : "Study a few more lessons to unlock your daily dose.";
            return new DoseDto(today.ToString("yyyy-MM-dd"), 0, new List<DoseItemDto>(), message);
        }

        var states = await _db.CardStates
            .Where(c => c.UserId == user.Id && c.CourseId == course.Id)
            .ToListAsync(ct);
        var byKey = states.ToDictionary(c => c.ItemKey, StringComparer.Ordinal);

        var selected = Select(pool, byKey, Rng(user.Id, today));
        var items = Compose(selected, pool, byKey, Rng(user.Id, today));

        return new DoseDto(today.ToString("yyyy-MM-dd"), items.Count, items, null);
    }

    // Look one item up by key, for grading an answer. Returns null when the key
    // is not something this learner has unlocked.
    public async Task<PoolItem?> FindAsync(User user, string itemKey, CancellationToken ct = default)
    {
        var pool = await PoolAsync(user, ct);
        return pool.FirstOrDefault(p => string.Equals(p.Key, itemKey, StringComparison.Ordinal));
    }

    // Every item the learner has met: vocabulary from the lessons they have
    // opened, deduped by target word so a word taught twice is one card.
    private async Task<List<PoolItem>> PoolAsync(User user, CancellationToken ct)
    {
        var course = Courses.Get(user.CourseId);

        var viewedLessonIds = await _db.LessonProgress
            .Where(p => p.UserId == user.Id && p.LessonViewed)
            .Select(p => p.LessonId)
            .ToListAsync(ct);

        var seen = new HashSet<string>(StringComparer.Ordinal);
        var pool = new List<PoolItem>();

        foreach (var lesson in _courses.For(user.CourseId).All.Where(l => viewedLessonIds.Contains(l.Id)))
        {
            foreach (var vocab in lesson.Vocabulary)
            {
                var (target, source) = Sides(vocab, course);
                if (string.IsNullOrWhiteSpace(target) || string.IsNullOrWhiteSpace(source)) continue;
                if (!seen.Add(target)) continue;
                pool.Add(new PoolItem(target, target, source, lesson.Id, lesson.Title));
            }
        }

        return pool;
    }

    // Which side of a vocab pair is being learned depends on the course
    // direction, exactly as ReviewController does it.
    private static (string target, string source) Sides(VocabItem v, Course course) =>
        course.TargetLanguage == "en" ? (v.English, v.Swahili) : (v.Swahili, v.English);

    // Due first, then pinned, then weakest, then words not yet reviewed.
    private static List<PoolItem> Select(
        List<PoolItem> pool, Dictionary<string, CardState> byKey, Random rng)
    {
        var now = DateTime.UtcNow;
        var picked = new List<PoolItem>();
        var taken = new HashSet<string>(StringComparer.Ordinal);

        void Take(IEnumerable<PoolItem> candidates)
        {
            foreach (var item in candidates)
            {
                if (picked.Count >= DoseSize) return;
                if (taken.Add(item.Key)) picked.Add(item);
            }
        }

        var withState = pool.Where(p => byKey.ContainsKey(p.Key)).ToList();

        // Overdue longest first — those are the ones closest to being forgotten.
        Take(withState.Where(p => byKey[p.Key].DueAt <= now).OrderBy(p => byKey[p.Key].DueAt));
        Take(withState.Where(p => byKey[p.Key].Pinned).OrderBy(p => byKey[p.Key].Strength));
        Take(withState.OrderBy(p => byKey[p.Key].Strength).ThenBy(p => byKey[p.Key].DueAt));

        // New words last, shuffled, so a learner who is on top of their reviews
        // meets new material in a different order each day.
        Take(pool.Where(p => !byKey.ContainsKey(p.Key)).OrderBy(_ => rng.Next()));

        return picked;
    }

    // Turn the selected words into questions: one spoken item, the rest
    // alternating between recognising and producing.
    private static List<DoseItemDto> Compose(
        List<PoolItem> selected, List<PoolItem> pool,
        Dictionary<string, CardState> byKey, Random rng)
    {
        // The spoken item goes to the strongest word in the dose. Saying a word
        // out loud is the hardest thing the Dose asks for, so it is asked about
        // something the learner already has a grip on.
        var semaKey = selected
            .OrderByDescending(p => byKey.TryGetValue(p.Key, out var c) ? c.Strength : 0)
            .Select(p => p.Key)
            .FirstOrDefault();

        var items = new List<DoseItemDto>();
        var tapIndex = 0;

        foreach (var item in selected)
        {
            byKey.TryGetValue(item.Key, out var state);
            var strength = state?.Strength ?? 0;
            var box = state?.Box ?? 0;

            if (item.Key == semaKey)
            {
                items.Add(new DoseItemDto(
                    item.Key, ItemKinds.Vocab, DoseExercises.Sema,
                    item.Source, item.Target, new List<string>(),
                    strength, box, item.LessonId, item.LessonTitle));
                continue;
            }

            // Recognise and produce alternate, so the same word asked two days
            // running is not the same question two days running.
            var exercise = tapIndex++ % 2 == 0 ? DoseExercises.Tambua : DoseExercises.Tunga;

            var (prompt, answer, others) = exercise == DoseExercises.Tambua
                ? (item.Target, item.Source, pool.Select(p => p.Source))
                : (item.Source, item.Target, pool.Select(p => p.Target));

            var distractors = others
                .Where(o => !string.Equals(o, answer, StringComparison.OrdinalIgnoreCase))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(_ => rng.Next())
                .Take(OptionCount - 1);

            var options = distractors.Append(answer).OrderBy(_ => rng.Next()).ToList();

            // The correct answer is deliberately not sent — the client posts the
            // learner's choice back and the server decides, the same way
            // LessonCatalog.GetSafe keeps quiz answers off the wire.
            items.Add(new DoseItemDto(
                item.Key, ItemKinds.Vocab, exercise,
                prompt, exercise == DoseExercises.Tambua ? item.Target : null, options,
                strength, box, item.LessonId, item.LessonTitle));
        }

        return items;
    }

    // Seeded on the learner and the calendar day so a reload returns the same
    // dose rather than reshuffling it mid-session. Deliberately not
    // HashCode.Combine, which is salted per process and would change the dose on
    // every restart.
    private static Random Rng(int userId, DateOnly day) =>
        new(unchecked(userId * 397 ^ day.DayNumber));

    // Grade one answer and move the item's due date. Creates the card on first
    // sight, which is why a learner can start a dose without any prior state.
    public async Task<(CardState Card, bool Correct)> AnswerAsync(
        User user, PoolItem item, string exercise, string? answer, int? speechScore,
        CancellationToken ct = default)
    {
        var course = Courses.Get(user.CourseId);

        var card = await _db.CardStates
            .FirstOrDefaultAsync(c => c.UserId == user.Id && c.CourseId == course.Id && c.ItemKey == item.Key, ct);

        if (card is null)
        {
            card = _scheduler.NewCard(user.Id, course.Id, item.Key, ItemKinds.Vocab, item.LessonId);
            _db.CardStates.Add(card);
        }

        var correct = exercise switch
        {
            // Self-reported by the client, which relays what SpeechController
            // scored. Nothing but this learner's own review schedule depends on
            // it — no XP, no streak, no ranking — so there is nothing to gain by
            // inflating it.
            DoseExercises.Sema => (speechScore ?? 0) >= SemaPassScore,
            DoseExercises.Tambua => Matches(answer, item.Source),
            DoseExercises.Tunga => Matches(answer, item.Target),
            _ => false,
        };

        _scheduler.Grade(card, correct, exercise == DoseExercises.Sema ? speechScore : null, DateTime.UtcNow);
        await _db.SaveChangesAsync(ct);

        return (card, correct);
    }

    private static bool Matches(string? given, string expected) =>
        !string.IsNullOrWhiteSpace(given)
        && string.Equals(given.Trim(), expected.Trim(), StringComparison.OrdinalIgnoreCase);

    public static bool IsKnownExercise(string? exercise) =>
        exercise is DoseExercises.Tambua or DoseExercises.Tunga or DoseExercises.Sema;

    public int IntervalDays(CardState card) => _scheduler.IntervalDays(card);
}
