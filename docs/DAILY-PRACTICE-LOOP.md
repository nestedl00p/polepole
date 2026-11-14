# The Daily Practice Loop — "Dose ya Leo"

A design for the habit layer of PolePole, worked through the Hook Model
(Trigger → Action → Variable Reward → Investment).

This is a design document, not an implementation. It ends with the schema,
endpoints and build order needed to ship it.

---

## The central move: the lesson is not the habit

PolePole today is built around the lesson. There are 31 of them, each 15–30
minutes, gated by `PaceService` on a calendar schedule. That is a *course*, and
a course has two properties that make it a poor habit substrate:

1. **It ends.** On day 31 the loop has nowhere left to run.
2. **The unit is too big.** A 20-minute commitment can't be performed on a bad
   day, and a habit that only survives good days isn't a habit.

Put against the Habit Zone, the lesson sits in the high-value / low-frequency
box: a viable product that needs marketing to pull people back. Review sits in
the high-value / **high**-frequency box. So the habit belongs on the review
layer, and the lesson becomes something the habit pulls you toward rather than
the thing you're asked to do daily.

The habit unit is a **Dose ya Leo** — today's dose. Five items, about ninety
seconds, one of which you say out loud.

|                        | Low frequency        | High frequency         |
|------------------------|----------------------|------------------------|
| **High perceived value** | Lessons (31, finite) | **Dose ya Leo** ← habit zone |
| **Low perceived value**  | —                    | —                      |

---

## Diagnostic: where the current build scores

Scored on the four Hook diagnostic rows, 2 points each.

| Row | Current build | Score |
|---|---|---|
| **Internal trigger identified?** | None. No notifications exist anywhere (web or Expo). Returning is entirely on the learner's memory. | 0 |
| **Is the action dead simple?** | No sub-minute entry point. `Dashboard.jsx` presents 31 clickable lesson cards plus two review modes — the primary action is a 20-minute lesson, and Hick's Law is working against it. Flashcards are closer, but `/review/flashcards` returns the *entire* deck with no stopping point. | 1 |
| **Is the reward variable?** | No. XP is `XpReward × accuracy`, deterministic and awarded only on a lesson's first pass. `/review/practice` is a uniform random draw with no per-item state, so it can't surprise you with anything meaningful. | 0 |
| **Does investment load the next trigger?** | No. Nothing a learner does changes what they're shown next. There is no per-card memory in the schema at all — `LessonProgress` tracks lessons, never items. Streak and XP accumulate, which raises switching cost, but load no trigger. | 1 |

**Current score: 3/10.** The loop is open — it runs forward from lesson to
lesson, but never bends back around.

Two specific defects are worth naming because they'll bite whatever gets built
on top:

- **`UpdateStreak` fires only on a lesson quiz's first pass**
  (`QuizController.cs:116`). Flashcards and pronunciation drills earn no streak
  credit, and once all 31 lessons are passed the streak can never advance
  again. The gamification actively stops working at the moment a learner
  becomes a long-term user.
- **The streak is computed in UTC** (`DateTime.UtcNow.Date`). A learner
  practising at 21:00 in Dar es Salaam (UTC+3) is already on tomorrow's UTC
  date; one practising at 20:00 in Mexico City is still on yesterday's. Streaks
  break for reasons invisible to the learner, which is the single fastest way
  to make a streak feel unfair.

---

## 1. Trigger

### Internal trigger

The emotion to map onto is **decay anxiety** — the specific, nagging awareness
that what you learned is slipping, and that you still couldn't say it if the
moment came. Adult Swahili learners almost always have a concrete *why* behind
the course: a trip, a posting, in-laws, colleagues, a congregation. The
internal trigger is not "I want to study", it's **"will I actually be able to
speak when it matters?"**

That emotion has two properties worth exploiting honestly: it fires daily
without prompting once a learner has something to lose, and the Dose resolves
it in ninety seconds. Resolution has to be *fast* for the association to form —
a trigger that takes twenty minutes to discharge gets avoided on the days it
matters most.

The secondary internal trigger is milder and more frequent: **dead time**. The
queue, the lift, the kettle. This is why the five-item cap matters more than any
other number in this document.

### External triggers (the bridge, first ~30 days)

One push per day, at a time the learner picks themselves, deep-linking straight
into the Dose — not to the dashboard.

Copy names the *content*, never the streak:

> **Habari za asubuhi** — 5 cards, 90 seconds. *mvua, kesho, ninahitaji…*

> **Dose ya leo** is ready — including one word you got wrong on Tuesday.

> You can nearly say **"nitafika saa tatu"**. One drill to lock it in.

Deliberately **not**:

> ~~Don't lose your 12-day streak!~~

Streak-threat copy converts in the short term and manufactures regret, which is
the condition the ethics section below rules out. The streak is a record of
something true; it isn't leverage.

Channels: Expo push on mobile (`expo-notifications`, currently unused), the Web
Notifications API on web with a once-weekly email digest as the fallback for
learners who decline the permission prompt.

### Migrating external → internal

This is measurable, and it's the same instrument as the habit test. Record,
per learner, whether the Dose was opened **before** the day's notification
fired. After 14 consecutive unprompted days, the app offers — once, quietly —
to turn the reminder off:

> You've started on your own 14 days running. Want me to stop reminding you?

A product that asks to stop notifying you is a product confident it has built
a habit rather than rented one. If a cohort still needs the push after 30 days,
no internal trigger has formed, and the fix is in the reward column, not more
notifications.

---

## 2. Action

**The action: tap once, answer five items, done in about ninety seconds.**

Worked against the six elements of simplicity:

| Element | Design decision |
|---|---|
| **Time** | Hard cap of five items. The Dose *ends by itself*. No "keep going?" interstitial. |
| **Brain cycles** | Zero decisions before starting: no deck picker, no mode toggle, no difficulty setting. The scheduler already decided. Compare today's dashboard, which asks the learner to choose among 31 lesson cards and two review modes before anything happens. |
| **Physical effort** | Four tappable options for recognition items; press-and-hold on the existing `useMicRecorder` for the spoken one. No typing in the Dose — free-text production belongs in lessons and quizzes. |
| **Social deviance** | None; it's private and silent except for the one spoken item, which is skippable with a single tap when the learner is somewhere they can't talk. |
| **Non-routine** | Same place, every day: the Dose is the only primary button on the dashboard, pinned above the fold. The lesson grid moves below it. |
| **Money** | n/a. |

### Dashboard restructure

```
┌─────────────────────────────────────────┐
│  Dose ya leo                            │
│  5 items · ~90 seconds        [ Anza ]  │   ← the only primary button
│  ●●●●●○●  last 7 days                   │
└─────────────────────────────────────────┘

  Somo la leo — Day 12: Sokoni            ← the lesson, demoted to secondary
  ───────────────────────────────────────
  Weeks 1–4 lesson grid (collapsed by default)
```

The lesson is still there, still valuable, still the thing that generates new
material. It is simply no longer what the learner is asked to decide about at
the moment of highest friction.

### Item types in the Dose

Mixed each day so the shape of the session isn't predictable:

- **Tambua** (recognise) — target word → four source-language options. Cheapest item; carries the deck.
- **Tunga** (produce) — source → target, assembled from word chips, reusing the `SentenceBuilder` interaction.
- **Sema** (speak) — one item per Dose, scored by the existing Whisper sidecar through `SpeechController`. This is the highest-value item type in the product and it's currently buried inside lesson content blocks.

---

## 3. Variable Reward

All three reward types are present, and each has genuine uncertainty in it —
the anticipation is doing the work, so the learner must not be able to predict
what the Dose will hand them.

### Hunt — the unpredictable payload

The five items are drawn by the scheduler from what's actually due, so the
content differs every day and the learner can't know the mix in advance. On top
of that, a roughly 1-in-4 chance of a sixth **bonus item**: a *methali*
(proverb) or an idiom that appears in no lesson.

> **Haraka haraka haina baraka** — hurry hurry has no blessing.
> (And now you know why the app is called PolePole.)

This is the piece that makes the Dose worth opening on a day when the learner
doesn't feel like studying, because a proverb is something you can *use* — it's
repeatable to another person, which is also what feeds the tribe reward below.
Variability here is effectively infinite: the pool grows over time and the
combination of due items never repeats.

### Self — mastery, revealed after the fact

- Per-item **strength** is shown only *after* answering, and moves by a variable amount driven by response accuracy and speed. The learner knows the bar will move; not how far.
- The spoken item returns a real word-match score from Whisper. This is inherently, honestly variable — you genuinely do not know whether you'll hit 100% on *ninahitaji* until you say it. No synthetic randomness needed.
- **Milestone reveals** fire on crossing thresholds the learner wasn't counting toward: *"you can now recognise 100 words"*, *"every Week 1 word is at full strength"*.

### Tribe — thin, and deliberately so

There is no social graph: one account, one course direction, no friends, no
cohort. Leaderboards against strangers would be a fabricated tribe reward and
would pull the product toward the Entertainer box. So instead, **once a week**,
opt-in:

> You can say this now. Send it to someone?
> *[your recorded voice: "Nitafika saa tatu asubuhi"]*

Variable because whether they reply, and what they say, is unknowable — and
genuinely useful for the learner whose *why* is a person. Weekly and opt-in
rather than daily and default: a daily social prompt is the step that turns a
Facilitator into a Dealer.

### Guard rails on the reward

- **The Dose ends.** No infinite scroll, no auto-advancing next session.
- An "endelea" (continue) button exists for the days someone wants more, but it is **unincentivised** — no extra streak credit, no XP multiplier. Showing up is what's rewarded, and the reward for five items equals the reward for fifty. This is the difference between a product that respects a learner's time and one that farms it.
- **One rest day per seven** (*siku ya mapumziko*) absorbs a single miss without wiping the streak. The stake stays real — miss twice and it breaks — but a 40-day streak doesn't die because of one flight. Removing the regret trap is not the same as removing the stake.

---

## 4. Investment

Every investment below is asked for *after* a reward, and each one makes
tomorrow's Dose better than today's.

### The answers themselves (the load-bearing one)

Answering an item writes per-card scheduling state — ease, interval, due date,
lapses. **Tomorrow's Dose is literally constructed from today's answers.** That
is the tightest possible form of "investment loads the next trigger", and it is
the single thing most missing from the current schema: PolePole tracks lessons,
never items, so today's effort cannot shape tomorrow's session.

This also fixes the day-31 cliff. A spaced-repetition queue never empties.

### "Nitakumbuka hii" — pin a card

One tap on any card or proverb to pin it to a personal deck. Pinned items get
priority in future Doses. Small, meaningful, compounding, and it makes the deck
*the learner's* rather than the course's.

### Your own voice, kept

Saving a pronunciation attempt builds a personal audio history. Three weeks
later the app can play your first *ninahitaji* against today's. This is a stored
asset that exists nowhere else and gets more valuable the longer you stay —
real switching cost, created by genuine value rather than by lock-in.

### Reminder time and your *why* — asked after the first Dose

The current registration flow asks for course direction and plan length
*before* delivering any value. Flip it:

```
Landing → 3-item taster Dose (pre-seeded, no account)
        → reward (score + a methali)
        → "Keep your progress?" → account
        → "When should I remind you?" → reminder time + timezone
        → "What's your why?" → trip / family / work / curiosity
```

The *why* is not decoration: it selects which lesson themes get weighted in the
Dose, and it's the phrase the re-engagement copy uses after a lapse ("you
started this for the trip in March").

---

## Final score

| Row | Design | Score |
|---|---|---|
| Internal trigger identified | Decay anxiety + dead time, with a measured external→internal migration and an app that offers to stop notifying | 2 |
| Action dead simple | 5 items, ~90s, zero pre-decisions, one tap, self-terminating | 2 |
| Reward variable | Hunt (due-mix + 1-in-4 methali), Self (post-hoc strength + genuine Whisper score), Tribe (weekly opt-in share) | 2 |
| Investment loads next trigger | Answers write the scheduler state that *builds* tomorrow's Dose; pins; voice history | 2 |

**8/8 → 10/10.**

What's carrying the least weight is the **tribe** reward, for a real structural
reason — there's no social graph to draw on. If engagement plateaus, that's the
axis with room in it (a shared deck between two accounts learning opposite
directions is the obvious move, and the symmetrical course design already
supports it).

---

## Ethics check — the Manipulation Matrix

|  | Maker uses product | Maker doesn't |
|---|---|---|
| **Materially improves life** | **Facilitator ← PolePole** | Peddler |
| **Doesn't improve life** | Entertainer | Dealer |

You built this to learn Swahili and you use it yourself; learning a language
materially improves a life. **Facilitator.** No score cap applies.

Against the "when not to use the Hook Model" conditions:

- *Doesn't genuinely improve lives* — no, it teaches a language.
- *Targets vulnerable populations* — no. Adult self-directed learners.
- *Business model depends on regret* — no. There is no ad model and no
  engagement-based revenue, so nothing structurally rewards wasted time. This
  is why the unincentivised "endelea" button is affordable here when it
  wouldn't be in an ad-funded app.
- *Engagement conflicts with wellbeing* — guarded explicitly: the Dose
  terminates, streak copy is never threatening, the rest day exists, and the
  reminder can be switched off by a prompt the app itself offers.

The one live risk: **streak pressure**. A streak is a legitimate self-reward
right up to the point where keeping it becomes the reason to open the app. The
rest day, the content-first notification copy, and refusing to reward longer
sessions are the three mitigations. Worth watching in the data — if learners
start reporting dread, cap the visible streak display rather than defending it.

---

## Habit testing

A habit has formed when ≥5% of a cohort shows unprompted habitual use.

**Instrument:** for each learner, each day — did they open the Dose, and did
they open it before the notification fired?

1. **Who are the habitual users?** Cohort by signup week; the metric is
   unprompted Doses in the last 14 days. Look at what the habitual cohort
   shares — reminder time chosen, *why*, whether they pinned anything in week one.
2. **What's the Habit Path?** The hypothesis to test: *first Dose completed
   within an hour of signup → reminder time set → ≥1 pin in week one → 7
   consecutive days*. Find the step where the habitual and casual cohorts
   diverge, then move that step earlier in onboarding.
3. **Why?** Ask them, in one question, in-app, at day 30: "what makes you open
   this?" The answers either name an emotion (internal trigger formed) or name
   the notification (it hasn't).

**Targets for the first cohort:**

| Metric | Target |
|---|---|
| Dose completion rate (opened → finished) | > 85% — if below, five items is still too many |
| Median Dose duration | 75–120s |
| D7 unprompted-open rate | > 20% |
| D30 habitual (≥5 unprompted Doses in last 7 days) | **> 5%** |
| Doses per lesson completed | > 4 — confirms the habit sits on review, not lessons |

---

## What to build

### Schema

A new per-item state table — the one real gap in the data model.

```csharp
public class CardState
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }

    public string CourseId { get; set; } = Courses.Default;

    // Stable identity for the item: the target-language string for vocab,
    // or "methali:<n>" / "phrase:<lessonId>:<n>" for non-vocab items.
    public string ItemKey { get; set; } = string.Empty;
    // "vocab" | "phrase" | "methali"
    public string ItemKind { get; set; } = "vocab";
    public int SourceLessonId { get; set; }

    // Leitner box 0..5 → intervals { 0, 1, 3, 7, 16, 35 } days.
    public int Box { get; set; }
    public DateTime DueAt { get; set; } = DateTime.UtcNow;
    public int Lapses { get; set; }

    // 0..100, shown to the learner as the strength bar.
    public int Strength { get; set; }

    public bool Pinned { get; set; }
    public DateTime? LastSeenAt { get; set; }
    public int BestSpeechScore { get; set; }
}
```

And on `User`:

```csharp
public string TimeZoneId { get; set; } = "UTC";      // fixes the UTC streak bug
public TimeOnly ReminderLocalTime { get; set; } = new(8, 0);
public bool RemindersEnabled { get; set; } = true;
public string? PushToken { get; set; }
public string? Why { get; set; }                      // trip | family | work | curiosity
public int RestDaysUsed { get; set; }                 // rolling, one per 7
public DateTime? LastDoseAt { get; set; }
public DateTime? LastNotifiedAt { get; set; }         // for the unprompted-open metric
```

Index `CardState` on `(UserId, DueAt)` — it's the only hot query.

### Services

- **`ReviewScheduler`** — Leitner over the intervals above; a wrong answer drops one box, right advances one. Deliberately not full SM-2: the interval ladder is enough at this deck size and is far easier to reason about.
- **`DoseService`** — assembles the day's five: due items first, then pinned, then weakest, then new vocab from viewed lessons; forces exactly one *sema* item; rolls the 1-in-4 methali.
- **`StreakService`** — lifted out of `QuizController`. Fires on **dose completion or quiz pass**, computes dates in the learner's `TimeZoneId`, and applies the rest-day allowance.
- **`ReminderService`** — background worker, sends the day's push at `ReminderLocalTime`, skips learners who already completed today's Dose.

### Endpoints

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/dose` | Today's items, `alreadyDone` flag, last-7-days strip |
| `POST` | `/api/dose/answer` | One item's grade → new strength, XP earned, updated `CardState` |
| `POST` | `/api/dose/complete` | Close the session → streak update, milestones crossed |
| `POST` | `/api/cards/{key}/pin` | Pin / unpin |
| `GET` | `/api/dose/taster` | 3 pre-seeded items, **no auth** — the pre-signup Dose |
| `PUT` | `/api/user/reminders` | Timezone, local reminder time, push token, on/off |

`/api/review/flashcards` stays as-is for free browsing; `/api/review/practice`
is superseded by `/api/dose` and should be kept only as long as the mobile
build still calls it.

### XP, made variable

Replace the deterministic lesson formula with a per-item award:

```
item XP = base(kind) × accuracy × speedBonus + rand(0..3)
dose completion bonus = 5 + rand(0..5)
methali bonus = 10
```

Small absolute numbers with real jitter. The point is not the quantity, it's
that the learner can't predict the total before finishing.

### Clients

- **Web** — `frontend/src/pages/DosePage.jsx`; rework the `Dashboard.jsx` hero; pinned deck in `Flashcards.jsx`; `Notification` permission + reminder time in `Settings.jsx`.
- **Mobile** — `mobile/src/screens/DoseScreen.js`; `expo-notifications` registration and token upload; deep link `polepole://dose` so the push lands *in* the Dose.

### Build order

1. `CardState` + `ReviewScheduler` + `GET /api/dose` + `POST /api/dose/answer`. Nothing user-visible changes; the loop's spine exists.
2. `DosePage` / `DoseScreen` and the dashboard hero. The loop runs — this alone should move the diagnostic from 3 to about 6.
3. `StreakService`: move it out of the quiz, fix the timezone, add the rest day. Fixes the day-31 cliff.
4. Variable XP, strength reveals, methali pool, milestones. This is the step that buys the variable-reward points — don't skip it, it's the one that looks cosmetic and isn't.
5. Reminders: timezone, local reminder time, Expo push, `ReminderService`, deep links.
6. Re-sequenced onboarding: taster Dose before account.
7. Pins, voice history, the weekly share.
8. Instrument the habit test and read the first cohort.

Steps 1–3 are the loop. 4–6 are what make it hold. 7–8 are what tell you
whether it did.

---

## As built

All eight steps are implemented. Where the build departs from the sketch above,
this is what exists and why.

| Sketched | Built | Why |
|---|---|---|
| `POST /api/cards/{key}/pin` | `POST /api/cards/pin` with `{ itemKey, pinned }` | A key is the word itself (`yeye / wao`, `Habari?`); slashes and question marks do not survive a path segment. |
| — | `POST /api/dose/open` | The dashboard also calls `GET /api/dose` to draw its hero, so fetching cannot be what counts as opening. |
| — | `POST /api/dose/taster/answer` | Taster answers stay off the wire like every other answer, so grading needs its own anonymous call. |
| — | `POST /api/user/reminders/shown` | The browser shows its own reminder; this is how the server learns one went out. |
| — | `PUT /api/user/why`, `POST /api/user/habit-answer` | The why, and the day-30 question. |
| — | `POST/GET/DELETE /api/voice`, `GET /api/voice/{id}/audio` | Kept pronunciation takes. Audio is private to its owner. |
| — | `GET /api/habit/report` | The habit-test read-out. 404 unless `Habit:ReportKey` is configured and sent as `X-Report-Key`. |
| `RestDaysUsed` counter | `LastRestDayAt` | "One per rolling seven" is a question about when, not how many. |
| `LastDoseAt` for the strip | `PracticeDays` table | One row per learner per local day: opened, opened-before-reminder, completed, duration. It is the habit-test instrument and what draws the strip. |
| Web push + weekly email digest | Browser `Notification` while a tab is open | No service worker or push subscription yet, and no mail sender. The UI says so where reminders are switched on. |
| The *why* weights lesson themes | The *why* is used in lapse copy only | Lesson themes are `Grammar`, `Vocabulary`, `Culture`… — nothing a trip or a family maps onto. Needs topical tags on lessons first. |

Rules that hold across all of it:

- A reminder goes out once a day, never to someone already done, never more
  than an hour late, and its copy names the words waiting — never the streak.
- The completion card asks at most one thing (stop reminders → the day-30
  question → the weekly share), only on the day's first completion, and each
  ask is recorded as made the moment it is sent.
- Nothing is stored from a recording unless the learner taps to keep it; per
  card the first take is kept for good plus the latest four.
