using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SwahiliCourse.Api.Services;

namespace SwahiliCourse.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SpeechController : ControllerBase
{
    private readonly SpeechService _speech;
    public SpeechController(SpeechService speech) => _speech = speech;

    // GET /api/speech/status — lets the client decide whether to show the
    // speak-and-check mic (self-hosted Whisper sidecar must be enabled).
    [HttpGet("status")]
    [AllowAnonymous]
    public IActionResult Status() => Ok(new { enabled = _speech.IsConfigured });

    // POST /api/speech/assess  (multipart/form-data: file=<audio>, referenceText=<target phrase>)
    // Returns transcription + pronunciation/word-match scoring. 204 when speech
    // scoring isn't configured or the sidecar is unreachable → client degrades gracefully.
    [HttpPost("assess")]
    [AllowAnonymous]
    [RequestSizeLimit(15_000_000)] // ~15 MB — short spoken clips only
    public async Task<IActionResult> Assess(
        [FromForm] IFormFile? file, [FromForm] string? referenceText, [FromForm] string? course, CancellationToken ct)
    {
        if (!_speech.IsConfigured) return NoContent();
        if (file is null || file.Length == 0) return BadRequest("audio file is required");
        if (string.IsNullOrWhiteSpace(referenceText)) return BadRequest("referenceText is required");
        if (referenceText.Length > 120) return BadRequest("referenceText too long");

        await using var stream = file.OpenReadStream();
        var result = await _speech.AssessAsync(
            stream, file.ContentType, file.FileName, referenceText, Models.Courses.Get(course), ct);
        if (result is null) return NoContent();

        return Ok(result);
    }
}
