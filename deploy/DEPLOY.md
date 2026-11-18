# Deploying PolePole to Azure

This deploys the whole app as **one container** — the .NET API also serves the
built React frontend, so there's a single origin, no CORS, and one thing to
operate. The SQLite database persists on Azure App Service's `/home` storage.

```
        ┌─────────────────────────── Azure Web App for Containers ──┐
Browser │  https://<app>.azurewebsites.net                          │
  ─────▶│    ├─ /            → React frontend (static, from wwwroot) │
        │    ├─ /api/*       → .NET API                              │
        │    └─ /home/data   → swahili.db (persistent)              │
        └───────────────────────────────────────────────────────────┘
   Image built by `az acr build` and stored in Azure Container Registry.
```

Speech-to-text pronunciation (Whisper) is **not** included here — it needs ~2 GB
RAM and is optional. The drill degrades to listen-only without it. See
"Adding Whisper later" below.

---

## Prerequisites

1. **Azure CLI** — https://aka.ms/InstallAzureCli
2. **Sign in**: `az login` (and `az account set --subscription "<name>"` if you
   have more than one). `az account show` must print a subscription — a bare
   Entra tenant is not enough; create one at portal.azure.com → Subscriptions.
3. That's it — you do **not** need Docker locally. `az acr build` builds the
   image in the cloud from the repo's `Dockerfile`.

---

## Deploy

From the repo root:

```bash
# 1) Secrets — set these in your shell (never commit them)
export JWT_KEY="$(openssl rand -base64 48)"      # any 32+ char random string
export AZURE_TTS_KEY="<your-azure-speech-key>"   # optional: native Swahili audio
export AZURE_TTS_REGION="eastus"                 # optional

# 2) Run it
bash deploy/azure-deploy.sh
```

The script creates a resource group, a container registry, builds & pushes the
image, creates a Linux **B1** App Service plan (~US$13/mo), and wires up the web
app with persistent storage. It prints the live URL at the end. The first request
takes ~30 s while the container cold-starts.

> **Note on secrets:** they're passed as **App Settings** (environment variables)
> on the web app — visible only in your Azure portal, never in the image or git.
> The app reads `Jwt__Key`, `Tts__Azure__Key`, etc. (`__` = nested config).

---

## Native-quality audio (Azure Speech)

The 🔊 buttons call `/api/tts`, which needs an Azure Speech resource. Without
one the endpoint returns `204` and the client falls back to the built-in
browser/device voice — the app still works, it just sounds worse.

Create the resource once (**F0 is free forever**: 0.5M characters/month of
neural TTS):

```bash
az provider register --namespace Microsoft.CognitiveServices --wait
```

```bash
az cognitiveservices account create -n polepole-speech-a82a5661 -g polepole-rg --kind SpeechServices --sku F0 -l eastus --yes
```

Then wire the key into the web app and restart it:

```bash
export AZURE_TTS_KEY="$(az cognitiveservices account keys list -n polepole-speech-a82a5661 -g polepole-rg --query key1 -o tsv)"
```

```bash
az webapp config appsettings set -n polepole-app-a82a5661 -g polepole-rg --settings "Tts__Provider=Azure" "Tts__Azure__Key=$AZURE_TTS_KEY" "Tts__Azure__Region=eastus" -o none
```

Gotchas, all of which cost real time at least once:

- **Register the provider first.** On a fresh subscription `account create`
  fails with `MissingSubscriptionRegistration` until
  `Microsoft.CognitiveServices` is registered. It is a free, one-time, no-cost
  subscription setting.
- **`az webapp restart` is not enough.** A container App Service can keep
  serving the old process with the old environment. Use a full stop/start, then
  confirm `GET /api/tts/status` reports `{"enabled":true}`:
  ```bash
  az webapp stop -n polepole-app-a82a5661 -g polepole-rg && az webapp start -n polepole-app-a82a5661 -g polepole-rg
  ```
- **Keep `Tts:Warmup:Enabled` off on F0.** The warm-up job paces itself at
  `Tts:Warmup:DelayMs` (default 1100ms ≈ 54 req/min), well over F0's ~20
  req/min ceiling. It stays `false` in `appsettings.json`; leave it there unless
  you move to S0. Clips are cached on disk under `/home` either way, so each
  distinct word is synthesized once.
- `sw-KE-ZuriNeural` and `sw-KE-RafikiNeural` both exist in `eastus`. Colocate
  the Speech resource with the app to keep latency down.

Settings applied this way survive a redeploy — `az webapp config appsettings
set` adds and updates, it never removes the settings you did not list. So you
only need to export `AZURE_TTS_KEY` before `azure-deploy.sh` on a first deploy,
or after rotating the key.

---

## Redeploy after code changes

Re-run the same script — `az acr build` rebuilds the image, then the app is
stopped, reconfigured and started once. The script waits for `/healthz` and
exits non-zero if the new container does not answer within five minutes.
Resource names are derived from your subscription id, so a re-run always targets
the same resources and updates them in place. The existing `Jwt__Key` is reused,
so redeploying does not sign your users out.

### Site down after a deploy

If the site returns 503 after a deploy and the log stream shows the container
repeating `INSERT OR IGNORE INTO "__EFMigrationsLock"` until Azure reports
"Container did not respond to startup probe on port 8080", a previous container
was killed while it held the migration lock. The lock is a row in the SQLite
database, so it survives the container, and rolling back the image does not
help: every image runs migrations at startup.

Confirm it from the startup logs:

```bash
az webapp log download -n polepole-app-a82a5661 -g polepole-rg --log-file logs.zip
# then read LogFiles/StartupLogs/*_failure.log
```

Then delete the orphaned row. The table holds nothing but this lock. The
command runs in the Kudu sidecar, which shares `/home` with the app:

```bash
MSYS_NO_PATHCONV=1 az rest --method post   --uri https://polepole-app-a82a5661.scm.azurewebsites.net/api/command   --resource https://management.azure.com/   --body '{"command":"sqlite3 /home/data/swahili.db \"DELETE FROM __EFMigrationsLock;\"","dir":"/home"}'
```

The container that is waiting picks the lock up on its next retry and starts by
itself within about a minute; no further restart is needed.

---

## Database schema & migrations

The schema is managed with **EF Core migrations**. On startup the app calls
`db.Database.Migrate()`, which creates the database and the full schema when
there is none and applies only the pending migrations when there is — so a
redeploy keeps existing accounts and progress instead of needing the database
dropped.

To change the schema, edit the entities and generate a migration:

```bash
cd backend/SwahiliCourse.Api
dotnet ef migrations add DescribeTheChange     # needs: dotnet tool install --global dotnet-ef
```

Commit the files under `Migrations/`. The next deploy applies them on startup.

### Baselining the deployed database

**One-off, needed only for the first migration-based deploy.** The live database
was created by the old `EnsureCreated()` call, so it has the real tables but no
`__EFMigrationsHistory`. `Migrate()` would see zero applied migrations, try to
create `Users` again, and the container would crash on startup with
`SQLite Error 1: 'table "Users" already exists'`.

We **baseline** it — record `InitialCreate` as already applied — rather than
resetting it. The initial migration's DDL is identical to what `EnsureCreated()`
produced, so the existing file is already correct and there is nothing to
rebuild.

Baselining wins on operations rather than on safety. The database only ever
holds `Users` and `LessonProgress` — lesson content is loaded from the JSON
files baked into the image, not stored — and as of 2026-11-07 it had no user
accounts in it, so a reset would lose nothing today either. Baselining is
simply less to go wrong: one App Setting plus the deploy you were doing
anyway, and it never touches the persistent volume. It is also the only
option left once real accounts exist.

`Database:BaselineExistingSchema=true` makes the app do this itself on startup,
so it needs no shell or `sqlite3` inside the container (the image has neither):

```bash
# 1) Arm the one-off baseline (this restarts the app on the old image, which
#    ignores the setting — harmless).
az webapp config appsettings set -g polepole-rg -n <app> \
  --settings Database__BaselineExistingSchema=true

# 2) Deploy the migration-based image.
bash deploy/azure-deploy.sh

# 3) Confirm it ran — look for "Baselined existing schema as migration ...".
az webapp log tail -g polepole-rg -n <app>

# 4) Disarm it again (tidiness — see below).
az webapp config appsettings delete -g polepole-rg -n <app> \
  --setting-names Database__BaselineExistingSchema
```

The step is safe to repeat and safe to forget: it acts **only** on a database
that has a `Users` table and no `__EFMigrationsHistory`. On a fresh database it
does nothing and lets migrations create the schema; on an already-baselined one
it logs `Database already tracks migrations` and stops. Step 4 is housekeeping,
not a correctness requirement.

> **One assumption.** Baselining declares the existing schema to match
> `InitialCreate`, including `Users.CourseId`. The pre-migrations code added that
> column with an idempotent `ALTER TABLE` on *every* startup, so the deployed
> database has had it since the course-direction release. If you ever baseline a
> database that never ran that code, add the column first:
> `ALTER TABLE Users ADD COLUMN CourseId TEXT NOT NULL DEFAULT 'sw';`

**Resetting instead** is just as safe while the database has no accounts in
it: point the app at an empty directory and let migrations build the schema
from scratch. The old file stays on disk, unused and ignored. This stops being
an option as soon as there are real users whose progress you would be
throwing away.

```bash
az webapp config appsettings set -g polepole-rg -n <app> --settings DataDir=/home/data2
```


## Backoffice

The web app has an admin area at `/admin` (API: `/api/admin/*`) for managing
accounts and checking on the service:

| Page | What it is for |
|------|----------------|
| Overview | Accounts, who has been seen recently, sign-ups and practice per day |
| Users | Search and filter accounts; open one to edit it, set a new password, export its data, reset progress, suspend, delete, or grant/revoke admin |
| Content | What each course contains, how far learners get through it, and checks on the lesson files (duplicate ids, unanswerable questions, gaps) |
| Habit report | The habit-test metrics from `docs/DAILY-PRACTICE-LOOP.md` |
| System | Database, migrations, TTS cache, Whisper sidecar, the conversation practice switch, reminders, CORS — state only, never secret values |
| Audit log | Every change an admin made, who made it and when |

**Making the first admin.** Admins grant the role to each other from the Users
page, so only the first one needs help:

1. Register a normal account in the app with the email you want to administer from.
2. Name that email in `Admin:Emails` (comma-separated for several):

   ```bash
   az webapp config appsettings set -g "$RG" -n "$APP" --settings Admin__Emails="you@example.com"
   ```

3. The setting change restarts the app; at startup the account is promoted and
   the grant is written to the audit log. Sign in and open `/admin`.

Do it in that order. Sign-up does not verify email addresses, so an address
listed before its account exists could be registered by someone else, who
would be promoted at the next restart. Startup only ever promotes accounts that
already exist, never demotes, and you can clear the setting once you are in.

**How access is enforced.** The admin flag is read from the account's row on
every request, not stored in the 30-day sign-in token. Revoking admin,
suspending an account, or deleting it therefore takes effect on the very next
request, with no need to wait for a token to expire. An admin cannot remove
their own role, suspend or delete themselves — so the last admin cannot be
locked out from inside the backoffice.

**Locally**, register an account, then run the API once with the variable set
(`Admin__Emails=you@example.com dotnet run --launch-profile http`).

## Point the mobile app at it

In `mobile/src/config.js`, set `API_HOST_OVERRIDE` to your deployed URL:

```js
const API_HOST_OVERRIDE = 'https://<app>.azurewebsites.net';
```

Testers running Expo Go will then hit the cloud backend instead of your laptop.

---

## Custom domain (optional, for pole-pole.app)

```bash
az webapp config hostname add -g polepole-rg --webapp-name <app> \
  --hostname app.pole-pole.app
az webapp config ssl create -g polepole-rg --name <app> \
  --hostname app.pole-pole.app          # free managed certificate
```
Add a CNAME from `app.pole-pole.app` → `<app>.azurewebsites.net` at your registrar.
(The marketing landing page can live separately on Vercel at the apex domain.)

---

## Adding Whisper later (pronunciation scoring)

The sidecar runs as its own **Azure Container App** next to the web app, built
from `whisper-service/Dockerfile` with the Whisper model baked into the image.

```bash
bash deploy/azure-deploy.sh           # 1) web app image that can send the API key
```

```bash
bash deploy/azure-whisper-deploy.sh   # 2) build + run the sidecar, wire up the web app
```

Step 1 matters the first time: the sidecar's URL is public, so `/transcribe`
requires a shared secret in an `X-Api-Key` header. A web app image built before
`Speech:ApiKey` existed does not send it, every transcription gets a `401`, and
the drill quietly stays listen-only.

What the second script does:

1. `az acr build` on `whisper-service/` (a few minutes — it downloads the model).
2. Creates the `polepole-env` Container Apps environment and the
   `polepole-whisper` app: 1 vCPU, 2 GiB, external HTTPS ingress on port 8081.
3. Generates the shared secret once (reused on re-runs) and stores it as a
   Container App secret (`WHISPER_API_KEY`).
4. Waits for `/health` to report the model loaded and auth on, and only then
   sets `Speech__Enabled`, `Speech__WhisperUrl` and `Speech__ApiKey` on the web
   app. If the sidecar never comes up, the web app is left untouched.

Check it: `https://<app>.azurewebsites.net/api/speech/status` → `{"enabled":true}`,
and the mic appears on the pronunciation drill.

Knobs (environment variables, same style as `azure-deploy.sh`):

| Variable | Default | Notes |
|----------|---------|-------|
| `MIN_REPLICAS` | `0` | `0` scales to zero after 5 idle minutes and is nearly free at low traffic, at the price of a ~25 s cold start. The backend pings the sidecar when a drill opens (`GET /api/speech/status`) so the boot usually overlaps with the learner listening, and waits up to `Speech__TimeoutSeconds` (default 90) for a transcription. `1` keeps a replica warm around the clock (roughly US$20–25/month — check current Container Apps pricing). |
| `WHISPER_MODEL` | `small` | Baked in at build time. `medium` needs `MEMORY=6.0Gi CPU=2.0` or so. |
| `CPU` / `MEMORY` | `1.0` / `2.0Gi` | Consumption plan pairs: memory is 2× the vCPU count. |

Redeploy after changing `whisper-service/`: re-run the script. Each run pushes
a fresh timestamped tag, which is what makes Container Apps roll a new revision.

Logs: `az containerapp logs show -n polepole-whisper -g polepole-rg --follow`.
The environment is created without a Log Analytics workspace to avoid its
per-GB charge, so there is no log history — only the live stream.

Turn it off again: set `Speech__Enabled=false` on the web app; delete
`polepole-whisper` and `polepole-env` to stop paying for them.

**Elsewhere (a VPS, another container host):** run the same image, set
`WHISPER_API_KEY` on it, put it behind HTTPS, and set the same three
`Speech__*` settings on the web app.

### Hosted Whisper instead (Groq)

The sidecar is slow on one vCPU: about 5–7 s per recording, plus a ~25 s cold
start after it has scaled to zero. `Speech__Provider=Groq` sends recordings to
Groq's hosted Whisper large-v3 instead. Measured on twelve Swahili test clips:

| | Time per clip | Scored 100 |
|---|---|---|
| Sidecar (`small`, 1 vCPU) | 5–7 s | 8 of 12 |
| Groq `whisper-large-v3` | ~0.25 s | 11 of 12 |

What it costs you: an API key from <https://console.groq.com>, a per-use bill
(about US$0.11 per audio hour, each request billed as at least 10 s — roughly
30 cents per 1,000 recordings; check Groq's pricing page), and **learner voice
recordings leave your infrastructure** — read Groq's data terms first.

Turn it on (the key is yours to set; nothing in the repo or the deploy scripts
writes it):

```bash
az webapp config appsettings set -n polepole-app-a82a5661 -g polepole-rg --settings "Speech__Enabled=true" "Speech__Provider=Groq" "Speech__Groq__ApiKey=<your-groq-key>" -o none
```

- **Fallback.** If a Groq call fails (outage, rate limit, bad key) the backend
  retries on the sidecar at `Speech__WhisperUrl`, so leave the sidecar deployed
  — scaled to zero it costs next to nothing. `Speech__Groq__FallbackToSidecar=false`
  turns that off; without a sidecar the drill simply degrades to listen-only.
- **Model.** Keep `whisper-large-v3`. `whisper-large-v3-turbo` is cheaper and
  scored the same on speech, but it reports no "this is not speech" signal, so
  a silent recording comes back as invented words instead of empty.
- **Check it.** The backoffice System page shows the provider and has a
  "Check Groq now" button that verifies the key is accepted.
- **Back to the sidecar:** `Speech__Provider=Sidecar`.

---

## Kinyarwanda audio (the voice sidecar)

No cloud provider has a Kinyarwanda voice, so the `rw` course gets its audio
from a second sidecar: `tts-service/`, a small service wrapping Digital
Umuganda's open Kinyarwanda voice (CC-BY-SA 4.0). Until it is deployed the
course works but has no 🔊 buttons.

```bash
bash deploy/azure-deploy.sh       # 1) web app image that knows the Sidecar provider
```

```bash
bash deploy/azure-tts-deploy.sh   # 2) build + run the sidecar, wire up the web app
```

What the second script does:

1. `az acr build` on `tts-service/` (ten minutes or more — it installs PyTorch,
   downloads the 1.1 GB voice and synthesizes a test phrase).
2. Creates the `polepole-tts` Container App in the existing `polepole-env`:
   2 vCPU, 4 GiB, external HTTPS ingress on port 8082, scale to zero.
3. Generates a shared secret (`TTS_API_KEY`) and stores it as a Container App
   secret.
4. Waits for `/health`, synthesizes one phrase through the deployed service,
   and only then sets `Tts__Providers__rw=Sidecar`, `Tts__Sidecar__Url` and
   `Tts__Sidecar__ApiKey` on the web app.

`Tts__Provider` is untouched, so Swahili and English stay on their cloud voice.

- **Cold starts.** A sleeping sidecar takes minutes to come back (large image,
  about a minute to load the voice). Learners should not notice: on every
  start the web app waits for the sidecar and pre-generates all vocabulary,
  dialogue lines and proverbs of the course (`Tts__Sidecar__Warmup`, default
  on), then serves them from its clip cache. A phrase outside the lesson files
  is synthesized on demand and waits up to `Tts__Sidecar__TimeoutSeconds`
  (default 120).
- **After editing `lessons-rw.json`:** redeploy the web app as usual; the new
  phrases are generated on its next start.
- **Check it.** `https://<app>.azurewebsites.net/api/tts/status?course=rw`
  returns `{"enabled":true}`, and `/api/tts?text=amazi&course=rw` plays a clip.
- **Logs:** `az containerapp logs show -n polepole-tts -g polepole-rg --follow`.
- **Turn it off:** delete the three settings above; the course goes back to
  running without sound.

---

## Conversation practice (spoken role-play)

The `conversation` lesson block lets a learner talk with an AI partner: Whisper
transcribes what they say, Claude answers in character (and adds a short
correction when one is needed), and the course's TTS voice reads the answer.
It is off until the web app has an Anthropic API key:

```bash
az webapp config appsettings set -g polepole-rg -n <app> --settings Conversation__Enabled=true Conversation__ApiKey="<anthropic-api-key>"
```

Locally: `dotnet user-secrets set Conversation:ApiKey "<key>"` and
`dotnet user-secrets set Conversation:Enabled true` in `backend/SwahiliCourse.Api`.

- **The switch.** `Conversation__Enabled` is only the default. Admins can turn
  conversation practice on or off from the backoffice (**System → Conversation
  practice**); it takes effect at once, is written to the audit trail, and
  from then on overrides the setting, across restarts and redeploys. The API
  key still has to be set here — the switch cannot supply one, and the page
  says "On, but no API key" when that is what is missing.
- **Each piece is optional.** Without Whisper the learner types instead of
  speaking; without cloud TTS the device voice reads the reply. Only the API
  key is required.
- **Cost control.** `/api/conversation/turn` needs a signed-in account, each
  account gets `Conversation:DailyTurnLimit` turns a day (default 40, counted
  in memory, so a restart resets it), and one role-play is
  `Conversation:MaxTurns` learner turns (default 8). `Conversation:Model`
  defaults to `claude-sonnet-5-5`; `claude-haiku-5-5` is about 20x cheaper and
  a little faster, but made Swahili agreement mistakes when tested.
- **Redeploy the sidecar too** (`bash deploy/azure-whisper-deploy.sh`). The
  backend now sends the scenario's vocabulary with each recording so Whisper
  spells expected words the expected way; an older sidecar ignores it and
  still works, just less accurately.
- **Adding a scenario** is content only: put a `"type": "conversation"` block
  with a `scenario` in the lesson file (see lesson 7 of `lessons.json`). One
  per lesson. The model only ever sees the scenario stored on the server.
- Not in the mobile app yet — it skips the block.

---

## Hosting the frontend on Vercel instead

The container above is self-contained — it serves the frontend itself. If you'd
rather put the React app on Vercel's CDN (and get preview deploys), keep this
API deploy and follow `deploy/VERCEL.md`: it adds a `VITE_API_BASE` build
variable on the Vercel side and a `Cors__AllowedOrigins` App Setting here.
Vercel cannot host the .NET API itself — no .NET runtime, and no persistent
disk for SQLite.

---

## Costs & teardown

- **B1 plan**: ~US$13/month. **ACR Basic**: ~US$5/month.
- Scale down to **F1 (free)** for a tiny test, but F1 has no persistent
  `/home` storage guarantees and limited CPU — B1 is the safer beta tier.
- Delete everything when done:
  ```bash
  az group delete -n polepole-rg --yes --no-wait
  ```

---

## Before real launch (not just beta)

- Move from SQLite to Azure Database for PostgreSQL for multi-user scale.
- Rotate `JWT_KEY` and store it in Azure Key Vault.
