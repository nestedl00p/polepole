using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SwahiliCourse.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCardState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CardStates",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    UserId = table.Column<int>(type: "INTEGER", nullable: false),
                    CourseId = table.Column<string>(type: "TEXT", nullable: false),
                    ItemKey = table.Column<string>(type: "TEXT", nullable: false),
                    ItemKind = table.Column<string>(type: "TEXT", nullable: false),
                    SourceLessonId = table.Column<int>(type: "INTEGER", nullable: false),
                    Box = table.Column<int>(type: "INTEGER", nullable: false),
                    DueAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Lapses = table.Column<int>(type: "INTEGER", nullable: false),
                    Strength = table.Column<int>(type: "INTEGER", nullable: false),
                    Pinned = table.Column<bool>(type: "INTEGER", nullable: false),
                    LastSeenAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    BestSpeechScore = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CardStates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CardStates_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CardStates_UserId_CourseId_ItemKey",
                table: "CardStates",
                columns: new[] { "UserId", "CourseId", "ItemKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CardStates_UserId_DueAt",
                table: "CardStates",
                columns: new[] { "UserId", "DueAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CardStates");
        }
    }
}
