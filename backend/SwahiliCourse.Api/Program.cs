using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
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

// CORS for the React dev server.
const string CorsPolicy = "frontend";
builder.Services.AddCors(o => o.AddPolicy(CorsPolicy, p =>
    p.WithOrigins("http://localhost:5173", "http://localhost:3000")
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

// --- Ensure database is created (simple approach; swap for migrations in production) ---
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();

    // EnsureCreated() builds the schema only for a brand-new file — it never
    // alters an existing one. These idempotent patches add columns introduced
    // after a database was first created, so existing accounts and progress
    // survive an upgrade. (Replace this with EF Core migrations before launch.)
    foreach (var patch in new[]
             {
                 "ALTER TABLE Users ADD COLUMN CourseId TEXT NOT NULL DEFAULT 'sw'",
             })
    {
        try { db.Database.ExecuteSqlRaw(patch); }
        catch (Microsoft.Data.Sqlite.SqliteException) { /* column already present */ }
    }
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
