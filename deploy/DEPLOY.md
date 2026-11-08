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

## Redeploy after code changes

Re-run the same script — `az acr build` rebuilds the image and the app restarts.
Resource names are derived from your subscription id, so a re-run always targets
the same resources and updates them in place. The existing `Jwt__Key` is reused,
so redeploying does not sign your users out.

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
produced, so the existing file is already correct; baselining keeps the beta
testers' accounts and progress, while a reset would delete them for no gain.

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

**Resetting instead** (only worthwhile if the data is genuinely disposable and
you'd rather not think about the above): point the app at an empty directory and
let migrations build the schema from scratch. This abandons every account and all
progress in the old file, which stays on disk unused.

```bash
az webapp config appsettings set -g polepole-rg -n <app> --settings DataDir=/home/data2
```


## Point the mobile app at it

In `mobile/src/config.js`, set `API_HOST_OVERRIDE` to your deployed URL:

```js
const API_HOST_OVERRIDE = 'https://<app>.azurewebsites.net';
```

Testers running Expo Go will then hit the cloud backend instead of your laptop.

---

## Custom domain (optional, for polepole.com)

```bash
az webapp config hostname add -g polepole-rg --webapp-name <app> \
  --hostname app.polepole.com
az webapp config ssl create -g polepole-rg --name <app> \
  --hostname app.polepole.com          # free managed certificate
```
Add a CNAME from `app.polepole.com` → `<app>.azurewebsites.net` at your registrar.
(The marketing landing page can live separately on Vercel at the apex domain.)

---

## Adding Whisper later (pronunciation scoring)

The sidecar is a separate service. Two options:

- **Azure Container Apps** — deploy `whisper-service/` as its own container
  (give it 2 GB RAM), then set `Speech__Enabled=true` and
  `Speech__WhisperUrl=https://<whisper-app>...` on the web app.
- **A small VPS** running `whisper-service` behind HTTPS, same two settings.

Keep it private/network-restricted — it has no auth of its own.

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
