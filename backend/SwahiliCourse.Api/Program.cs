using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.IdentityModel.Tokens;
using SwahiliCourse.Api.Data;
using SwahiliCourse.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Keep JWT claim names as-is (don't remap "sub" to the long XML claim URI).
System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();

// --- Services ---
// SQLite location. In a container the working directory is ephemeral, so set
// DataDir (e.g. /home/data on Azure App Service, a mounted volume elsewhere) to
// a persistent path — the DB is created there and survives restarts. Falls back
// to the configured connection string / local file for dev.
var dataDir = builder.Configuration["DataDir"];
string connectionString;
if (!string.IsNullOrWhiteSpace(dataDir))
{
    Directory.CreateDirectory(dataDir);
    connectionString = $"Data Source={Path.Combine(dataDir, "swahili.db")}";
}
else
{
    connectionString = builder.Configuration.GetConnectionString("Default") ?? "Data Source=swahili.db";
}
builder.Services.AddDbContext<AppDbContext>(opt => opt.UseSqlite(connectionString));

// One lesson catalog per course direction (Swahili-for-English, English-for-Swahili).
builder.Services.AddSingleton<CourseCatalog>();
builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<PaceService>();

// The daily practice loop: per-item spaced repetition behind "Dose ya leo".
// The scheduler is pure arithmetic over Leitner boxes, so it is a singleton;
// DoseService reads the learner's cards and so follows the DbContext scope.
builder.Services.AddSingleton<ReviewScheduler>();
builder.Services.AddScoped<DoseService>();

// Cloud text-to-speech (Google/Azure) with on-disk caching. Optional — falls back
// to the browser/device built-in voice when no provider key is configured.
builder.Services.AddHttpClient();
builder.Services.AddSingleton<TtsService>();
builder.Services.AddHostedService<TtsWarmupService>();

// Speech-to-text pronunciation scoring via a self-hosted Whisper sidecar.
// Optional — disabled unless Speech:Enabled is true and the sidecar is running.
builder.Services.AddSingleton<SpeechService>();

builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS. The single-container deploy serves the frontend from wwwroot, so it is
// same-origin and needs none of this; the defaults below just cover the React
// dev server. When the frontend is hosted separately (e.g. a static site on
// Vercel), list its origin in Cors:AllowedOrigins — a comma-separated list, so
// a single environment variable does it:
//   Cors__AllowedOrigins=https://polepole.vercel.app
// An entry may use a "*." wildcard (https://*.vercel.app) to match subdomains,
// which covers Vercel's per-deployment preview URLs — at the cost of letting any
// site on that domain call the API, so prefer exact origins in production.
// Auth is a Bearer token from localStorage rather than a cookie, so credentials
// are deliberately not allowed.
const string CorsPolicy = "frontend";
var corsSetting = builder.Configuration["Cors:AllowedOrigins"];
var allowedOrigins = string.IsNullOrWhiteSpace(corsSetting)
    ? new[] { "http://localhost:5173", "http://localhost:3000" }
    : corsSetting.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

static bool OriginMatches(string origin, string pattern)
{
    var star = pattern.IndexOf("*.", StringComparison.Ordinal);
    if (star < 0) return string.Equals(origin, pattern, StringComparison.OrdinalIgnoreCase);

    var scheme = pattern[..star];           // "https://"
    var suffix = pattern[(star + 1)..];     // ".vercel.app"
    return origin.StartsWith(scheme, StringComparison.OrdinalIgnoreCase)
        && origin.EndsWith(suffix, StringComparison.OrdinalIgnoreCase)
        && origin.Length > scheme.Length + suffix.Length;   // require a real subdomain
}

builder.Services.AddCors(o => o.AddPolicy(CorsPolicy, p =>
    p.SetIsOriginAllowed(origin => allowedOrigins.Any(pattern => OriginMatches(origin, pattern)))
     .AllowAnyHeader()
     .AllowAnyMethod()));

// Azure App Service terminates TLS and proxies the request, so the real client
// address arrives in X-Forwarded-For. Without this every request appears to come
// from the load balancer and the rate limiter below would put all users in one
// bucket. ForwardLimit 1 takes the entry App Service itself appended, so a
// client-supplied X-Forwarded-For cannot spoof the partition key.
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.ForwardLimit = 1;
    o.KnownIPNetworks.Clear();
    o.KnownProxies.Clear();
});

// Rate limiting. The API lives on a public hostname, so CORS does not gate who
// can reach it — curl ignores CORS entirely. These limits are the real control
// on the unauthenticated endpoints, and a backstop for a single small instance.
const string AuthPolicy = "auth";
const string MediaPolicy = "media";

static string ClientKey(HttpContext ctx) =>
    ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (ctx, ct) =>
    {
        if (ctx.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
            ctx.HttpContext.Response.Headers.RetryAfter = ((int)retryAfter.TotalSeconds).ToString();
        await ctx.HttpContext.Response.WriteAsync("Too many requests. Try again shortly.", ct);
    };

    // Backstop so one caller cannot saturate the instance.
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        RateLimitPartition.GetFixedWindowLimiter(ClientKey(ctx), _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 240,
            Window = TimeSpan.FromMinutes(1),
        }));

    // Sign-in and registration are unauthenticated by necessity, so this is what
    // stands between the password check and an automated guessing attack.
    options.AddPolicy(AuthPolicy, ctx =>
        RateLimitPartition.GetFixedWindowLimiter(ClientKey(ctx), _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 10,
            Window = TimeSpan.FromMinutes(5),
        }));

    // Anonymous endpoints that cost real money (cloud TTS bills per character)
    // or real CPU (Whisper transcription). Generous enough for a learner
    // clicking through a lesson, bounded enough to not be a free API.
    options.AddPolicy(MediaPolicy, ctx =>
        RateLimitPartition.GetFixedWindowLimiter(ClientKey(ctx), _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 90,
            Window = TimeSpan.FromMinutes(1),
        }));
});

// JWT auth. Outside Development the signing key must come from configuration:
// falling back to a well-known string would let anyone mint a token for any
// account, and the app would look perfectly healthy while doing it.
const string DevJwtKey = "dev-secret-change-me-in-production-please-32chars";

// appsettings.json ships a "CHANGE-THIS-..." placeholder, so Jwt:Key is never
// null in practice — a null check alone would wave the placeholder through.
static bool IsPlaceholderKey(string key) =>
    key.Contains("CHANGE-THIS", StringComparison.OrdinalIgnoreCase)
    || key.Contains("change-me", StringComparison.OrdinalIgnoreCase);

var configuredKey = builder.Configuration["Jwt:Key"];
var keyIsUsable = !string.IsNullOrWhiteSpace(configuredKey) && !IsPlaceholderKey(configuredKey);

if (!keyIsUsable && !builder.Environment.IsDevelopment())
{
    throw new InvalidOperationException(
        "Jwt:Key is not configured, or is still the development placeholder. Set it to a "
        + "random string of at least 32 characters. On Azure App Service: az webapp config "
        + "appsettings set -g <group> -n <app> --settings Jwt__Key=\"<secret>\".");
}

// keyIsUsable implies configuredKey is non-null; Development falls back instead.
var jwtKey = keyIsUsable ? configuredKey! : DevJwtKey;

if (Encoding.UTF8.GetByteCount(jwtKey) < 32)
{
    throw new InvalidOperationException(
        "Jwt:Key must be at least 32 bytes — HMAC-SHA256 signing keys shorter than the hash "
        + "are rejected at startup rather than silently weakening every token.");
}
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "SwahiliCourse";

// One source of truth for the key: TokenService signs with exactly what the
// handler below validates against. See Services/JwtSettings.cs.
builder.Services.AddSingleton(new JwtSettings(jwtKey, jwtIssuer));
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtIssuer,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

// --- Bring the database up to the current schema ---
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    // A database created by the pre-migrations EnsureCreated() path has the tables
    // but no __EFMigrationsHistory, so Migrate() would try to create them again and
    // fail. Set Database:BaselineExistingSchema=true for one startup to record the
    // initial migration as already applied instead. Safe to leave on — it only acts
    // on an untracked database, and never on a fresh or already-migrated one.
    // See deploy/DEPLOY.md, "Baselining the deployed database".
    if (app.Configuration.GetValue<bool>("Database:BaselineExistingSchema"))
        BaselineUntrackedSchema(db, app.Services.GetRequiredService<ILoggerFactory>());

    // Creates the file and the full schema when there is none, and applies only the
    // pending migrations when there is — so an upgrade keeps accounts and progress.
    db.Database.Migrate();
}

// Must run before anything that reads the client address or scheme.
app.UseForwardedHeaders();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors(CorsPolicy);

// Serve the built React frontend (copied into wwwroot in the Docker image) so the
// whole app runs from a single origin in production — no CORS, no separate host.
// Harmless in local dev where wwwroot is empty (the frontend runs on Vite instead).
app.UseDefaultFiles();
app.UseStaticFiles();

// Deliberately after static files: one page load pulls many assets, and counting
// those against the limit would throttle ordinary browsing. The API routes below
// are what actually needs bounding.
app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Liveness probe for the host platform (Azure health check, etc.).
app.MapGet("/healthz", () => Results.Ok(new { status = "ok" }));

// SPA fallback: any non-API, non-file route returns index.html so client-side
// routing works on refresh/deep-link. No-op in dev (no index.html present).
app.MapFallbackToFile("index.html");

app.Run();

// Adopt a database whose schema predates migrations: write the initial migration
// into __EFMigrationsHistory so Migrate() skips it and later migrations still run.
// Does nothing unless the schema exists and is untracked, which makes repeat
// startups (and fresh databases) no-ops.
static void BaselineUntrackedSchema(AppDbContext db, ILoggerFactory loggerFactory)
{
    var logger = loggerFactory.CreateLogger("Database.Baseline");
    var connection = db.Database.GetDbConnection();
    connection.Open();

    bool TableExists(string name)
    {
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = $name";
        var p = cmd.CreateParameter();
        p.ParameterName = "$name";
        p.Value = name;
        cmd.Parameters.Add(p);
        return Convert.ToInt64(cmd.ExecuteScalar()) > 0;
    }

    if (!TableExists("Users"))
    {
        logger.LogInformation("No existing schema to baseline; migrations will create it.");
        return;
    }
    if (TableExists("__EFMigrationsHistory"))
    {
        logger.LogInformation("Database already tracks migrations; nothing to baseline.");
        return;
    }

    var initialMigration = db.Database.GetMigrations().First();
    var history = db.GetService<IHistoryRepository>();
    var efVersion = typeof(DbContext).Assembly.GetName().Version?.ToString(3) ?? "0.0.0";

    using var transaction = db.Database.BeginTransaction();
    db.Database.ExecuteSqlRaw(history.GetCreateIfNotExistsScript());
    db.Database.ExecuteSqlRaw(history.GetInsertScript(new HistoryRow(initialMigration, efVersion)));
    transaction.Commit();

    logger.LogWarning(
        "Baselined existing schema as migration {Migration}. Remove Database:BaselineExistingSchema once this has run.",
        initialMigration);
}
