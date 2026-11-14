using SwahiliCourse.Api.DTOs;
using SwahiliCourse.Api.Models;

namespace SwahiliCourse.Api.Services;

// The pre-signup Dose: three items and a proverb, with no account.
//
// Registration used to ask for a course direction, a name, an email, a
// password and a plan length before the learner had been given anything. This
// turns that round: the first thing a visitor does is the thing the product is
// for, and the account is offered afterwards as a way to keep what they just
// did.
//
// Pre-seeded rather than scheduled — there is no learner yet to schedule for —
// so it is the same three words for everyone, drawn from the first lesson, and
// those words are waiting as cards when the learner reaches that lesson.
//
// See docs/DAILY-PRACTICE-LOOP.md, "Reminder time and your why".
public class TasterService
{
    public const int Size = 3;
    private const int OptionCount = 4;

    // How much of the first lesson's vocabulary the distractors are drawn from.
    private const int PoolSize = 8;

    private readonly CourseCatalog _courses;

    public TasterService(CourseCatalog courses) => _courses = courses;

    private record Pair(string Target, string Source);

    private List<Pair> Pool(Course course)
    {
        var first = _courses.For(course.Id).All.OrderBy(l => l.Id).FirstOrDefault();
        if (first is null) return new List<Pair>();

        var seen = new HashSet<string>(StringComparer.Ordinal);
        return first.Vocabulary
            .Select(v => course.TargetLanguage == "en" ? new Pair(v.English, v.Swahili) : new Pair(v.Swahili, v.English))
            .Where(p => !string.IsNullOrWhiteSpace(p.Target) && !string.IsNullOrWhiteSpace(p.Source))
            .Where(p => seen.Add(p.Target))
            .Take(PoolSize)
            .ToList();
    }

    // Recognise, produce, recognise. No spoken item: asking a stranger for
    // their microphone before giving them anything is the wrong first move.
    private static string ExerciseFor(int index) =>
        index % 2 == 0 ? DoseExercises.Tambua : DoseExercises.Tunga;

    public TasterDto Build(string? courseId)
    {
        var course = Courses.Get(courseId);
        var pool = Pool(course);
        var items = new List<DoseItemDto>();

        if (pool.Count >= OptionCount)
        {
            // A fixed seed: the taster is the same on every load, so a visitor
            // who reloads cannot fish for an easier one, and the options do
            // not jump around under them.
            var rng = new Random(20_240 + (course.Id == Courses.English ? 1 : 0));

            for (var i = 0; i < Size; i++)
            {
                var pair = pool[i];
                var exercise = ExerciseFor(i);
                var tambua = exercise == DoseExercises.Tambua;
                var answer = tambua ? pair.Source : pair.Target;

                var options = pool
                    .Select(p => tambua ? p.Source : p.Target)
                    .Where(o => !string.Equals(o, answer, StringComparison.OrdinalIgnoreCase))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(_ => rng.Next())
                    .Take(OptionCount - 1)
                    .Append(answer)
                    .OrderBy(_ => rng.Next())
                    .ToList();

                // As in the real dose, the answer stays off the wire until a
                // choice has been posted.
                items.Add(new DoseItemDto(
                    pair.Target, ItemKinds.Vocab, exercise,
                    tambua ? pair.Target : pair.Source,
                    tambua ? pair.Target : null,
                    options, 0, 0, 0, string.Empty, null));
            }
        }

        var methali = Methali(course);
        return new TasterDto(
            course.Id, items,
            methali is null ? null : new TasterMethaliDto(methali.Target, methali.Source, methali.Note));
    }

    // The proverb every taster ends on. The first in the file, which for the
    // Swahili course is the one that explains the app's name.
    public Methali? Methali(Course course) =>
        _courses.MethaliFor(course.Id).All.FirstOrDefault();

    // Grade one taster answer. Null when the key is not a taster item, so the
    // endpoint cannot be used to probe the rest of the course's answers.
    public TasterResultDto? Grade(string? courseId, string itemKey, string exercise, string? answer)
    {
        var course = Courses.Get(courseId);
        var pool = Pool(course);
        if (pool.Count < OptionCount) return null;

        var index = pool.Take(Size).ToList().FindIndex(p => string.Equals(p.Target, itemKey, StringComparison.Ordinal));
        if (index < 0) return null;

        // The exercise is fixed by position; what the client claims it was
        // asked is ignored if it disagrees.
        if (exercise != ExerciseFor(index)) return null;

        var pair = pool[index];
        var expected = exercise == DoseExercises.Tambua ? pair.Source : pair.Target;
        var correct = !string.IsNullOrWhiteSpace(answer)
            && string.Equals(answer.Trim(), expected.Trim(), StringComparison.OrdinalIgnoreCase);

        return new TasterResultDto(itemKey, correct, expected);
    }

    // Turn a new account's taster answers into its first cards, so "keep your
    // progress" is literally true. Re-graded here rather than trusted: the
    // client reports what was tapped, not whether it was right.
    //
    // The cards sit quietly until the learner opens the first lesson — the
    // dose only draws on lessons that have been viewed — and are then already
    // in the queue with the history they earned here.
    public int Seed(User user, IEnumerable<TasterAnswerDto> answers, ReviewScheduler scheduler, DateTime nowUtc)
    {
        var course = Courses.Get(user.CourseId);
        var firstLessonId = _courses.For(course.Id).All.OrderBy(l => l.Id).FirstOrDefault()?.Id ?? 0;
        var seeded = new HashSet<string>(StringComparer.Ordinal);

        foreach (var given in answers.Take(Size))
        {
            if (given is null || string.IsNullOrWhiteSpace(given.ItemKey)) continue;
            var graded = Grade(course.Id, given.ItemKey, given.Exercise, given.Answer);
            if (graded is null || !seeded.Add(graded.ItemKey)) continue;

            var card = scheduler.NewCard(user.Id, course.Id, graded.ItemKey, ItemKinds.Vocab, firstLessonId);
            var answer = new ReviewScheduler.Answer(graded.Correct);
            scheduler.Grade(card, answer, nowUtc);
            user.Cards.Add(card);
            user.TotalXp += DoseXp.ForAnswer(given.Exercise, graded.Correct, ReviewScheduler.Quality(answer), Random.Shared);
        }

        // The proverb was handed over at the end of the taster, so it is theirs.
        if (seeded.Count > 0 && Methali(course) is Methali methali)
        {
            var card = scheduler.NewCard(user.Id, course.Id, methali.Key, ItemKinds.Methali, 0);
            scheduler.Grade(card, new ReviewScheduler.Answer(true), nowUtc);
            user.Cards.Add(card);
        }

        return seeded.Count;
    }
}
