using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace SwahiliCourse.Api.Controllers;

public abstract class AuthedController : ControllerBase
{
    protected int CurrentUserId
    {
        get
        {
            var id = User.FindFirstValue("sub")
                     ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);
            if (int.TryParse(id, out var userId)) return userId;
            throw new InvalidOperationException("No valid user id in token.");
        }
    }
}
