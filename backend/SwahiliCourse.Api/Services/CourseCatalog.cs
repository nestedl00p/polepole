using SwahiliCourse.Api.Models;

namespace SwahiliCourse.Api.Services;

// Holds one LessonCatalog per course direction, loaded at startup.
// Controllers resolve the catalog for the signed-in user's course.
public class CourseCatalog
{
    private readonly Dictionary<string, LessonCatalog> _byCourse = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, MethaliCatalog> _methaliByCourse = new(StringComparer.OrdinalIgnoreCase);
    private readonly ILogger<CourseCatalog> _log;

    public CourseCatalog(IWebHostEnvironment env, ILogger<CourseCatalog> log)
    {
        _log = log;
        foreach (var course in Courses.All)
        {
            var path = Path.Combine(env.ContentRootPath, "Data", course.LessonsFile);
            if (!File.Exists(path))
            {
                // A course whose content isn't authored yet loads as empty rather
                // than crashing startup — the other direction still works.
                _log.LogWarning("Course '{Course}': lessons file {File} not found; serving an empty catalog.",
                    course.Id, course.LessonsFile);
                _byCourse[course.Id] = LessonCatalog.Empty();
                continue;
            }
            _byCourse[course.Id] = LessonCatalog.FromFile(path);
        }

        foreach (var course in Courses.All)
        {
            var path = Path.Combine(env.ContentRootPath, "Data", course.MethaliFile);
            if (!File.Exists(path))
            {
                // The proverb pool is a bonus, so a direction without one still
                // runs — its doses simply never hand one out.
                _log.LogWarning("Course \x27{Course}\x27: methali file {File} not found; no proverbs will be offered.",
                    course.Id, course.MethaliFile);
                _methaliByCourse[course.Id] = MethaliCatalog.Empty();
                continue;
            }
            _methaliByCourse[course.Id] = MethaliCatalog.FromFile(path);
        }
    }

    public LessonCatalog For(string? courseId) =>
        _byCourse.TryGetValue(courseId ?? Courses.Default, out var c) ? c : _byCourse[Courses.Default];

    public MethaliCatalog MethaliFor(string? courseId) =>
        _methaliByCourse.TryGetValue(courseId ?? Courses.Default, out var m) ? m : _methaliByCourse[Courses.Default];

    public IEnumerable<(Course Course, LessonCatalog Catalog)> AllCourses =>
        Courses.All.Select(c => (c, For(c.Id)));
}
