# PolePole — Swahili Course (React Native / Expo)

The mobile version of the Swahili course, built with **Expo** + **React Native**.
It talks to the same .NET backend as the web app — no backend changes needed.

> **PolePole** comes from the Swahili proverb *pole pole ndiyo mwendo* —
> "slowly but surely." Learn at your own pace. 🐢

---

## Prerequisites

- **Node.js 18+**
- **Expo Go** app on your phone (App Store / Play Store), **or** an iOS Simulator
  (Mac) / Android Emulator.
- The **backend running** (`cd ../backend/SwahiliCourse.Api && dotnet run`).

## Run it

```bash
cd mobile
npm install
npm start          # opens Expo Dev Tools; press i (iOS), a (Android), or scan the QR
```

If native package versions ever mismatch your Expo SDK, run `npx expo install --fix`.

---

## Pointing the app at your backend

A phone or emulator can't reach the backend via `localhost` the way a browser
can. The host is configured in **`src/config.js`**:

| Running on… | Host it uses |
|-------------|--------------|
| iOS Simulator | `http://localhost:5167` |
| Android Emulator | `http://10.0.2.2:5167` |
| **Physical phone (Expo Go)** | **your computer's LAN IP** — you must set this |

For a physical device, find your computer's IP (`ipconfig` on Windows →
"IPv4 Address", e.g. `192.168.1.42`) and set in `src/config.js`:

```js
const API_HOST_OVERRIDE = 'http://192.168.1.42:5167';
```

Your phone and computer must be on the same Wi-Fi network. If the backend's
CORS blocks the request, the API already allows any header/method for the dev
origins — for device testing you generally won't hit CORS because Expo Go makes
native requests, not browser ones.

---

## What's inside

```
mobile/
├── App.js                     # navigation + auth gating + header XP/streak pills
├── app.json                   # Expo config (app name: PolePole)
└── src/
    ├── config.js              # backend host (edit for physical devices)
    ├── theme.js               # colors/shadows ported from the web CSS
    ├── api/client.js          # fetch wrapper (JWT via AsyncStorage)
    ├── context/AuthContext.js # user + token state
    ├── components/
    │   ├── ui.js              # Button, Card, Input, Spinner, ProgressBar, Pill…
    │   └── ContentBlock.js    # renders lesson blocks (table/dialogue/callout/…)
    └── screens/
        ├── AuthScreen.js       # register / login + pace picker
        ├── DashboardScreen.js  # stats, progress, lesson grid by week
        ├── LessonScreen.js     # lesson content + vocab + "take quiz"
        ├── QuizScreen.js       # questions, hints, grading, review
        ├── FlashcardsScreen.js # animated 3D flip cards + practice quiz
        └── SettingsScreen.js   # pace, restart, logout
```

Navigation: a bottom tab bar (Dashboard / Flashcards / Settings) with Lesson and
Quiz pushed on top as stack screens. Auth state decides whether you see the login
screen or the app.

---

## Feature parity with the web app

Everything the web frontend does is here: accounts, pacing, sequential lesson
unlocking, quizzes (70% to pass), XP + streaks, auto-built flashcards with a 3D
flip, and the mixed practice quiz.
