using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
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

// JWT auth.
var jwtKey = builder.Configuration["Jwt:Key"] ?? "dev-secret-change-me-in-production-please-32chars";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "SwahiliCourse";
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
