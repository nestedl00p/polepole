using SwahiliCourse.Api.Models;

namespace SwahiliCourse.Api.Services;

// Holds one LessonCatalog per course direction, loaded at startup.
// Controllers resolve the catalog for the signed-in user's course.
public class CourseCatalog
{
    private readonly Dictionary<string, LessonCatalog> _byCourse = new(StringComparer.OrdinalIgnoreCase);
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
    }

    public LessonCatalog For(string? courseId) =>
        _byCourse.TryGetValue(courseId ?? Courses.Default, out var c) ? c : _byCourse[Courses.Default];

    public IEnumerable<(Course Course, LessonCatalog Catalog)> AllCourses =>
        Courses.All.Select(c => (c, For(c.Id)));
}
