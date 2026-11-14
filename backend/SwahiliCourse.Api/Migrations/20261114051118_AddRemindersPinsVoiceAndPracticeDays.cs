using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SwahiliCourse.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRemindersPinsVoiceAndPracticeDays : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "HabitAnswer",
                table: "Users",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "HabitAskedAt",
                table: "Users",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastNotifiedAt",
                table: "Users",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastShareOfferAt",
                table: "Users",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PushToken",
                table: "Users",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReminderChosenAt",
                table: "Users",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "ReminderLocalTime",
                table: "Users",
                type: "TEXT",
                nullable: false,
                // Existing accounts get the same 08:00 a new one starts with,
                // not midnight — nobody chose to be reminded at 00:00.
                defaultValue: new TimeOnly(8, 0, 0));

            migrationBuilder.AddColumn<DateTime>(
                name: "ReminderOffOfferedAt",
                table: "Users",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RemindersEnabled",
                table: "Users",
                type: "INTEGER",
                nullable: false,
                // On, matching new accounts. It sends nothing by itself: a
                // reminder still needs a registered phone or a browser the
                // learner has granted notification permission in.
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "Why",
                table: "Users",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PinnedAt",
                table: "CardStates",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PracticeDays",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    UserId = table.Column<int>(type: "INTEGER", nullable: false),
                    Day = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    DoseOpenedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    OpenedUnprompted = table.Column<bool>(type: "INTEGER", nullable: false),
                    DoseCompletedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    ItemsAnswered = table.Column<int>(type: "INTEGER", nullable: false),
                    DurationSeconds = table.Column<int>(type: "INTEGER", nullable: true),
                    QuizPassedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PracticeDays", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PracticeDays_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "VoiceTakes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    UserId = table.Column<int>(type: "INTEGER", nullable: false),
                    CourseId = table.Column<string>(type: "TEXT", nullable: false),
                    ItemKey = table.Column<string>(type: "TEXT", nullable: false),
                    Text = table.Column<string>(type: "TEXT", nullable: false),
                    Score = table.Column<int>(type: "INTEGER", nullable: false),
                    ContentType = table.Column<string>(type: "TEXT", nullable: false),
                    FileName = table.Column<string>(type: "TEXT", nullable: false),
                    SizeBytes = table.Column<long>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VoiceTakes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VoiceTakes_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PracticeDays_UserId_Day",
                table: "PracticeDays",
                columns: new[] { "UserId", "Day" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VoiceTakes_UserId_ItemKey_CreatedAt",
                table: "VoiceTakes",
                columns: new[] { "UserId", "ItemKey", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PracticeDays");

            migrationBuilder.DropTable(
                name: "VoiceTakes");

            migrationBuilder.DropColumn(
                name: "HabitAnswer",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "HabitAskedAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastNotifiedAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastShareOfferAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PushToken",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ReminderChosenAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ReminderLocalTime",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ReminderOffOfferedAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "RemindersEnabled",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Why",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PinnedAt",
                table: "CardStates");
        }
    }
}
