# Deploying the PolePole frontend to Vercel

Vercel hosts the **React frontend only**. The API stays on Azure App Service.

Vercel's runtimes are Node, Python, Ruby and Go — there is no .NET — and its
filesystem is ephemeral, so the ASP.NET Core API could not keep its SQLite
database, its on-disk TTS audio cache, or its background `TtsWarmupService`
there. Hence the split:

```
                  ┌── Vercel (static, CDN) ──┐
Browser ─────────▶│  https://<you>.vercel.app │
   │              │    └─ React app (dist/)   │
   │              └───────────────────────────┘
   │  fetch https://polepole-app-a82a5661.azurewebsites.net/api/*   (CORS)
   └─────────────▶┌── Azure Web App for Containers ─┐
                  │  /api/*     → .NET API          │
                  │  /home/data → swahili.db        │
                  └─────────────────────────────────┘
```

The existing single-origin deploy (`deploy/DEPLOY.md`) still works unchanged —
the container keeps serving its own copy of the frontend from `wwwroot`. Adding
Vercel gives you a CDN-hosted frontend and preview deploys on top of it; the
Azure URL remains a complete, working app.

## The real values

| | |
|---|---|
| API origin | `https://polepole-app-a82a5661.azurewebsites.net` |
| Azure web app | `polepole-app-a82a5661` |
| Resource group | `polepole-rg` |
| Subscription | `Azure subscription 1` (`a82a5661-8d74-436c-af9f-4abf298581b0`) |
| Vercel Root Directory | `frontend` |
| Build-time variable | `VITE_API_BASE` |

---

## 1) Deploy the API first — ✅ already done

The API is live at `https://polepole-app-a82a5661.azurewebsites.net` and
verified (`/healthz`, the SPA and `/api/courses` all return 200). Nothing to do
here. To re-check the hostname:

```bash
az webapp list -g polepole-rg --query "[].defaultHostName" -o tsv
```

## 2) Create the Vercel project

The repo root is not the frontend, so **set the Root Directory to `frontend`** —
`frontend/vercel.json` then supplies the Vite build and the SPA rewrites that
keep React Router deep links from 404ing.

**Dashboard (recommended** — this is what gives you auto-deploy on push and
preview deployments for pull requests**)**

1. <https://vercel.com/new> → import `nestedl00p/polepole`.
2. Set **Root Directory** to `frontend`. The framework preset should detect as
   Vite; leave the build and output settings alone — `frontend/vercel.json`
   already pins `npm run build` and `dist`.
3. Add the environment variable from step 3 **before** clicking Deploy.

**CLI (alternative)**

```bash
npm i -g vercel
```

```bash
vercel login
```

```bash
cd frontend && vercel link
```

`vercel link` will not prompt you to authenticate — it fails if you are logged
out, so run `vercel login` first. Check with `vercel whoami`.

Running the CLI from `frontend/` makes that directory the deploy root for CLI
deploys, but **Git-triggered deploys use the dashboard setting**, so if you
connect the project to GitHub, still confirm Settings → Build and Deployment →
Root Directory is `frontend`.

## 3) Point the frontend at the API

`VITE_API_BASE` is read at **build time** (Vite inlines it into the bundle), so
it must exist in Vercel *before* a build, and changing it requires a redeploy —
editing the variable alone changes nothing already shipped.

Dashboard: Settings → Environment Variables, or via the CLI:

```bash
cd frontend && echo "https://polepole-app-a82a5661.azurewebsites.net" | vercel env add VITE_API_BASE production
```

```bash
cd frontend && echo "https://polepole-app-a82a5661.azurewebsites.net" | vercel env add VITE_API_BASE preview
```

Add it to `preview` as well, or preview deploys will build against the
same-origin default and every API call on them will 404.

Give the origin only — no trailing path. A trailing slash is harmless
(`frontend/src/config.js` strips it), but a trailing `/api` is not: it would
produce `/api/api/...`.

Leaving it unset keeps the same-origin behaviour (`/api/...`), which is what the
Azure container's own copy of the frontend wants — so the default is correct for
that build and only Vercel needs the variable.

## 4) Let the API accept the Vercel origin

**This step is required and is not done yet.** `Cors__AllowedOrigins` is
currently unset on the Azure web app, so the API falls back to its defaults —
`http://localhost:5173` and `http://localhost:3000` — and rejects every
`*.vercel.app` origin. Run this once the Vercel URL exists, substituting your
actual project URL (`__` is .NET's nested-config separator):

```bash
MSYS_NO_PATHCONV=1 az webapp config appsettings set -g polepole-rg -n polepole-app-a82a5661 --settings Cors__AllowedOrigins="https://polepole.vercel.app"
```

Several origins are comma-separated. An entry may use a `*.` wildcard to match
subdomains, which is the only practical way to cover Vercel's per-deployment
preview URLs (`polepole-<hash>-<scope>.vercel.app`):

```bash
MSYS_NO_PATHCONV=1 az webapp config appsettings set -g polepole-rg -n polepole-app-a82a5661 --settings Cors__AllowedOrigins="https://polepole.vercel.app,https://*.vercel.app"
```

Note the trade-off: `https://*.vercel.app` lets **any** site on `vercel.app`
call your API. Prefer the exact-origin form, and add the wildcard only while you
actually need previews. (Auth is a Bearer token in `localStorage`, not a cookie,
so CORS is not what protects a session here — but it does gate who can reach
your unauthenticated endpoints.)

Two things to know about this command:

- It **replaces** the localhost defaults. Once the setting exists the list is
  exactly what you typed, so include `http://localhost:5173` too if you still
  want to run the Vite dev server against the deployed API.
- It **restarts the web app**, so expect a cold start on the next request.

`MSYS_NO_PATHCONV=1` matters only in Git Bash on Windows, where arguments that
look like POSIX paths get rewritten into Windows paths. It is harmless
elsewhere, and PowerShell does not need it.

Verify the setting landed:

```bash
MSYS_NO_PATHCONV=1 az webapp config appsettings list -g polepole-rg -n polepole-app-a82a5661 --query "[?name=='Cors__AllowedOrigins'].value" -o tsv
```

## 5) Deploy

```bash
cd frontend && vercel --prod
```

Or just push to `main` if you imported via the dashboard.

## 6) Verify

Check CORS from the command line before opening a browser — a preflight from
your Vercel origin must come back with a matching `Access-Control-Allow-Origin`:

```bash
curl -s -i -X OPTIONS "https://polepole-app-a82a5661.azurewebsites.net/api/courses" -H "Origin: https://polepole.vercel.app" -H "Access-Control-Request-Method: GET" | grep -i "^HTTP/\|access-control"
```

No `access-control-*` headers in the response means the origin is not allowed —
re-check step 4 for an exact match on scheme and host, and no trailing slash.

Then, in the browser:

- Open the Vercel URL. The first API call may take ~30 s while the Azure
  container cold-starts on the B1 plan.
- Hard-reload a deep link. Use a public one such as `/login` to test the SPA
  rewrite on its own: it should render the signup form, not a 404. `/lesson/3`
  and `/flashcards` sit behind `<Protected>`, so while signed out they correctly
  bounce to the landing page — that is the router working, not a rewrite
  failure. A genuine rewrite failure shows Vercel's own 404 page, and means the
  Root Directory or `vercel.json` is not being picked up.
- The 🔊 audio and the speak-and-check drill go through `/api/tts` and
  `/api/speech/*`; both are covered by the same CORS setting.

---

## Mobile app

Unaffected — it talks to the API directly. Set `API_HOST_OVERRIDE` in
`mobile/src/config.js` to the **Azure** URL
(`https://polepole-app-a82a5661.azurewebsites.net`), not the Vercel one.
