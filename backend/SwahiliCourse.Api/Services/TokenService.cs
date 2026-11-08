using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using SwahiliCourse.Api.Models;

namespace SwahiliCourse.Api.Services;

public class TokenService
{
    private readonly JwtSettings _jwt;

    // Takes the key Program.cs resolved rather than re-reading configuration,
    // so the token is signed with whatever the authentication handler will
    // validate it against. See JwtSettings.
    public TokenService(JwtSettings jwt) => _jwt = jwt;

    public string CreateToken(User user)
    {
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim("displayName", user.DisplayName),
        };

        var creds = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Key)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _jwt.Issuer,
            audience: _jwt.Issuer,
            claims: claims,
            expires: DateTime.UtcNow.AddDays(30),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
