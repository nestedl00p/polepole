using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using SwahiliCourse.Api.Services;

namespace SwahiliCourse.Api.Controllers;

// The habit-test read-out, for whoever runs PolePole — not for learners.
//
// This is the endpoint for scripts: no account, just a key. (Signed-in admins
// read the same report in the backoffice, GET /api/admin/habit.) A learner's
// JWT must not unlock it, so it is gated on a separate key from
// configuration (Habit:ReportKey) sent in the X-Report-Key header. With no key
// configured the endpoint answers 404, exactly as if it did not exist: an
// unconfigured deployment exposes nothing.
[ApiController]
[Route("api/[controller]")]
public class HabitController : ControllerBase
{
    private readonly HabitReport _report;
    private readonly IConfiguration _config;

    public HabitController(HabitReport report, IConfiguration config)
    {
        _report = report;
        _config = config;
    }

    [HttpGet("report")]
    public async Task<IActionResult> Report(CancellationToken ct)
    {
        var expected = _config["Habit:ReportKey"];
        if (string.IsNullOrWhiteSpace(expected)) return NotFound();

        var given = Request.Headers["X-Report-Key"].ToString();

        // Constant-time, and 404 rather than 401 on a miss, so the response
        // does not confirm that there is something here to guess at.
        var match = CryptographicOperations.FixedTimeEquals(
            SHA256.HashData(Encoding.UTF8.GetBytes(given)),
            SHA256.HashData(Encoding.UTF8.GetBytes(expected)));
        if (!match) return NotFound();

        return Ok(await _report.BuildAsync(DateTime.UtcNow, ct));
    }
}
