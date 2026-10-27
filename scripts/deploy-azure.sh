#!/usr/bin/env bash
# Deploys the service to Azure App Service (Linux, Node) using the az CLI.
# Idempotent: reuses the plan and web app if they already exist.
# The OpenAI key is never stored in the repo: export OPENAI_API_KEY before running to set it.
set -euo pipefail

RG="${RG:-AgenticPlatform}"
LOCATION="${LOCATION:-eastus2}"
PLAN="${PLAN:-asp-onboarding-agent}"
APP="${APP:-onboarding-agent-pichincha}"
SKU="${SKU:-F1}"
RUNTIME="${RUNTIME:-NODE:24-lts}"
ORCHESTRATOR_MODEL="${ORCHESTRATOR_MODEL:-gpt-6.1-terra}"
SUBAGENT_MODEL="${SUBAGENT_MODEL:-gpt-6-luna}"

echo "Subscription: $(az account show --query name -o tsv)"

if ! az appservice plan show -g "$RG" -n "$PLAN" >/dev/null 2>&1; then
  az appservice plan create -g "$RG" -n "$PLAN" -l "$LOCATION" --is-linux --sku "$SKU" -o none
fi

if ! az webapp show -g "$RG" -n "$APP" >/dev/null 2>&1; then
  az webapp create -g "$RG" -p "$PLAN" -n "$APP" --runtime "$RUNTIME" -o none
fi

# Oryx installs dependencies and runs `npm run build` on the server.
az webapp config appsettings set -g "$RG" -n "$APP" -o none --settings \
  SCM_DO_BUILD_DURING_DEPLOYMENT=true \
  ORCHESTRATOR_MODEL="$ORCHESTRATOR_MODEL" \
  SUBAGENT_MODEL="$SUBAGENT_MODEL"

if [[ -n "${OPENAI_API_KEY:-}" ]]; then
  az webapp config appsettings set -g "$RG" -n "$APP" -o none --settings OPENAI_API_KEY="$OPENAI_API_KEY"
fi

az webapp config set -g "$RG" -n "$APP" --startup-file "npm start" -o none

# Ship only committed files, so local .env, node_modules and dist never leave the machine.
PKG="$(mktemp -d)/app.zip"
git archive --format=zip -o "$PKG" HEAD
az webapp deploy -g "$RG" -n "$APP" --src-path "$PKG" --type zip -o none

echo "Deployed: https://$(az webapp show -g "$RG" -n "$APP" --query defaultHostName -o tsv)"
