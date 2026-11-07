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
   │  fetch https://<app>.azurewebsites.net/api/*   (CORS)
   └─────────────▶┌── Azure Web App for Containers ─┐
                  │  /api/*     → .NET API          │
                  │  /home/data → swahili.db        │
                  └─────────────────────────────────┘
```

The existing single-origin deploy (`deploy/DEPLOY.md`) still works unchanged —
the container keeps serving its own copy of the frontend from `wwwroot`. Adding
Vercel gives you a CDN-hosted frontend and preview deploys on top of it; the
Azure URL remains a complete, working app.

---

## 1) Deploy the API first

You need its URL before the frontend can be built. Follow `deploy/DEPLOY.md`,
then find the name:

```bash
az webapp list -g polepole-rg --query "[].defaultHostName" -o tsv
```

## 2) Create the Vercel project

The repo root is not the frontend, so **set the Root Directory to `frontend`** —
`frontend/vercel.json` then supplies the Vite build and the SPA rewrites that
keep React Router deep links from 404ing.

Via the dashboard: import the Git repo, set Root Directory to `frontend`, and
add the environment variable below before the first build.

Or via the CLI:

```bash
npm i -g vercel
```

```bash
cd frontend && vercel link
```

## 3) Point the frontend at the API

`VITE_API_BASE` is read at **build time** (Vite inlines it into the bundle), so
it must be set in Vercel *before* a build, and changing it needs a redeploy.

```bash
cd frontend && vercel env add VITE_API_BASE production
```

Enter the API origin with no trailing path, e.g.
`https://polepole-app-1234.azurewebsites.net`. Add it to the `preview`
environment too if you want preview deploys to work.

Leaving it unset keeps the old same-origin behaviour (`/api/...`), which is what
the Azure container's own copy of the frontend wants — so the default is correct
for that build and only Vercel needs the variable.

## 4) Let the API accept the Vercel origin

The API rejects cross-origin calls unless the origin is listed. Set this App
Setting (`__` is .NET's nested-config separator), substituting your names:

```bash
az webapp config appsettings set -g polepole-rg -n <your-app-name> --settings Cors__AllowedOrigins="https://<your-project>.vercel.app"
```

Several origins are comma-separated. An entry may use a `*.` wildcard to match
subdomains, which is the only practical way to cover Vercel's per-deployment
preview URLs:

```bash
az webapp config appsettings set -g polepole-rg -n <your-app-name> --settings Cors__AllowedOrigins="https://<your-project>.vercel.app,https://*.vercel.app"
```

Note the trade-off: `https://*.vercel.app` lets **any** site on `vercel.app`
call your API, so prefer exact origins in production and add the wildcard only
while you need previews. (Auth is a Bearer token in `localStorage`, not a
cookie, so CORS is not what protects a session here — but it does gate who can
reach your unauthenticated endpoints.)

## 5) Deploy

```bash
cd frontend && vercel --prod
```

## 6) Verify

- Open the Vercel URL and sign in. The first call may take ~30 s while the
  Azure container cold-starts on the B1 plan.
- Hard-reload on a deep link such as `/lesson/3` — it should render, not 404.
  If it 404s, the Root Directory or `vercel.json` is not being picked up.
- A CORS error in the browser console means step 4's origin does not match
  exactly (check `http` vs `https` and any trailing slash).
- The 🔊 audio and the speak-and-check drill go through `/api/tts` and
  `/api/speech/*`; both are covered by the same CORS setting.

---

## Mobile app

Unaffected — it talks to the API directly. Set `API_HOST_OVERRIDE` in
`mobile/src/config.js` to the **Azure** URL, not the Vercel one.
