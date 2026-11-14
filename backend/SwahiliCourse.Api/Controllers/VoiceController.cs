using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SwahiliCourse.Api.Data;
using SwahiliCourse.Api.DTOs;
using SwahiliCourse.Api.Models;
using SwahiliCourse.Api.Services;

namespace SwahiliCourse.Api.Controllers;

// The learner's kept pronunciation takes.
//
// Nothing arrives here unless the learner tapped "keep this take": the speech
// endpoint scores a recording and discards it, and this is the separate,
// deliberate act of storing one. Every route is scoped to the signed-in
// learner — a take is only ever readable by the person whose voice it is.
//
// See docs/DAILY-PRACTICE-LOOP.md, "Your own voice, kept".
[ApiController]
[Authorize]
[Route("api/[controller]")]
public class VoiceController : AuthedController
{
    private readonly AppDbContext _db;
    private readonly DoseService _dose;
    private readonly VoiceStore _store;

    public VoiceController(AppDbContext db, DoseService dose, VoiceStore store)
    {
        _db = db;
        _dose = dose;
        _store = store;
    }

    private static VoiceTakeDto ToDto(VoiceTake v) => new(v.Id, v.ItemKey, v.Text, v.Score, v.CreatedAt);

    // POST /api/voice  (multipart/form-data: file=<audio>, itemKey=<card>, score=<0..100>)
    [HttpPost]
    [RequestSizeLimit(VoiceStore.MaxBytes + 64_000)]
    public async Task<ActionResult<VoiceTakeDto>> Keep(
        [FromForm] IFormFile? file, [FromForm] string? itemKey, [FromForm] int? score, CancellationToken ct)
    {
        if (file is null || file.Length == 0) return BadRequest(new { message = "An audio file is required." });
        if (file.Length > VoiceStore.MaxBytes) return BadRequest(new { message = "That recording is too long to keep." });
        if (string.IsNullOrWhiteSpace(itemKey)) return BadRequest(new { message = "itemKey is required." });

        var extension = VoiceStore.ExtensionFor(file.ContentType);
        if (extension is null) return BadRequest(new { message = "Unsupported audio type." });

        var user = await _db.Users.FindAsync([CurrentUserId], ct);
        if (user is null) return Unauthorized();

        // The text stored is the card's own, not anything the client sent.
        var item = await _dose.FindAsync(user, itemKey, ct);
        if (item is null) return NotFound(new { message = "That item is not in your deck." });

        await using var stream = file.OpenReadStream();
        var (fileName, size) = await _store.SaveAsync(user.Id, stream, extension, ct);

        var take = new VoiceTake
        {
            UserId = user.Id,
            CourseId = Courses.Get(user.CourseId).Id,
            ItemKey = item.Key,
            Text = item.Target,
            Score = Math.Clamp(score ?? 0, 0, 100),
            ContentType = VoiceStore.BaseType(file.ContentType),
            FileName = fileName,
            SizeBytes = size,
            CreatedAt = DateTime.UtcNow,
        };
        _db.VoiceTakes.Add(take);
        await _db.SaveChangesAsync(ct);

        await PruneAsync(user.Id, item.Key, ct);

        return Ok(ToDto(take));
    }

    // Keep the first take of a card for good — it is the "before" every later
    // one is played against — plus the most recent few. The ones in between
    // are the least interesting recordings a learner has, and the only ones
    // this drops.
    private async Task PruneAsync(int userId, string itemKey, CancellationToken ct)
    {
        var takes = await _db.VoiceTakes
            .Where(v => v.UserId == userId && v.ItemKey == itemKey)
            .OrderBy(v => v.CreatedAt).ThenBy(v => v.Id)
            .ToListAsync(ct);

        var surplus = takes.Skip(1).SkipLast(VoiceStore.RecentPerItem).ToList();
        if (surplus.Count == 0) return;

        foreach (var old in surplus) _store.Delete(userId, old.FileName);
        _db.VoiceTakes.RemoveRange(surplus);
        await _db.SaveChangesAsync(ct);
    }

    // GET /api/voice?itemKey=maji — this learner's takes, oldest first, so the
    // first element is the "before".
    [HttpGet]
    public async Task<ActionResult<List<VoiceTakeDto>>> List([FromQuery] string? itemKey, CancellationToken ct)
    {
        var query = _db.VoiceTakes.Where(v => v.UserId == CurrentUserId);
        if (!string.IsNullOrWhiteSpace(itemKey)) query = query.Where(v => v.ItemKey == itemKey);

        var takes = await query.OrderBy(v => v.CreatedAt).ThenBy(v => v.Id).Take(500).ToListAsync(ct);
        return Ok(takes.Select(ToDto).ToList());
    }

    // GET /api/voice/{id}/audio — the recording itself. Behind the same token
    // as everything else, so a client fetches it and plays the blob rather
    // than pointing an <audio> tag at a URL anyone could open.
    [HttpGet("{id:int}/audio")]
    public async Task<IActionResult> Audio(int id, CancellationToken ct)
    {
        var take = await _db.VoiceTakes.FirstOrDefaultAsync(v => v.Id == id && v.UserId == CurrentUserId, ct);
        if (take is null) return NotFound();

        var path = _store.PathFor(take.UserId, take.FileName);
        if (!System.IO.File.Exists(path)) return NotFound();

        Response.Headers.CacheControl = "private, max-age=3600";
        return PhysicalFile(path, take.ContentType, enableRangeProcessing: true);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var take = await _db.VoiceTakes.FirstOrDefaultAsync(v => v.Id == id && v.UserId == CurrentUserId, ct);
        if (take is null) return NotFound();

        _store.Delete(take.UserId, take.FileName);
        _db.VoiceTakes.Remove(take);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
