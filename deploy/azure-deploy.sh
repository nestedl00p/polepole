#!/usr/bin/env bash
# ============================================================================
# PolePole — deploy to Azure (Web App for Containers, single image)
# ============================================================================
# Builds the Docker image in the cloud (az acr build — no local Docker needed)
# and runs it on an Azure App Service Linux plan with persistent storage for the
# SQLite database.
#
# PREREQUISITES
#   1. Azure CLI installed:  https://aka.ms/InstallAzureCli
#   2. A subscription:       az account show   (must print one — a bare Entra
#                            tenant is not enough; create a subscription at
#                            https://portal.azure.com → Subscriptions → Add)
#   3. Secrets exported (do NOT hardcode them here):
#        export JWT_KEY="$(openssl rand -base64 48)"     # or any 32+ char string
#        export AZURE_TTS_KEY="<your-azure-speech-key>"  # optional (native audio)
#        export AZURE_TTS_REGION="eastus"                # optional
#
# COST: the B1 Linux plan is ~US$13/month, ACR Basic ~US$5/month. Delete
# everything when done with:
#        az group delete -n "$RG" --yes --no-wait
#
# Re-deploy after code changes: just re-run this script. Resource names are
# derived deterministically, so a re-run updates the existing deployment in
# place — it never creates a second copy.
# ============================================================================
set -euo pipefail

# Helps the CLI print non-ASCII on Windows. Note this does NOT fix the acr
# build log streamer — see the --no-logs comment at the build step below.
export PYTHONIOENCODING=utf-8

# Git Bash (MSYS) rewrites arguments that look like absolute POSIX paths into
# Windows paths, so "DataDir=/home/data" reaches Azure as
# "DataDir=C:/Program Files/Git/home/data". The container then writes SQLite to
# a relative directory inside its own filesystem instead of the persistent
# /home mount, and the database silently vanishes on every restart. Disable it.
export MSYS_NO_PATHCONV=1

# ---- Settings --------------------------------------------------------------
# Every name can be overridden from the environment, e.g.
#   APP=polepole-beta LOCATION=westeurope bash deploy/azure-deploy.sh
RG="${RG:-polepole-rg}"
LOCATION="${LOCATION:-eastus}"   # colocate with your Azure Speech resource
PLAN="${PLAN:-polepole-plan}"
TAG="${TAG:-v1}"
IMAGE="polepole:$TAG"
# ACR and APP are set in the preflight below: they have to be globally unique
# across all of Azure, so they get a stable suffix from your subscription id.
# ---------------------------------------------------------------------------

# ---- Preflight -------------------------------------------------------------
command -v az >/dev/null 2>&1 || {
  echo "ERROR: Azure CLI not found. Install it: https://aka.ms/InstallAzureCli" >&2
  exit 1
}

SUB_ID=$(az account show --query id -o tsv 2>/dev/null) || {
  echo "ERROR: no active Azure subscription. Run 'az login'." >&2
  echo "       If login reports 'no subscriptions found', you have an Entra" >&2
  echo "       tenant but no subscription — create one in the Azure portal." >&2
  exit 1
}

# 8 hex chars off the subscription id: same subscription → same names, every
# run, with no $RANDOM to lose track of.
SUFFIX=$(echo "$SUB_ID" | tr -dc 'a-f0-9' | cut -c1-8)
ACR="${ACR:-polepole$SUFFIX}"          # alphanumeric only, 5–50 chars
APP="${APP:-polepole-app-$SUFFIX}"     # → https://<APP>.azurewebsites.net

echo "==> Subscription: $(az account show --query name -o tsv) ($SUB_ID)"
echo "==> Names: rg=$RG acr=$ACR app=$APP plan=$PLAN"

# A brand-new subscription has no resource providers registered, and the
# implicit registration during 'create' can lose a race and fail mid-script.
for ns in Microsoft.Web Microsoft.ContainerRegistry; do
  if [ "$(az provider show -n "$ns" --query registrationState -o tsv 2>/dev/null)" != "Registered" ]; then
    echo "==> Registering provider $ns (one-time, ~1 min)…"
    az provider register --namespace "$ns" --wait
  fi
done

# Fail early and clearly if the registry name belongs to somebody else, rather
# than halfway through with an Azure stack trace.
if [ "$(az acr check-name -n "$ACR" --query nameAvailable -o tsv)" = "false" ] \
   && ! az acr show -n "$ACR" -g "$RG" -o none 2>/dev/null; then
  echo "ERROR: registry name '$ACR' is already taken by another Azure account." >&2
  echo "       Pick your own and re-run:  ACR=<name> bash deploy/azure-deploy.sh" >&2
  exit 1
fi
# ---------------------------------------------------------------------------

echo "==> Resource group: $RG ($LOCATION)"
az group create -n "$RG" -l "$LOCATION" -o none

echo "==> Container registry: $ACR"
az acr show -n "$ACR" -g "$RG" -o none 2>/dev/null \
  || az acr create -n "$ACR" -g "$RG" --sku Basic --admin-enabled true -o none

# --no-logs is load-bearing, not a preference. The CLI streams build output
# through colorama to the console's cp1252 encoding on Windows and dies with a
# UnicodeEncodeError on the U+2713 that npm/vite print — aborting the deploy
# *after* the cloud build has already succeeded, which leaves a registry with a
# good image and no web app in front of it. PYTHONIOENCODING does not reach it.
# So skip streaming, and fetch the logs only when the build really fails.
echo "==> Building image in the cloud (this uses the Dockerfile at repo root)…"
if ! az acr build -r "$ACR" -t "$IMAGE" . --no-logs -o none; then
  echo "ERROR: image build failed. Logs for the last run:" >&2
  LAST_RUN=$(az acr task list-runs -r "$ACR" --top 1 --query "[0].runId" -o tsv 2>/dev/null || true)
  [ -n "$LAST_RUN" ] && az acr task logs -r "$ACR" --run-id "$LAST_RUN" >&2 2>/dev/null || true
  exit 1
fi

echo "==> App Service plan: $PLAN (Linux B1)"
az appservice plan show -n "$PLAN" -g "$RG" -o none 2>/dev/null \
  || az appservice plan create -n "$PLAN" -g "$RG" --is-linux --sku B1 -o none

echo "==> Web app: $APP"
az webapp show -n "$APP" -g "$RG" -o none 2>/dev/null \
  || az webapp create -n "$APP" -g "$RG" -p "$PLAN" \
       --container-image-name "$ACR.azurecr.io/$IMAGE" -o none

# Wire the web app to pull from the registry (admin creds).
ACR_USER=$(az acr credential show -n "$ACR" --query username -o tsv)
ACR_PASS=$(az acr credential show -n "$ACR" --query "passwords[0].value" -o tsv)
az webapp config container set -n "$APP" -g "$RG" \
  --container-image-name "$ACR.azurecr.io/$IMAGE" \
  --container-registry-url "https://$ACR.azurecr.io" \
  --container-registry-user "$ACR_USER" \
  --container-registry-password "$ACR_PASS" -o none

# JWT key: keep whatever is already deployed — rotating it on every re-deploy
# would invalidate every issued token and sign all users out. Order is
# caller-exported → already deployed → freshly generated.
if [ -z "${JWT_KEY:-}" ]; then
  JWT_KEY=$(az webapp config appsettings list -n "$APP" -g "$RG" \
    --query "[?name=='Jwt__Key'].value | [0]" -o tsv 2>/dev/null || true)
fi
if [ -z "${JWT_KEY:-}" ]; then
  JWT_KEY=$(openssl rand -base64 48 2>/dev/null \
    || echo "change-me-to-a-long-random-string-at-least-32-chars")
  echo "    generated a new Jwt__Key"
else
  echo "    reusing the existing Jwt__Key"
fi

echo "==> App settings (secrets + persistent storage)…"
SETTINGS=(
  "WEBSITES_PORT=8080"
  "WEBSITES_ENABLE_APP_SERVICE_STORAGE=true"   # persists /home (SQLite lives in /home/data)
  "DataDir=/home/data"
  "Jwt__Key=$JWT_KEY"
)
# Only wire up cloud TTS if a key was provided.
if [ -n "${AZURE_TTS_KEY:-}" ]; then
  SETTINGS+=("Tts__Provider=Azure" "Tts__Azure__Key=$AZURE_TTS_KEY" "Tts__Azure__Region=${AZURE_TTS_REGION:-eastus}")
fi
az webapp config appsettings set -n "$APP" -g "$RG" --settings "${SETTINGS[@]}" -o none

echo "==> Restarting…"
az webapp restart -n "$APP" -g "$RG" -o none

URL="https://$APP.azurewebsites.net"
echo ""
echo "============================================================"
echo " Deployed:  $URL"
echo " Health:    $URL/healthz"
echo " (first request may take ~30s while the container starts)"
echo "============================================================"
