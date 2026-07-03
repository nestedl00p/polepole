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
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlite(builder.Configuration.GetConnectionString("Default") ?? "Data Source=swahili.db"));

builder.Services.AddSingleton<LessonCatalog>();
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
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors(CorsPolicy);
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.MapGet("/", () => "Swahili Course API is running. See /swagger for docs.");

app.Run();
