#!/usr/bin/env bash
# =============================================================================
# PushIT frontend — Seed AWS SSM Parameter Store from a local .env file.
#
#   bash deploy/seed-parameter-store.sh ./prod.env
#
# Source de vérité de la config front prod = SSM (/pushit-frontend/prod/*,
# eu-west-1). La config front est PUBLIQUE -> tout est poussé en String (pas de
# SecureString, pas de SECRET_KEYS). Requiert des creds AWS avec
# ssm:PutParameter (ton user IAM/SSO), PAS le rôle d'instance. Idempotent
# (--overwrite).
#
# Après seed, appliquer (cf. CLAUDE.md) :
#   sudo systemctl restart pushit-frontend-runtime-fetch    # relit SSM + reload nginx
#   # ...ou déclencher un déploiement (la CI re-fetch automatiquement).
# =============================================================================
set -euo pipefail

ENV_FILE="${1:?Usage: $0 <path-to-.env>}"
SSM_PREFIX="/pushit-frontend/prod"
AWS_REGION="eu-west-1"

[ -f "$ENV_FILE" ] || { echo "No such file: $ENV_FILE" >&2; exit 1; }

while IFS= read -r line || [ -n "$line" ]; do
    [[ -z "${line//[[:space:]]/}" ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" != *=* ]] && continue

    key="${line%%=*}"
    value="${line#*=}"
    key="${key//[[:space:]]/}"
    [[ -z "$key" ]] && continue

    echo "  put $SSM_PREFIX/$key  (String)"
    aws ssm put-parameter \
        --name "$SSM_PREFIX/$key" \
        --value "$value" \
        --type "String" \
        --overwrite \
        --region "$AWS_REGION" \
        >/dev/null
done < "$ENV_FILE"

echo "Done. Seeded $SSM_PREFIX/* in $AWS_REGION."
echo "Apply on the server:"
echo "  sudo systemctl restart pushit-frontend-runtime-fetch"
echo "  (or trigger a deploy — CI re-fetches automatically)"
