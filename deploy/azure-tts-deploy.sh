#!/usr/bin/env bash
# ============================================================================
# PolePole — deploy the Kinyarwanda voice sidecar to Azure Container Apps
# ============================================================================
# Builds tts-service/ in the cloud (az acr build), runs it as its own
# Container App, and points the existing web app at it so the Kinyarwanda
# course gets audio. Swahili and English keep whatever Tts__Provider is set.
#
# Run deploy/azure-deploy.sh FIRST: this script reuses that resource group,
# registry and web app, and derives the same names from the subscription id.
# The web app image must be new enough to know the "Sidecar" TTS provider.
#
#        bash deploy/azure-tts-deploy.sh
#
# AUTH: the sidecar's URL is public, so /synthesize is protected by a shared
# secret (TTS_API_KEY on the sidecar, Tts__Sidecar__ApiKey on the web app).
# The script generates it once and reuses it on every re-run.
#
# COST: MIN_REPLICAS=0 (default) scales to zero after 5 idle minutes and is
# close to free. The price is a slow cold start: a replica has to pull a
# multi-GB image and load the voice (about a minute of loading alone). That is
# acceptable because learners rarely reach the sidecar — the web app
# pre-generates every Kinyarwanda clip at startup and serves them from its
# cache (Tts:Sidecar:Warmup). Only a phrase that is not in the lesson files is
# synthesized on demand. MIN_REPLICAS=1 keeps a 2 vCPU / 4 GiB replica warm
# around the clock instead; check the Container Apps pricing page first.
#
# LICENCE: the voice is Digital Umuganda's KinyarwandaTTS_female_voice,
# CC-BY-SA 4.0 — credit them wherever the app credits its sources.
#
# Remove just the sidecar with:
#        az containerapp delete -n polepole-tts -g polepole-rg --yes
#        az webapp config appsettings delete -n <app> -g polepole-rg \
#          --setting-names Tts__Providers__rw Tts__Sidecar__Url Tts__Sidecar__ApiKey
# ============================================================================
set -euo pipefail

# Same two Windows guards as azure-deploy.sh — see the comments there.
export PYTHONIOENCODING=utf-8
export MSYS_NO_PATHCONV=1

# ---- Settings --------------------------------------------------------------
RG="${RG:-polepole-rg}"
LOCATION="${LOCATION:-eastus}"
CA_ENV="${CA_ENV:-polepole-env}"
TTS_APP="${TTS_APP:-polepole-tts}"
COURSE="${COURSE:-rw}"                    # the course this voice speaks for
CPU="${CPU:-2.0}"
MEMORY="${MEMORY:-4.0Gi}"
MIN_REPLICAS="${MIN_REPLICAS:-0}"
# A fresh tag per deploy: Container Apps only rolls a new revision when the
# image reference changes, so a fixed tag would leave the old code running.
TAG="${TAG:-$(date +%Y%m%d%H%M%S)}"
IMAGE="polepole-tts:$TAG"
# ---------------------------------------------------------------------------

# ---- Preflight -------------------------------------------------------------
command -v az >/dev/null 2>&1 || {
  echo "ERROR: Azure CLI not found. Install it: https://aka.ms/InstallAzureCli" >&2
  exit 1
}
[ -f tts-service/Dockerfile ] || {
  echo "ERROR: run this from the repo root (tts-service/Dockerfile not found)." >&2
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
echo "==> Names: rg=$RG acr=$ACR webapp=$APP env=$CA_ENV tts=$TTS_APP"

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
# on Windows). The build installs PyTorch, downloads the 1.1 GB voice and
# synthesizes a test phrase, so allow ten minutes or more.
echo "==> Building $IMAGE in the cloud (the voice is baked in; takes ten minutes or more)…"
if ! az acr build -r "$ACR" -t "$IMAGE" tts-service --timeout 3600 --no-logs -o none; then
  echo "ERROR: image build failed. Logs for the last run:" >&2
  LAST_RUN=$(az acr task list-runs -r "$ACR" --top 1 --query "[0].runId" -o tsv 2>/dev/null || true)
  [ -n "$LAST_RUN" ] && az acr task logs -r "$ACR" --run-id "$LAST_RUN" >&2 2>/dev/null || true
  exit 1
fi

# Shared secret: caller-exported → already deployed → freshly generated. Hex,
# so it is safe in a header and on a command line.
if [ -z "${TTS_API_KEY:-}" ]; then
  TTS_API_KEY=$(az webapp config appsettings list -n "$APP" -g "$RG" \
    --query "[?name=='Tts__Sidecar__ApiKey'].value | [0]" -o tsv 2>/dev/null || true)
fi
if [ -z "${TTS_API_KEY:-}" ]; then
  TTS_API_KEY=$(openssl rand -hex 32)
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

echo "==> Container app: $TTS_APP ($CPU vCPU, $MEMORY, min replicas $MIN_REPLICAS)"
if az containerapp show -n "$TTS_APP" -g "$RG" -o none 2>/dev/null; then
  az containerapp secret set -n "$TTS_APP" -g "$RG" \
    --secrets "tts-api-key=$TTS_API_KEY" -o none
  az containerapp registry set -n "$TTS_APP" -g "$RG" \
    --server "$ACR.azurecr.io" --username "$ACR_USER" --password "$ACR_PASS" -o none
  az containerapp update -n "$TTS_APP" -g "$RG" \
    --image "$ACR.azurecr.io/$IMAGE" \
    --cpu "$CPU" --memory "$MEMORY" \
    --min-replicas "$MIN_REPLICAS" --max-replicas 1 \
    --set-env-vars "TTS_API_KEY=secretref:tts-api-key" -o none
else
  az containerapp create -n "$TTS_APP" -g "$RG" --environment "$CA_ENV" \
    --image "$ACR.azurecr.io/$IMAGE" \
    --registry-server "$ACR.azurecr.io" \
    --registry-username "$ACR_USER" --registry-password "$ACR_PASS" \
    --ingress external --target-port 8082 \
    --cpu "$CPU" --memory "$MEMORY" \
    --min-replicas "$MIN_REPLICAS" --max-replicas 1 \
    --secrets "tts-api-key=$TTS_API_KEY" \
    --env-vars "TTS_API_KEY=secretref:tts-api-key" -o none
fi

FQDN=$(az containerapp show -n "$TTS_APP" -g "$RG" \
  --query properties.configuration.ingress.fqdn -o tsv)
TTS_URL="https://$FQDN"

# Don't point the web app at a sidecar that is not answering: wait for /health
# to report that the voice loaded AND that auth is on. The first boot pulls a
# large image, so be patient.
echo "==> Waiting for $TTS_URL/health …"
HEALTH=""
for _ in $(seq 1 60); do
  HEALTH=$(curl -fsS --max-time 10 "$TTS_URL/health" 2>/dev/null || true)
  case "$HEALTH" in *'"ok":true'*) break ;; esac
  HEALTH=""
  sleep 10
done
if [ -z "$HEALTH" ]; then
  echo "ERROR: the sidecar did not become healthy within 10 minutes. Inspect it with:" >&2
  echo "       az containerapp logs show -n $TTS_APP -g $RG --tail 100" >&2
  echo "       The web app was NOT changed." >&2
  exit 1
fi
echo "    $HEALTH"
case "$HEALTH" in
  *'"auth":true'*) ;;
  *) echo "ERROR: the sidecar is up but reports auth is OFF — refusing to wire it up." >&2
     exit 1 ;;
esac

# One real phrase through the deployed service, with the key, before any
# learner depends on it.
echo "==> Synthesizing a test phrase…"
BYTES=$(curl -fsS --max-time 120 -o /dev/null -w '%{size_download}' \
  -H "X-Api-Key: $TTS_API_KEY" -H "Content-Type: application/json" \
  -d '{"text":"Mwaramutse","rate":0.85}' "$TTS_URL/synthesize" || echo 0)
if [ "${BYTES:-0}" -lt 10000 ]; then
  echo "ERROR: /synthesize returned $BYTES bytes — expected a WAV clip. The web app was NOT changed." >&2
  exit 1
fi
echo "    got $BYTES bytes of audio"

# Setting app settings restarts the web app by itself; on that restart it
# pre-generates the course's clips through the sidecar.
echo "==> Pointing the web app's '$COURSE' course at the sidecar…"
az webapp config appsettings set -n "$APP" -g "$RG" --settings \
  "Tts__Providers__$COURSE=Sidecar" \
  "Tts__Sidecar__Url=$TTS_URL" \
  "Tts__Sidecar__ApiKey=$TTS_API_KEY" -o none

echo ""
echo "============================================================"
echo " Sidecar:   $TTS_URL/health"
echo " Web app:   https://$APP.azurewebsites.net/api/tts/status?course=$COURSE"
echo "            → {\"enabled\":true} once the web app has restarted (~1 min)"
echo " Try it:    https://$APP.azurewebsites.net/api/tts?text=amazi&course=$COURSE"
echo " Logs:      az containerapp logs show -n $TTS_APP -g $RG --follow"
echo "============================================================"
