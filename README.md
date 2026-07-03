# PolePole — Interactive Swahili Course

*(formerly "Jifunze Kiswahili")*

A full-stack platform that turns a structured Swahili course into an interactive
learning app: **user accounts**, **adjustable pacing**, **quizzes**, **flashcards**,
**gamification (XP + streaks)**, **native-quality audio**, and a **speak-and-check
pronunciation trainer**.

| Part | Stack | Runs at |
|------|-------|---------|
| `backend/` | ASP.NET Core (.NET 10) Web API · EF Core + SQLite · JWT auth | http://localhost:5167 |
| `frontend/` | React 18 + Vite + React Router | http://localhost:5173 |
| `mobile/` | Expo SDK 54 / React Native (same backend) | Expo Go |
| `whisper-service/` | Python FastAPI + faster-whisper (speech-to-text) | http://127.0.0.1:8081 |

Course content (all **31 lessons**, vocab, quizzes) lives in one editable file:
`backend/SwahiliCourse.Api/Data/lessons.json`.

---

## What learners can do

- **Create an account** and pick a pace (30 / 45 / 60 / 90 days, extendable to 365).
- **Work through 31 lessons** with rich, interactive content — tables, dialogues,
  callouts, and hands-on grammar builders (verb conjugation, noun-class sorters,
  adjective/possessive agreement, question forms, drag-and-drop sentence building).
- **Hear every word** in native-quality Swahili (🔊 buttons) via cloud TTS, with a
  built-in browser/device voice as automatic fallback.
- **Practice pronunciation** — the *speak-and-check* drill records you, transcribes
  your speech with a self-hosted Whisper model, and scores your word match.
- **Take a quiz** after each lesson (multiple-choice, translation, fill-in-the-blank).
  Passing (70%+) earns XP and unlocks the next lesson.
- **Review with 3D flashcards** and mixed practice quizzes from learned vocabulary.
- **Track progress**: day streak 🔥, total XP ⭐, percent complete.

---

## Prerequisites

- **.NET 10 SDK** — https://dotnet.microsoft.com/download
- **Node.js 18+** and npm — https://nodejs.org
- *(optional, for pronunciation)* **Python 3.10–3.13** — https://python.org
- *(optional, for the mobile app)* **Expo** — `npm install -g expo-cli`, plus the
  Expo Go app on your phone

```bash
dotnet --version    # 10.x
node --version      # v18+ / v20+
py --version        # 3.10–3.13   (Windows; use python3 on macOS/Linux)
```

---

## Quickstart (backend + web, two terminals)

### 1) Backend — the API
```bash
cd backend/SwahiliCourse.Api
dotnet restore
dotnet run
```
Starts at **http://localhost:5167** · Swagger UI at **/swagger**.
A SQLite file `swahili.db` is created automatically on first run.

### 2) Frontend — the React app
```bash
cd frontend
npm install
npm run dev
```
Opens at **http://localhost:5173** and proxies `/api` → the backend
(see `frontend/vite.config.js`).

> Start the backend first, then the frontend. Register an account and begin.
> With no extra config the app runs fully — audio uses the built-in browser voice
> and the pronunciation drill shows in "listen-only" mode.

---

## Optional: native-quality audio (cloud TTS)

The 🔊 buttons call `GET /api/tts`. Without a provider key they return `204` and the
client falls back to the built-in voice. To enable native Swahili audio, configure a
provider via **user-secrets** (recommended for local dev — keeps keys out of git):

```bash
cd backend/SwahiliCourse.Api
dotnet user-secrets set "Tts:Provider" "Azure"
dotnet user-secrets set "Tts:Azure:Key" "<your-azure-speech-key>"
dotnet user-secrets set "Tts:Azure:Region" "eastus"
```
Providers: `Azure`, `Google`, `Knowlez`, or `Mock` (a local test tone, no key).
See `.env.example` for every key. Restart the backend; `GET /api/tts/status`
should report `{"enabled":true}`. Generated clips are cached on disk under
`App_Data/tts-cache/` (git-ignored).

---

## Optional: speak-and-check pronunciation (self-hosted Whisper)

A local Whisper model transcribes the learner's speech — no cloud key, no per-minute
billing. Details in [`whisper-service/README.md`](whisper-service/README.md).

```bash
# 1) Start the STT sidecar
cd whisper-service
py -m venv .venv
.venv\Scripts\activate            # Windows  (source .venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8081     # first run downloads the model

# 2) Point the backend at it (new terminal)
cd backend/SwahiliCourse.Api
dotnet user-secrets set "Speech:Enabled" "true"
dotnet user-secrets set "Speech:WhisperUrl" "http://127.0.0.1:8081"
```
Restart the backend; `GET /api/speech/status` → `{"enabled":true}`, and the mic
appears on Lesson 1's **"Say It Out Loud"** drill.

> **Model size matters for Swahili.** `small` (~470 MB) is the practical minimum;
> `base`/`tiny` mis-hear words. Set `WHISPER_MODEL=medium` for higher accuracy.
> The scorer tolerates 1-character differences so it forgives Whisper's own
> spelling variance (e.g. *asante* → "asanti") without passing wrong words.

---

## Optional: the mobile app (Expo)

```bash
cd mobile
npm install
npx expo start        # scan the QR code with Expo Go
```
The mobile app talks to the **same backend**. Set the host it reaches in
`mobile/src/config.js`:
- iOS simulator → `http://localhost:5167`
- Android emulator → `http://10.0.2.2:5167`
- **Physical phone** → set `API_HOST_OVERRIDE` to your computer's LAN IP
  (e.g. `http://192.168.1.42:5167`); phone and computer must share Wi-Fi.

---

## Editing course content (no C# required)

All lessons live in **`backend/SwahiliCourse.Api/Data/lessons.json`**:

```jsonc
{
  "id": 1, "week": 1,
  "title": "Sounds & the Alphabet",
  "subtitle": "Master the five vowels",
  "theme": "Pronunciation",
  "blocks": [
    { "type": "heading",   "heading": "The Five Vowels" },
    { "type": "paragraph", "text": "Swahili has five pure vowels…" },
    { "type": "callout",   "calloutTitle": "Stress Rule", "lines": ["…"] },
    { "type": "table",     "tableHeaders": ["Letter","Sound"], "tableRows": [["a","father"]] },
    { "type": "dialogue",  "dialogue": [{ "speaker": "Amina", "swahili": "Hujambo!", "english": "Hello!" }] },
    { "type": "list",      "lines": ["First point", "Second point"] },
    { "type": "pronunciationDrill", "calloutTitle": "Say It Out Loud",
      "prompts": [ { "swahili": "jambo", "english": "hello" } ] }
  ],
  "vocabulary": [ { "swahili": "jambo", "english": "hello" } ],
  "quiz": [
    { "id": 1, "type": "multiple_choice", "prompt": "Which vowel…?",
      "options": ["a","e","i","u"], "answer": "i", "hint": "like 'ee'" }
  ],
  "xpReward": 100
}
```

**Static block types:** `heading`, `paragraph`, `callout`, `table`, `dialogue`, `list`.
**Interactive block types:** `verbBuilder`, `possessiveBuilder`, `adjectiveBuilder`,
`questionBuilder`, `nounSorter`, `sentenceBuilder`, `pronunciationDrill`.
**Quiz types:** `multiple_choice` (needs `options`), `translate`, `fill_blank`.

Edit, save, and restart the backend to publish. Quiz answers are stripped before
content reaches the browser.

> ⚠️ Two gotchas when adding content:
> 1. Quiz question `id`s are unique across the whole file — new ones must exceed the
>    current max (~152).
> 2. A **new block field** must be declared as a typed property on
>    `Models/Lesson.cs` `ContentBlock`, or it's silently dropped during
>    serialization. A **new block type** must be added to *both*
>    `frontend/src/components/ContentBlock.jsx` and `mobile/src/components/ContentBlock.js`.

---

## Configuration & secrets

All configuration keys are documented in **[`.env.example`](.env.example)**.
The .NET backend reads config from (in order) `appsettings.json` →
environment variables (`__` = nested, e.g. `Tts__Azure__Key`) → **user-secrets**
in Development. **Never commit real keys** — `appsettings.json` ships with empty
placeholders; use user-secrets locally and environment variables in production.

---

## API reference (quick)

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/auth/register` | — | Create account (+ choose pace) |
| POST | `/api/auth/login` | — | Log in, returns JWT |
| GET | `/api/user/me` | ✓ | Current user profile |
| PUT | `/api/user/pace` | ✓ | Change plan length (30–365 days) |
| POST | `/api/user/restart` | ✓ | Reset progress |
| GET | `/api/lessons` | ✓ | All lessons + lock/progress state |
| GET | `/api/lessons/{id}` | ✓ | One lesson (answers stripped) |
| POST | `/api/quiz/submit` | ✓ | Grade a quiz, award XP |
| GET | `/api/review/flashcards` | ✓ | Flashcard deck from learned words |
| GET | `/api/review/practice` | ✓ | Random practice quiz |
| GET | `/api/tts?text=` | — | Synthesized Swahili audio (204 if unconfigured) |
| GET | `/api/tts/status` | — | Whether cloud TTS is enabled |
| POST | `/api/speech/assess` | — | Score recorded speech vs. a target phrase |
| GET | `/api/speech/status` | — | Whether the Whisper sidecar is enabled |

---

## Project structure

```
SwahiliCourse/
├── backend/SwahiliCourse.Api/
│   ├── Controllers/   # Auth, User, Lessons, Quiz, Review, Tts, Speech
│   ├── Models/        # User, Lesson (+ ContentBlock), LessonProgress
│   ├── Data/          # AppDbContext + lessons.json (your content!)
│   ├── Services/      # LessonCatalog, TokenService, PaceService,
│   │                  #   TtsService, TtsWarmupService, SpeechService
│   └── Program.cs     # startup, DI, auth, CORS
├── frontend/src/
│   ├── pages/         # Landing, Auth, Dashboard, Lesson, Quiz, Flashcards, Settings
│   ├── components/    # ContentBlock + interactive builders, SpeakButton, PronunciationDrill
│   ├── hooks/         # useMicRecorder
│   ├── lib/           # speak.js (TTS), speechAssess.js (pronunciation)
│   └── api/client.js
├── mobile/            # Expo / React Native port (mirrors frontend components)
└── whisper-service/   # Python STT sidecar (app.py, requirements.txt)
```

---

## Before you deploy to production

1. **Change the JWT secret** (`Jwt:Key`) to a long random value from an env var / secrets manager.
2. **Switch to EF Core migrations** instead of `EnsureCreated()`:
   ```bash
   dotnet tool install --global dotnet-ef
   dotnet ef migrations add InitialCreate
   dotnet ef database update
   ```
   Then use `db.Database.Migrate();` in `Program.cs`.
3. **Lock down CORS** in `Program.cs` to your real frontend domain.
4. Consider **PostgreSQL/SQL Server** over SQLite for multi-user scale.
5. Bind the Whisper sidecar to `127.0.0.1` only — it has no auth (internal service).

---

Pole pole ndiyo mwendo — slowly but surely. Happy teaching! 🇹🇿🇰🇪
