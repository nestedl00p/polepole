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
   have more than one).
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
(If you kept the random names from the first run, set `RG`, `ACR`, `APP`, `PLAN`
to those values at the top of the script first so it updates in place instead of
creating new resources.)

---

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

- Swap `EnsureCreated()` for EF Core migrations (see root README).
- Move from SQLite to Azure Database for PostgreSQL for multi-user scale.
- Rotate `JWT_KEY` and store it in Azure Key Vault.
