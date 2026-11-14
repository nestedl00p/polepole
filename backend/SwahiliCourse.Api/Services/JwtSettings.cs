namespace SwahiliCourse.Api.Services;

// The resolved JWT signing key and issuer.
//
// Program.cs decides these once at startup — rejecting the appsettings
// placeholder, enforcing the 32-byte minimum, and falling back to the
// development key only outside production — and registers the result here.
// Both halves of the token round trip then read the same value.
//
// Reading Jwt:Key straight from IConfiguration in one half is what previously
// broke local dev: the signing side took the shipped "CHANGE-THIS-..."
// placeholder while the validating side rejected it and used the development
// key, so every token came back "signature key was not found".
public record JwtSettings(string Key, string Issuer);
