using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SwahiliCourse.Api.Services;

namespace SwahiliCourse.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TtsController : ControllerBase
{
    private readonly TtsService _tts;
    public TtsController(TtsService tts) => _tts = tts;

    // GET /api/tts/status — lets clients decide whether to use cloud audio or the built-in voice.
    [HttpGet("status")]
    [AllowAnonymous]
    public IActionResult Status() => Ok(new { enabled = _tts.IsConfigured });

    // GET /api/tts?text=ninasoma
    // Public so it can be used directly as an <audio> source. Returns:
    //   200 audio/mpeg  — synthesized (and cached) speech
    //   204 No Content  — TTS not configured / unavailable → client uses built-in voice
    //   400             — invalid input
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> Get([FromQuery] string text, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(text)) return BadRequest("text is required");

        text = text.Trim();
        // Pronunciation snippets only — keep it short and free of control characters.
        if (text.Length > 60) return BadRequest("text too long");
        if (text.Any(char.IsControl)) return BadRequest("invalid characters");

        if (!_tts.IsConfigured) return NoContent();

        var audio = await _tts.SynthesizeAsync(text, ct);
        if (audio is null || audio.Bytes.Length == 0) return NoContent();

        // Words are immutable — let the browser cache aggressively.
        Response.Headers.CacheControl = "public, max-age=2592000, immutable";
        return File(audio.Bytes, audio.ContentType);
    }
}
