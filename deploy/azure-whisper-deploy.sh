#!/usr/bin/env bash
# ============================================================================
# PolePole — deploy the Whisper sidecar to Azure Container Apps
# ============================================================================
# Builds whisper-service/ in the cloud (az acr build), runs it as its own
# Container App, and points the existing web app at it so the speak-and-check
# pronunciation drill gets its microphone.
#
# Run deploy/azure-deploy.sh FIRST: this script reuses that resource group,
# registry and web app, and derives the same names from the subscription id.
#
#        bash deploy/azure-whisper-deploy.sh
#
# AUTH: the sidecar's URL is public, so /transcribe is protected by a shared
# secret (WHISPER_API_KEY on the sidecar, Speech__ApiKey on the web app). The
# script generates it once and reuses it on every re-run. The web app image
# must be new enough to send it — redeploy the web app (azure-deploy.sh) from a
# commit that has Speech:ApiKey support, or every transcription gets a 401 and
# the drill silently stays listen-only.
#
# COST: MIN_REPLICAS=0 (default) scales to zero after 5 idle minutes and is
# close to free at low traffic. The price is a cold start of ~25 s while a
# replica boots and loads the model. The backend softens it two ways: it pings
# the sidecar when a drill opens (GET /api/speech/status), so the boot usually
# overlaps with the learner listening, and it waits up to Speech:TimeoutSeconds
# (default 90) for a transcription. MIN_REPLICAS=1 keeps one 1 vCPU / 2 GiB
# replica warm around the clock instead — roughly US$20–25/month at idle
# rates; check the Container Apps pricing page for your region.
#
# Remove just the sidecar with:
#        az containerapp delete -n polepole-whisper -g polepole-rg --yes
#        az containerapp env delete -n polepole-env -g polepole-rg --yes
#        az webapp config appsettings set -n <app> -g polepole-rg --settings Speech__Enabled=false
# ============================================================================
set -euo pipefail

# Same two Windows guards as azure-deploy.sh — see the comments there.
export PYTHONIOENCODING=utf-8
export MSYS_NO_PATHCONV=1

# ---- Settings --------------------------------------------------------------
RG="${RG:-polepole-rg}"
LOCATION="${LOCATION:-eastus}"
CA_ENV="${CA_ENV:-polepole-env}"
WHISPER_APP="${WHISPER_APP:-polepole-whisper}"
WHISPER_MODEL="${WHISPER_MODEL:-small}"   # baked into the image at build time
CPU="${CPU:-1.0}"
MEMORY="${MEMORY:-2.0Gi}"
MIN_REPLICAS="${MIN_REPLICAS:-0}"
# A fresh tag per deploy: Container Apps only rolls a new revision when the
# image reference changes, so a fixed tag would leave the old code running.
TAG="${TAG:-$(date +%Y%m%d%H%M%S)}"
IMAGE="polepole-whisper:$TAG"
# ---------------------------------------------------------------------------

# ---- Preflight -------------------------------------------------------------
command -v az >/dev/null 2>&1 || {
  echo "ERROR: Azure CLI not found. Install it: https://aka.ms/InstallAzureCli" >&2
  exit 1
}
[ -f whisper-service/Dockerfile ] || {
  echo "ERROR: run this from the repo root (whisper-service/Dockerfile not found)." >&2
  exit 1
}

SUB_ID=$(az account show --query id -o tsv 2>/dev/null) || {
  echo "ERROR: no active Azure subscription. Run 'az login'." >&2
  exit 1
}
SUFFIX=$(echo "$SUB_ID" | tr -dc 'a-f0-9' | cut -c1-8)
ACR="${ACR:-polepole$SUFFIX}"
APP="${APP:-polepole-app-$SUFFIX}"

echo "==> Subscription: $(az account show --query name -o tsv) ($SUB_ID)"
echo "==> Names: rg=$RG acr=$ACR webapp=$APP env=$CA_ENV whisper=$WHISPER_APP"

az acr show -n "$ACR" -g "$RG" -o none 2>/dev/null || {
  echo "ERROR: registry '$ACR' not found in '$RG'. Run deploy/azure-deploy.sh first." >&2
  exit 1
}
az webapp show -n "$APP" -g "$RG" -o none 2>/dev/null || {
  echo "ERROR: web app '$APP' not found in '$RG'. Run deploy/azure-deploy.sh first." >&2
  exit 1
}

# `az containerapp` lives in an extension, not the core CLI.
az extension show -n containerapp -o none 2>/dev/null \
  || az extension add -n containerapp --only-show-errors

for ns in Microsoft.App Microsoft.OperationalInsights; do
  if [ "$(az provider show -n "$ns" --query registrationState -o tsv 2>/dev/null)" != "Registered" ]; then
    echo "==> Registering provider $ns (one-time, ~1 min)…"
    az provider register --namespace "$ns" --wait
  fi
done
# ---------------------------------------------------------------------------

# --no-logs for the same reason as azure-deploy.sh (cp1252 log streamer crash
# on Windows). The build downloads the model, so it takes a few minutes.
echo "==> Building $IMAGE in the cloud (model '$WHISPER_MODEL' is baked in; takes a few minutes)…"
if ! az acr build -r "$ACR" -t "$IMAGE" --build-arg "WHISPER_MODEL=$WHISPER_MODEL" \
       whisper-service --no-logs -o none; then
  echo "ERROR: image build failed. Logs for the last run:" >&2
  LAST_RUN=$(az acr task list-runs -r "$ACR" --top 1 --query "[0].runId" -o tsv 2>/dev/null || true)
  [ -n "$LAST_RUN" ] && az acr task logs -r "$ACR" --run-id "$LAST_RUN" >&2 2>/dev/null || true
  exit 1
fi

# Shared secret: caller-exported → already deployed → freshly generated. Hex,
# so it is safe in a header and on a command line.
if [ -z "${WHISPER_API_KEY:-}" ]; then
  WHISPER_API_KEY=$(az webapp config appsettings list -n "$APP" -g "$RG" \
    --query "[?name=='Speech__ApiKey'].value | [0]" -o tsv 2>/dev/null || true)
fi
if [ -z "${WHISPER_API_KEY:-}" ]; then
  WHISPER_API_KEY=$(openssl rand -hex 32)
  echo "    generated a new sidecar API key"
else
  echo "    reusing the existing sidecar API key"
fi

echo "==> Container Apps environment: $CA_ENV"
# No Log Analytics workspace: it bills per GB ingested and is not needed to
# read logs — `az containerapp logs show` streams them straight from the app.
az containerapp env show -n "$CA_ENV" -g "$RG" -o none 2>/dev/null \
  || az containerapp env create -n "$CA_ENV" -g "$RG" -l "$LOCATION" \
       --logs-destination none -o none

ACR_USER=$(az acr credential show -n "$ACR" --query username -o tsv)
ACR_PASS=$(az acr credential show -n "$ACR" --query "passwords[0].value" -o tsv)

echo "==> Container app: $WHISPER_APP ($CPU vCPU, $MEMORY, min replicas $MIN_REPLICAS)"
if az containerapp show -n "$WHISPER_APP" -g "$RG" -o none 2>/dev/null; then
  az containerapp secret set -n "$WHISPER_APP" -g "$RG" \
    --secrets "whisper-api-key=$WHISPER_API_KEY" -o none
  az containerapp registry set -n "$WHISPER_APP" -g "$RG" \
    --server "$ACR.azurecr.io" --username "$ACR_USER" --password "$ACR_PASS" -o none
  az containerapp update -n "$WHISPER_APP" -g "$RG" \
    --image "$ACR.azurecr.io/$IMAGE" \
    --cpu "$CPU" --memory "$MEMORY" \
    --min-replicas "$MIN_REPLICAS" --max-replicas 1 \
    --set-env-vars "WHISPER_API_KEY=secretref:whisper-api-key" -o none
else
  az containerapp create -n "$WHISPER_APP" -g "$RG" --environment "$CA_ENV" \
    --image "$ACR.azurecr.io/$IMAGE" \
    --registry-server "$ACR.azurecr.io" \
    --registry-username "$ACR_USER" --registry-password "$ACR_PASS" \
    --ingress external --target-port 8081 \
    --cpu "$CPU" --memory "$MEMORY" \
    --min-replicas "$MIN_REPLICAS" --max-replicas 1 \
    --secrets "whisper-api-key=$WHISPER_API_KEY" \
    --env-vars "WHISPER_API_KEY=secretref:whisper-api-key" -o none
fi

FQDN=$(az containerapp show -n "$WHISPER_APP" -g "$RG" \
  --query properties.configuration.ingress.fqdn -o tsv)
WHISPER_URL="https://$FQDN"

# Don't point the web app at a sidecar that is not answering: wait for /health
# to report that the model loaded AND that auth is on.
echo "==> Waiting for $WHISPER_URL/health …"
HEALTH=""
for _ in $(seq 1 36); do
  HEALTH=$(curl -fsS --max-time 10 "$WHISPER_URL/health" 2>/dev/null || true)
  case "$HEALTH" in *'"ok":true'*) break ;; esac
  HEALTH=""
  sleep 10
done
if [ -z "$HEALTH" ]; then
  echo "ERROR: the sidecar did not become healthy within 6 minutes. Inspect it with:" >&2
  echo "       az containerapp logs show -n $WHISPER_APP -g $RG --tail 100" >&2
  echo "       The web app was NOT changed." >&2
  exit 1
fi
echo "    $HEALTH"
case "$HEALTH" in
  *'"auth":true'*) ;;
  *) echo "ERROR: the sidecar is up but reports auth is OFF — refusing to wire it up." >&2
     exit 1 ;;
esac

# Setting app settings restarts the web app by itself.
echo "==> Pointing the web app at the sidecar…"
az webapp config appsettings set -n "$APP" -g "$RG" --settings \
  "Speech__Enabled=true" \
  "Speech__WhisperUrl=$WHISPER_URL" \
  "Speech__ApiKey=$WHISPER_API_KEY" -o none

echo ""
echo "============================================================"
echo " Sidecar:   $WHISPER_URL/health"
echo " Web app:   https://$APP.azurewebsites.net/api/speech/status"
echo "            → {\"enabled\":true} once the web app has restarted (~1 min)"
echo " Logs:      az containerapp logs show -n $WHISPER_APP -g $RG --follow"
echo "============================================================"
