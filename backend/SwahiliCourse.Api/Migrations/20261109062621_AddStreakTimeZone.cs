using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SwahiliCourse.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStreakTimeZone : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LastDoseAt",
                table: "Users",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastRestDayAt",
                table: "Users",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TimeZoneId",
                table: "Users",
                type: "TEXT",
                nullable: false,
                defaultValue: "UTC");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastDoseAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastRestDayAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "TimeZoneId",
                table: "Users");
        }
    }
}
