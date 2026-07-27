namespace SwahiliCourse.Api.Services;

// On startup, if cloud TTS is configured, pre-generates (and disk-caches) audio
// for every word the lesson verbBuilders can produce, so playback is instant for
// learners. Runs in the background — never blocks app startup. Words already in
// the cache are skipped cheaply, so re-runs are nearly free.
public class TtsWarmupService : BackgroundService
{
    private readonly TtsService _tts;
    private readonly CourseCatalog _courses;
    private readonly IConfiguration _config;
    private readonly ILogger<TtsWarmupService> _log;

    public TtsWarmupService(TtsService tts, CourseCatalog courses, IConfiguration config, ILogger<TtsWarmupService> log)
    {
        _tts = tts; _courses = courses; _config = config; _log = log;
    }

    private static readonly string[] Subjects = { "ni", "u", "a", "tu", "m", "wa" };
    private static readonly string[] NegPrefixes = { "si", "hu", "ha", "hatu", "ham", "hawa" };
    private static readonly string[] Objects = { "ni", "ku", "m", "tu", "wa" };
    private static readonly string[] DefaultTenseStems = { "soma", "penda", "kula", "kunywa", "enda", "sema" };
    private static readonly string[] DefaultMutStems = { "soma", "penda", "sema", "ona", "taka", "jua" };

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_tts.IsConfigured) return; // built-in voice in use — nothing to warm
        if (!_config.GetValue("Tts:Warmup:Enabled", true)) return;

        // Spacing between calls. Default 1100ms keeps us under a typical 60 req/min
        // provider rate limit; lower it if your plan allows faster warming.
        var delayMs = Math.Max(0, _config.GetValue("Tts:Warmup:DelayMs", 1100));

        try
        {
            int done = 0;
            foreach (var (course, catalog) in _courses.AllCourses)
            {
                var words = BuildWordList(catalog, course);
                if (words.Count == 0) continue;
                _log.LogInformation("TTS warm-up [{Course}]: pre-generating {Count} words, {Delay}ms apart…",
                    course.Id, words.Count, delayMs);
                foreach (var word in words)
                {
                    if (stoppingToken.IsCancellationRequested) break;
                    await _tts.SynthesizeAsync(word, course, stoppingToken); // caches to disk
                    done++;
                    await Task.Delay(delayMs, stoppingToken);
                }
            }
            _log.LogInformation("TTS warm-up complete: {Done} words ready.", done);
        }
        catch (OperationCanceledException) { /* shutting down */ }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "TTS warm-up did not finish.");
        }
    }

    // Mirrors the frontend VerbBuilder assembly rules, driven by the actual
    // verbBuilder blocks in lessons.json (so curated stemKeys stay in sync).
    private HashSet<string> BuildWordList(LessonCatalog catalog, Models.Course course)
    {
        var words = new HashSet<string>(StringComparer.Ordinal);
        var targetIsEnglish = course.TargetLanguage == "en";

        foreach (var lesson in catalog.All)
        {
            // Vocabulary in the course's TARGET language — that's the side the
            // 🔊 buttons speak.
            foreach (var v in lesson.Vocabulary)
            {
                var word = (targetIsEnglish ? v.English : v.Swahili)?.Trim();
                if (!string.IsNullOrEmpty(word) && word.Length <= 60)
                    words.Add(word);
            }

            // The remaining enumerations mirror the Swahili grammar builders, which
            // only appear in the Swahili course.
            if (targetIsEnglish) continue;

            foreach (var b in lesson.Blocks)
            {
                if (b.Type == "possessiveBuilder") { AddPossessives(words); continue; }
                if (b.Type == "adjectiveBuilder") { AddAdjectives(words); continue; }
                if (b.Type == "questionBuilder") { foreach (var s in QuestionSentences) words.Add(s); continue; }
                if (b.Type == "nounSorter") { foreach (var s in NounSorterPairs) words.Add(s); continue; }
                if (b.Type == "sentenceBuilder") { foreach (var s in SentenceBuilderAnswers) words.Add(s); continue; }
                if (b.Type != "verbBuilder") continue;

                var mode = b.Mode ?? "tense";
                var stems = (b.StemKeys is { Count: > 0 })
                    ? b.StemKeys
                    : (mode is "negative" or "subjunctive" ? DefaultMutStems : DefaultTenseStems).ToList();

                switch (mode)
                {
                    case "negative":
                        foreach (var p in NegPrefixes)
                            foreach (var s in stems)
                                words.Add(p + Root(s) + "i");
                        break;

                    case "subjunctive":
                        foreach (var subj in Subjects)
                            foreach (var s in stems)
                                words.Add(subj + Root(s) + "e");
                        break;

                    case "object":
                    {
                        var marker = b.Marker ?? "na";
                        foreach (var subj in Subjects)
                            foreach (var o in Objects)
                                foreach (var s in stems)
                                    words.Add(subj + marker + o + s);
                        break;
                    }

                    default: // tense (present/past/future/perfect)
                    {
                        var marker = b.Marker ?? DefaultMarker(b.Tense);
                        foreach (var subj in Subjects)
                            foreach (var s in stems)
                                words.Add(subj + marker + s);
                        break;
                    }
                }
            }
        }
        return words;
    }

    // Mirrors PossessiveBuilder's noun/concord table + possessor stems.
    private static readonly (string noun, string concord)[] PossNouns =
    {
        ("mtoto", "w"), ("watoto", "w"), ("mti", "w"), ("miti", "y"),
        ("kitabu", "ch"), ("vitabu", "vy"), ("gari", "l"), ("magari", "y"),
        ("rafiki", "y"), ("nyumba", "y"), ("ndizi", "z"), ("uso", "w"),
    };
    private static readonly string[] PossStems = { "angu", "ako", "ake", "etu", "enu", "ao" };

    // Mirrors SentenceBuilder's answer sentences.
    private static readonly string[] SentenceBuilderAnswers =
    {
        "Huyu ni rafiki yangu", "Ana watoto wawili", "Jina lake ni Asha",
        "Watoto wake ni wadogo", "Rafiki yangu ni mwalimu",
    };

    // Mirrors NounSorter's spoken noun pairs (singular, plural).
    private static readonly string[] NounSorterPairs =
    {
        "mtu, watu", "mtoto, watoto", "mti, miti", "mlango, milango",
        "kitabu, vitabu", "kiti, viti", "nyumba, nyumba", "simu, simu",
    };

    // Mirrors QuestionBuilder's example sentences (brackets stripped).
    private static readonly string[] QuestionSentences =
    {
        "Nani anakuja?", "Unataka nini?", "Unakaa wapi?", "Utasafiri lini?",
        "Kwa nini unalia?", "Una vitabu vingapi?", "Unapenda chai gani?",
    };

    private static void AddPossessives(HashSet<string> words)
    {
        foreach (var (noun, concord) in PossNouns)
            foreach (var stem in PossStems)
                words.Add($"{noun} {concord}{stem}");
    }

    // Mirrors AdjectiveBuilder's nouns (adjective concord) + adjectives (with N-form).
    private static readonly (string noun, string acord)[] AdjNouns =
    {
        ("mtu", "m"), ("watu", "wa"), ("mti", "m"), ("miti", "mi"),
        ("kitabu", "ki"), ("vitabu", "vi"), ("gari", ""), ("magari", "ma"), ("nyumba", "n"),
    };
    private static readonly (string stem, string nForm)[] Adjectives =
    {
        ("zuri", "nzuri"), ("kubwa", "kubwa"), ("dogo", "ndogo"),
        ("refu", "ndefu"), ("baya", "mbaya"), ("zito", "nzito"),
    };

    private static void AddAdjectives(HashSet<string> words)
    {
        foreach (var (noun, acord) in AdjNouns)
            foreach (var (stem, nForm) in Adjectives)
            {
                var agreed = acord == "n" ? nForm : acord == "" ? stem : acord + stem;
                words.Add($"{noun} {agreed}");
            }
    }

    private static string Root(string stem) => stem.EndsWith('a') ? stem[..^1] : stem;

    private static string DefaultMarker(string? tense) => tense switch
    {
        "past" => "li",
        "future" => "ta",
        "perfect" => "me",
        _ => "na"
    };
}
