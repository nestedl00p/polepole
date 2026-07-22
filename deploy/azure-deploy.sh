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
#   2. Logged in:            az login
#   3. Secrets exported (do NOT hardcode them here):
#        export JWT_KEY="$(openssl rand -base64 48)"     # or any 32+ char string
#        export AZURE_TTS_KEY="<your-azure-speech-key>"  # optional (native audio)
#        export AZURE_TTS_REGION="eastus"                # optional
#
# COST: the B1 Linux plan is ~US$13/month. Delete everything when done with:
#        az group delete -n "$RG" --yes --no-wait
#
# Re-deploy after code changes: just re-run this script (it rebuilds & restarts).
# ============================================================================
set -euo pipefail

# ---- Settings (edit these) -------------------------------------------------
RG="polepole-rg"                 # resource group
LOCATION="eastus"                # colocate with your Azure Speech resource
ACR="polepole$RANDOM"            # registry name must be globally unique, alnum only
APP="polepole-app-$RANDOM"       # web app name → https://<APP>.azurewebsites.net
PLAN="polepole-plan"
TAG="v1"
IMAGE="polepole:$TAG"
# ---------------------------------------------------------------------------

# JWT key is required — generate one if the caller didn't export it.
JWT_KEY="${JWT_KEY:-$(openssl rand -base64 48 2>/dev/null || echo "change-me-to-a-long-random-string-at-least-32-chars")}"

echo "==> Resource group: $RG ($LOCATION)"
az group create -n "$RG" -l "$LOCATION" -o none

echo "==> Container registry: $ACR"
az acr create -n "$ACR" -g "$RG" --sku Basic --admin-enabled true -o none

echo "==> Building image in the cloud (this uses the Dockerfile at repo root)…"
az acr build -r "$ACR" -t "$IMAGE" . -o none

echo "==> App Service plan: $PLAN (Linux B1)"
az appservice plan create -n "$PLAN" -g "$RG" --is-linux --sku B1 -o none

echo "==> Web app: $APP"
az webapp create -n "$APP" -g "$RG" -p "$PLAN" \
  --container-image-name "$ACR.azurecr.io/$IMAGE" -o none

# Wire the web app to pull from the registry (admin creds).
ACR_USER=$(az acr credential show -n "$ACR" --query username -o tsv)
ACR_PASS=$(az acr credential show -n "$ACR" --query "passwords[0].value" -o tsv)
az webapp config container set -n "$APP" -g "$RG" \
  --container-image-name "$ACR.azurecr.io/$IMAGE" \
  --container-registry-url "https://$ACR.azurecr.io" \
  --container-registry-user "$ACR_USER" \
  --container-registry-password "$ACR_PASS" -o none

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
