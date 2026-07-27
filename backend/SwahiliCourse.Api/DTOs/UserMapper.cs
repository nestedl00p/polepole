using SwahiliCourse.Api.Models;
using SwahiliCourse.Api.Services;

namespace SwahiliCourse.Api.DTOs;

// Single place that shapes a User (plus its course) for the API, so Auth and
// User controllers can't drift apart.
public static class UserMapper
{
    public static CourseDto ToDto(Course c) => new(
        c.Id, c.Title, c.Subtitle, c.Description,
        c.TargetLanguage, c.SourceLanguage, c.TtsLocale, c.Flag);

    public static UserDto ToDto(User u, PaceService pace) => new(
        u.Id, u.Email, u.DisplayName, u.PlanLengthDays, u.StartDate,
        u.StreakCount, u.TotalXp, pace.CurrentScheduledDay(u),
        ToDto(Courses.Get(u.CourseId)));
}
