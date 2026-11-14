using Microsoft.EntityFrameworkCore;
using SwahiliCourse.Api.Data;
using SwahiliCourse.Api.DTOs;
using SwahiliCourse.Api.Models;

namespace SwahiliCourse.Api.Services;

// Assembles "Dose ya leo" — the day's five review items, plus, now and then, a
// sixth the learner was not expecting.
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

    // Roughly one dose in four carries a proverb. Often enough that opening the
    // app is worth it on a day the learner does not feel like studying, rare
    // enough that it stays a surprise — a bonus on every dose is just a sixth
    // item.
    private const int MethaliOdds = 4;

    private readonly AppDbContext _db;
    private readonly CourseCatalog _courses;
    private readonly ReviewScheduler _scheduler;
    private readonly StreakService _streaks;

    public DoseService(AppDbContext db, CourseCatalog courses, ReviewScheduler scheduler, StreakService streaks)
    {
        _db = db;
        _courses = courses;
        _scheduler = scheduler;
        _streaks = streaks;
    }

    // An item the learner can be asked about: Target is the side being learned
    // (and the side spoken aloud), Source its translation.
    public record PoolItem(
        string Key, string Target, string Source, string Kind,
        int LessonId, string LessonTitle, string? Note);

    public async Task<DoseDto> BuildAsync(User user, CancellationToken ct = default)
    {
        var course = Courses.Get(user.CourseId);

        // The learner's own day, not UTC's — the same day the streak counts.
        var now = DateTime.UtcNow;
        var today = _streaks.TodayFor(user, now);
        var doneToday = _streaks.HasDosedToday(user, now);

        var states = await _db.CardStates
            .Where(c => c.UserId == user.Id && c.CourseId == course.Id)
            .ToListAsync(ct);
        var byKey = states.ToDictionary(c => c.ItemKey, StringComparer.Ordinal);

        var pool = await PoolAsync(user, byKey, ct);

        if (pool.Count < MinimumPool)
        {
            var message = course.SourceLanguage == "sw"
                ? "Soma masomo machache zaidi ili kufungua dose ya leo."
                : "Study a few more lessons to unlock your daily dose.";
            return new DoseDto(today.ToString("yyyy-MM-dd"), 0, new List<DoseItemDto>(), message, doneToday);
        }

        var selected = Select(pool, byKey, Rng(user.Id, today));
        var items = Compose(selected, pool, byKey, Rng(user.Id, today));

        // The bonus goes last, so the dose still ends on something the learner
        // was not expecting rather than on another drill.
        var bonus = PickMethali(user, byKey, today);
        if (bonus is not null) items.Add(bonus);

        return new DoseDto(today.ToString("yyyy-MM-dd"), items.Count, items, null, doneToday);
    }

    // Look one item up by key, for grading an answer. Returns null when the key
    // is not something this learner can be shown.
    public async Task<PoolItem?> FindAsync(User user, string itemKey, CancellationToken ct = default)
    {
        // A proverb is answerable the moment it is offered, including the very
        // first time, so it is resolved straight from the catalog rather than
        // from what the learner has already met.
        if (itemKey.StartsWith(ItemKinds.Methali + ":", StringComparison.Ordinal))
        {
            var methali = _courses.MethaliFor(user.CourseId).ByKey(itemKey);
            return methali is null ? null : ToPoolItem(methali);
        }

        var pool = await PoolAsync(user, null, ct);
        return pool.FirstOrDefault(p => string.Equals(p.Key, itemKey, StringComparison.Ordinal));
    }

    private static PoolItem ToPoolItem(Methali m) =>
        new(m.Key, m.Target, m.Source, ItemKinds.Methali, 0, "Methali", m.Note);

    // Everything the learner has met: vocabulary from the lessons they have
    // opened, deduped by target word so a word taught twice is one card, plus
    // any proverb they have already been handed.
    private async Task<List<PoolItem>> PoolAsync(
        User user, Dictionary<string, CardState>? byKey, CancellationToken ct)
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
                pool.Add(new PoolItem(target, target, source, ItemKinds.Vocab, lesson.Id, lesson.Title, null));
            }
        }

        // A proverb joins the review queue once it has been handed out, so the
        // bonus compounds into the deck instead of being a one-off.
        if (byKey is null)
        {
            var keys = await _db.CardStates
                .Where(c => c.UserId == user.Id && c.CourseId == course.Id && c.ItemKind == ItemKinds.Methali)
                .Select(c => c.ItemKey)
                .ToListAsync(ct);
            byKey = keys.ToDictionary(k => k, _ => (CardState)null!, StringComparer.Ordinal);
        }

        foreach (var methali in _courses.MethaliFor(user.CourseId).All)
        {
            if (byKey.ContainsKey(methali.Key)) pool.Add(ToPoolItem(methali));
        }

        return pool;
    }

    // Which side of a vocab pair is being learned depends on the course
    // direction, exactly as ReviewController does it.
    private static (string target, string source) Sides(VocabItem v, Course course) =>
        course.TargetLanguage == "en" ? (v.English, v.Swahili) : (v.Swahili, v.English);

    // The bonus proverb, when the day's roll calls for one and the learner has
    // not met them all. Both the roll and the choice come from the day seed, so
    // reloading cannot re-roll for a better one.
    private DoseItemDto? PickMethali(User user, Dictionary<string, CardState> byKey, DateOnly today)
    {
        var unseen = _courses.MethaliFor(user.CourseId).All
            .Where(m => !byKey.ContainsKey(m.Key))
            .ToList();
        if (unseen.Count == 0) return null;

        var rng = Rng(user.Id * 31 + 7, today);
        if (rng.Next(MethaliOdds) != 0) return null;

        var pick = unseen[rng.Next(unseen.Count)];
        return new DoseItemDto(
            pick.Key, ItemKinds.Methali, DoseExercises.Methali,
            pick.Source, pick.Target, new List<string>(),
            0, 0, 0, "Methali", pick.Note);
    }

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

    // Turn the selected items into questions: one spoken, the rest alternating
    // between recognising and producing.
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
                    item.Key, item.Kind, DoseExercises.Sema,
                    item.Source, item.Target, new List<string>(),
                    strength, box, item.LessonId, item.LessonTitle, item.Note));
                continue;
            }

            // Recognise and produce alternate, so the same word asked two days
            // running is not the same question two days running.
            var exercise = tapIndex++ % 2 == 0 ? DoseExercises.Tambua : DoseExercises.Tunga;

            // Distractors come from items of the same kind: a proverb among
            // single words gives itself away by length alone.
            var sameKind = pool.Where(p => p.Kind == item.Kind);
            var (prompt, answer, others) = exercise == DoseExercises.Tambua
                ? (item.Target, item.Source, sameKind.Select(p => p.Source))
                : (item.Source, item.Target, sameKind.Select(p => p.Target));

            var distractors = others
                .Where(o => !string.Equals(o, answer, StringComparison.OrdinalIgnoreCase))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(_ => rng.Next())
                .Take(OptionCount - 1)
                .ToList();

            // Too few of this kind to build a question — ask it as recognition
            // against the whole pool rather than dropping the item.
            if (distractors.Count < OptionCount - 1)
            {
                distractors = pool
                    .Select(p => exercise == DoseExercises.Tambua ? p.Source : p.Target)
                    .Where(o => !string.Equals(o, answer, StringComparison.OrdinalIgnoreCase))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(_ => rng.Next())
                    .Take(OptionCount - 1)
                    .ToList();
            }

            var options = distractors.Append(answer).OrderBy(_ => rng.Next()).ToList();

            // The correct answer is deliberately not sent — the client posts the
            // learner's choice back and the server decides, the same way
            // LessonCatalog.GetSafe keeps quiz answers off the wire.
            items.Add(new DoseItemDto(
                item.Key, item.Kind, exercise,
                prompt, exercise == DoseExercises.Tambua ? item.Target : null, options,
                strength, box, item.LessonId, item.LessonTitle, item.Note));
        }

        return items;
    }

    // Seeded on the learner and the calendar day so a reload returns the same
    // dose rather than reshuffling it mid-session. Deliberately not
    // HashCode.Combine, which is salted per process and would change the dose on
    // every restart.
    private static Random Rng(int userId, DateOnly day) =>
        new(unchecked(userId * 397 ^ day.DayNumber));

    // Grade one answer, move the item's due date and pay out. Creates the card
    // on first sight, which is why a learner can start a dose without any prior
    // state.
    public async Task<(CardState Card, bool Correct, int XpEarned)> AnswerAsync(
        User user, PoolItem item, string exercise, string? answer, int? speechScore, int? elapsedMs,
        CancellationToken ct = default)
    {
        var course = Courses.Get(user.CourseId);

        var card = await _db.CardStates
            .FirstOrDefaultAsync(c => c.UserId == user.Id && c.CourseId == course.Id && c.ItemKey == item.Key, ct);

        if (card is null)
        {
            card = _scheduler.NewCard(user.Id, course.Id, item.Key, item.Kind, item.LessonId);
            _db.CardStates.Add(card);
        }

        var correct = exercise switch
        {
            // A proverb is handed to the learner, not tested on them. Reading it
            // is the whole interaction, so it always counts — and it enters the
            // queue, where it will be asked properly from tomorrow.
            DoseExercises.Methali => true,
            // Self-reported by the client, which relays what SpeechController
            // scored. Only this learner's own review schedule and a handful of
            // XP depend on it, so there is nothing to gain by inflating it.
            DoseExercises.Sema => (speechScore ?? 0) >= SemaPassScore,
            DoseExercises.Tambua => Matches(answer, item.Source),
            DoseExercises.Tunga => Matches(answer, item.Target),
            _ => false,
        };

        var graded = new ReviewScheduler.Answer(
            correct, elapsedMs, exercise == DoseExercises.Sema ? speechScore : null);

        _scheduler.Grade(card, graded, DateTime.UtcNow);

        var xp = DoseXp.ForAnswer(exercise, correct, ReviewScheduler.Quality(graded), Random.Shared);
        user.TotalXp += xp;

        await _db.SaveChangesAsync(ct);

        return (card, correct, xp);
    }

    private static bool Matches(string? given, string expected) =>
        !string.IsNullOrWhiteSpace(given)
        && string.Equals(given.Trim(), expected.Trim(), StringComparison.OrdinalIgnoreCase);

    public static bool IsKnownExercise(string? exercise) =>
        exercise is DoseExercises.Tambua or DoseExercises.Tunga
            or DoseExercises.Sema or DoseExercises.Methali;

    public int IntervalDays(CardState card) => _scheduler.IntervalDays(card);

    // Close out a dose: credit the day, pay the completion bonus and report any
    // threshold the learner has just crossed.
    //
    // The item count is taken from the cards actually touched today rather than
    // from anything the client sends, so opening and abandoning a dose cannot
    // claim a streak day.
    public async Task<DoseCompleteResultDto> CompleteAsync(User user, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var course = Courses.Get(user.CourseId);
        var today = _streaks.TodayFor(user, now);

        // Midnight where the learner is, expressed as an instant to compare
        // against the UTC timestamps on the cards.
        var dayStartUtc = TimeZoneInfo.ConvertTimeToUtc(
            DateTime.SpecifyKind(today.ToDateTime(TimeOnly.MinValue), DateTimeKind.Unspecified),
            _streaks.ZoneFor(user));

        var cards = await _db.CardStates
            .Where(c => c.UserId == user.Id && c.CourseId == course.Id)
            .ToListAsync(ct);

        var answeredToday = cards.Count(c => c.LastSeenAt != null && c.LastSeenAt >= dayStartUtc);

        if (answeredToday == 0)
        {
            return new DoseCompleteResultDto(
                today.ToString("yyyy-MM-dd"), 0,
                user.StreakCount, StreakAdvanced: false, RestDayUsed: false,
                AlreadyCountedToday: false, _streaks.RestDayAvailable(user, today),
                XpEarned: 0, user.TotalXp, new List<MilestoneDto>());
        }

        var streak = _streaks.Record(user, now);

        // The completion bonus is for closing the dose, so it is paid once a day
        // however many times the learner comes back with "endelea".
        var xp = streak.AlreadyCountedToday ? 0 : DoseXp.ForCompletion(Random.Shared);
        user.TotalXp += xp;
        user.LastDoseAt = now;

        var seen = Milestones.Parse(user.MilestonesSeen);
        var crossed = Milestones.CrossedBy(
            metWords: cards.Count(c => c.ItemKind == ItemKinds.Vocab && c.Box >= 1),
            masteredWords: cards.Count(c => c.ItemKind == ItemKinds.Vocab && c.Box >= ReviewScheduler.MaxBox),
            methaliCollected: cards.Count(c => c.ItemKind == ItemKinds.Methali),
            alreadySeen: seen);
        if (crossed.Count > 0) user.MilestonesSeen = Milestones.Serialize(seen);

        await _db.SaveChangesAsync(ct);

        return new DoseCompleteResultDto(
            today.ToString("yyyy-MM-dd"), answeredToday,
            streak.StreakCount, streak.Advanced, streak.RestDayUsed,
            streak.AlreadyCountedToday, _streaks.RestDayAvailable(user, today),
            xp, user.TotalXp, crossed);
    }
}
