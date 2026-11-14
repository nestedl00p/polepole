using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SwahiliCourse.Api.Data;
using SwahiliCourse.Api.DTOs;
using SwahiliCourse.Api.Services;

namespace SwahiliCourse.Api.Controllers;

// "Nitakumbuka hii" — the learner's own marks on the deck.
//
// A pin is a small investment that makes tomorrow's dose better than today's:
// DoseService.Select gives pinned cards priority, so what the learner chose to
// remember is what they are shown. It is also what makes the deck theirs
// rather than the course's.
//
// See docs/DAILY-PRACTICE-LOOP.md, "Investment".
[ApiController]
[Authorize]
[Route("api/[controller]")]
public class CardsController : AuthedController
{
    private readonly AppDbContext _db;
    private readonly DoseService _dose;

    public CardsController(AppDbContext db, DoseService dose)
    {
        _db = db;
        _dose = dose;
    }

    // Pin or unpin. The design sketched this as POST /api/cards/{key}/pin, but
    // a key is the word itself — "yeye / wao", "Habari?" — and a slash or a
    // question mark in a path segment does not survive every proxy between a
    // phone and this API. The key travels in the body instead.
    [HttpPost("pin")]
    public async Task<ActionResult<PinDto>> Pin(PinDto dto, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.ItemKey))
            return BadRequest(new { message = "itemKey is required." });

        var user = await _db.Users.FindAsync([CurrentUserId], ct);
        if (user is null) return Unauthorized();

        // Only something this learner has actually met can be pinned.
        var item = await _dose.FindAsync(user, dto.ItemKey, ct);
        if (item is null) return NotFound(new { message = "That item is not in your deck." });

        var card = await _dose.PinAsync(user, item, dto.Pinned, ct);
        return Ok(new PinDto(card.ItemKey, card.Pinned));
    }
}
