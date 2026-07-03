# Jifunze Kiswahili — Interactive Swahili Course

A full-stack web app that turns the 30-day Swahili course into an interactive
learning platform with **user accounts**, **adjustable pacing**, **quizzes**,
**flashcards**, and **gamification (XP + streaks)**.

- **Backend:** ASP.NET Core 8 Web API (C#), Entity Framework Core + SQLite, JWT auth
- **Frontend:** React 18 + Vite + React Router
- **Content:** All 30 lessons live in one editable file — `backend/SwahiliCourse.Api/Data/lessons.json`

---

## What learners can do

- **Create an account** and pick a pace at sign-up (30 / 45 / 60 / 90 days).
- **Extend the pace anytime** in Settings — up to 365 days (the 30-day plan can always be stretched longer).
- **Work through 30 lessons** with rich content: tables, dialogues, callouts, vocab.
- **Take a quiz** after every lesson — multiple-choice, translation, and fill-in-the-blank.
  Passing (70%+) earns XP and **unlocks the next lesson**.
- **Review with flashcards** (3D flip cards) auto-built from every word they've learned.
- **Run a mixed practice quiz** drawn from all unlocked vocabulary.
- **Track progress**: day streak 🔥, total XP ⭐, and percent complete.

---

## Prerequisites

- **.NET 8 SDK** — https://dotnet.microsoft.com/download
- **Node.js 18+** and npm — https://nodejs.org

Check they're installed:
```bash
dotnet --version    # should print 8.x
node --version      # should print v18+ or v20+
```

---

## Running the app (two terminals)

### 1) Backend — the API

```bash
cd backend/SwahiliCourse.Api
dotnet restore
dotnet run
```

The API starts at **http://localhost:5167**.
Open **http://localhost:5167/swagger** to explore every endpoint.
A SQLite database file `swahili.db` is created automatically on first run.

### 2) Frontend — the React app

```bash
cd frontend
npm install
npm run dev
```

The app opens at **http://localhost:5173** and proxies all `/api` calls to the
backend automatically (see `frontend/vite.config.js`).

> Start the backend first, then the frontend. Register a new account and begin learning!

---

## Editing course content (no C# required)

All lessons are stored in **`backend/SwahiliCourse.Api/Data/lessons.json`**.
Each lesson looks like this:

```jsonc
{
  "id": 1,                 // the "day" number (1–30)
  "week": 1,
  "title": "Sounds & the Alphabet",
  "subtitle": "Master the five vowels",
  "theme": "Pronunciation",
  "blocks": [              // the lesson body, rendered in order
    { "type": "heading",   "heading": "The Five Vowels" },
    { "type": "paragraph", "text": "Swahili has five pure vowels…" },
    { "type": "callout",   "calloutTitle": "Stress Rule", "lines": ["…"] },
    { "type": "table",     "tableHeaders": ["Letter","Sound"], "tableRows": [["a","father"]] },
    { "type": "dialogue",  "dialogue": [{ "speaker": "Amina", "swahili": "Hujambo!", "english": "Hello!" }] },
    { "type": "list",      "lines": ["First point", "Second point"] }
  ],
  "vocabulary": [ { "swahili": "jambo", "english": "hello" } ],
  "quiz": [
    { "id": 1, "type": "multiple_choice", "prompt": "Which vowel…?",
      "options": ["a","e","i","u"], "answer": "i", "hint": "like 'ee'" },
    { "id": 2, "type": "translate", "prompt": "Translate: maji", "answer": "water" },
    { "id": 3, "type": "fill_blank", "prompt": "Yeye ___ mwalimu", "answer": "ni" }
  ],
  "xpReward": 100
}
```

**Block types:** `heading`, `paragraph`, `callout`, `table`, `dialogue`, `list`.
**Quiz types:** `multiple_choice` (needs `options`), `translate`, `fill_blank`.

Edit the file, save, and restart the backend (`dotnet run`) to see your changes.
Quiz answers are stripped before content is sent to the browser, so learners can't peek.

> **Note:** Quiz question `id`s are unique across the whole file. If you add a new
> question, give it an id higher than any existing one (the current max is around 152).

---

## How pacing works

- The 30 lessons are spread evenly across the learner's chosen `planLengthDays`.
  Example: 30 lessons over 60 days ≈ one new lesson every 2 days.
- Lessons unlock **sequentially**: you must pass a lesson's quiz (70%+) before the next opens.
- Motivated learners can study **ahead** of schedule once they pass each quiz
  (controlled by `PaceService.AllowAhead`, default `true`). Set it to `false`
  in `Services/PaceService.cs` if you want to hold learners strictly to the calendar.

---

## Project structure

```
SwahiliCourse/
├── backend/SwahiliCourse.Api/
│   ├── Controllers/      # Auth, User, Lessons, Quiz, Review endpoints
│   ├── Models/           # User, Lesson, LessonProgress
│   ├── Data/             # AppDbContext + lessons.json (your content!)
│   ├── Services/         # LessonCatalog, TokenService, PaceService
│   ├── DTOs/             # request/response shapes
│   ├── Program.cs        # startup, DI, auth, CORS
│   └── appsettings.json  # JWT key + DB connection string
└── frontend/
    └── src/
        ├── pages/        # AuthPage, Dashboard, LessonPage, QuizPage, Flashcards, Settings
        ├── components/   # ContentBlock renderer
        ├── context/      # AuthContext (JWT + user state)
        ├── api/client.js # fetch wrapper
        └── styles.css    # all styling
```

---

## API reference (quick)

| Method | Route                  | Auth | Purpose                              |
|--------|------------------------|------|--------------------------------------|
| POST   | `/api/auth/register`   | —    | Create account (+ choose pace)       |
| POST   | `/api/auth/login`      | —    | Log in, returns JWT                  |
| GET    | `/api/user/me`         | ✓    | Current user profile                 |
| PUT    | `/api/user/pace`       | ✓    | Change plan length (30–365 days)     |
| POST   | `/api/user/restart`    | ✓    | Reset progress                       |
| GET    | `/api/lessons`         | ✓    | All lessons + lock/progress state    |
| GET    | `/api/lessons/{id}`    | ✓    | One lesson (answers stripped)        |
| POST   | `/api/quiz/submit`     | ✓    | Grade a quiz, award XP               |
| GET    | `/api/review/flashcards` | ✓  | Flashcard deck from learned words    |
| GET    | `/api/review/practice` | ✓    | Random practice quiz                 |

---

## Before you deploy to production

1. **Change the JWT secret** in `appsettings.json` (`Jwt:Key`) to a long random string,
   ideally loaded from an environment variable or secrets manager.
2. **Switch from `EnsureCreated()` to EF Core migrations** for safe schema changes:
   ```bash
   dotnet tool install --global dotnet-ef
   dotnet ef migrations add InitialCreate
   dotnet ef database update
   ```
   Then replace `db.Database.EnsureCreated();` in `Program.cs` with `db.Database.Migrate();`.
3. **Lock down CORS** in `Program.cs` to your real frontend domain.
4. Consider a managed database (PostgreSQL/SQL Server) instead of SQLite for multi-user scale —
   just swap the provider in `Program.cs` and the connection string.

---

Pole pole ndiyo mwendo — slowly but surely. Happy teaching! 🇹🇿🇰🇪
