using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using SwahiliCourse.Api.Services;

namespace SwahiliCourse.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
// Anonymous and metered: cloud TTS bills per character.
[EnableRateLimiting("media")]
public class TtsController : ControllerBase
{
    private readonly TtsService _tts;
    public TtsController(TtsService tts) => _tts = tts;

    // GET /api/tts/status?course=sw — lets clients decide whether to use cloud
    // audio or the built-in voice. Per course, because one course can have a
    // provider of its own.
    [HttpGet("status")]
    [AllowAnonymous]
    public IActionResult Status([FromQuery] string? course) =>
        Ok(new { enabled = _tts.IsConfiguredFor(Models.Courses.Get(course)) });

    // GET /api/tts?text=ninasoma&course=sw
    // Public so it can be used directly as an <audio> source. The course selects
    // which language/voice speaks the text (defaults to the Swahili course).
    // Returns:
    //   200 audio/mpeg  — synthesized (and cached) speech
    //   204 No Content  — TTS not configured / unavailable → client uses built-in voice
    //   400             — invalid input
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> Get([FromQuery] string text, [FromQuery] string? course, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(text)) return BadRequest("text is required");

        text = text.Trim();
        // Pronunciation snippets only — keep it short and free of control characters.
        if (text.Length > 60) return BadRequest("text too long");
        if (text.Any(char.IsControl)) return BadRequest("invalid characters");

        var forCourse = Models.Courses.Get(course);
        if (!_tts.IsConfiguredFor(forCourse)) return NoContent();

        var audio = await _tts.SynthesizeAsync(text, forCourse, ct);
        if (audio is null || audio.Bytes.Length == 0) return NoContent();

        // Words are immutable — let the browser cache aggressively.
        Response.Headers.CacheControl = "public, max-age=2592000, immutable";
        return File(audio.Bytes, audio.ContentType);
    }
}
