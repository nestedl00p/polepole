using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SwahiliCourse.Api.DTOs;
using SwahiliCourse.Api.Models;
using SwahiliCourse.Api.Services;

namespace SwahiliCourse.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CoursesController : ControllerBase
{
    private readonly CourseCatalog _courses;
    public CoursesController(CourseCatalog courses) => _courses = courses;

    // GET /api/courses — the directions available at sign-up. Anonymous so the
    // registration screen can offer the choice before an account exists.
    [HttpGet]
    [AllowAnonymous]
    public IActionResult List()
    {
        var items = Courses.All.Select(c => new
        {
            id = c.Id,
            title = c.Title,
            subtitle = c.Subtitle,
            description = c.Description,
            targetLanguage = c.TargetLanguage,
            sourceLanguage = c.SourceLanguage,
            flag = c.Flag,
            totalLessons = _courses.For(c.Id).TotalLessons,
        });
        return Ok(new { courses = items });
    }
}
