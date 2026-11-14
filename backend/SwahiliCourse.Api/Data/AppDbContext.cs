using Microsoft.EntityFrameworkCore;
using SwahiliCourse.Api.Models;

namespace SwahiliCourse.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<LessonProgress> LessonProgress => Set<LessonProgress>();
    public DbSet<CardState> CardStates => Set<CardState>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<LessonProgress>()
            .HasIndex(p => new { p.UserId, p.LessonId })
            .IsUnique();

        modelBuilder.Entity<LessonProgress>()
            .HasOne(p => p.User)
            .WithMany(u => u.Progress)
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // One row per item per learner, so a word met again in a later lesson
        // keeps the history it already has rather than starting over.
        modelBuilder.Entity<CardState>()
            .HasIndex(c => new { c.UserId, c.CourseId, c.ItemKey })
            .IsUnique();

        // The hot query — "what has come due for this learner?" — runs on every
        // Dose build.
        modelBuilder.Entity<CardState>()
            .HasIndex(c => new { c.UserId, c.DueAt });

        modelBuilder.Entity<CardState>()
            .HasOne(c => c.User)
            .WithMany(u => u.Cards)
            .HasForeignKey(c => c.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
