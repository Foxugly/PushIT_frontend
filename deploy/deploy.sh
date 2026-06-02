#!/usr/bin/env bash
# =============================================================================
# PushIT frontend — Deploy script (promotion côté serveur).
#
# Appelé par GitHub Actions en SSH (en tant que user de deploy), après que la CI
# a rsync les artefacts buildés dans /tmp/pushit-frontend-staging/.
#
#   /var/www/django_websites/PushIT_frontend/deploy/deploy.sh
#
# 1. met à jour les scripts deploy/ versionnés (git reset) ;
# 2. promeut les artefacts SPA dans dist/pushit-frontend/browser/ ;
# 3. re-fetch la config runtime (rotation SSM appliquée à chaque deploy).
# =============================================================================
set -euo pipefail

APP_DIR="/var/www/django_websites/PushIT_frontend"
ARTIFACT_DIR="$APP_DIR/dist/pushit-frontend/browser"
STAGING_DIR="/tmp/pushit-frontend-staging"

cd "$APP_DIR"

echo ">>> Updating deploy scripts (git)..."
# Met à jour deploy/ etc. ; dist/ est gitignoré donc les artefacts ne sont pas
# touchés par le reset.
sudo -u django git fetch origin main
sudo -u django git reset --hard origin/main

echo ">>> Promoting SPA artifacts..."
mkdir -p "$ARTIFACT_DIR"
sudo -u django /usr/bin/rsync -a --delete "$STAGING_DIR/" "$ARTIFACT_DIR/"
sudo /bin/chown -R django:www-data "$ARTIFACT_DIR/"
sudo /bin/chmod -R g+rX "$ARTIFACT_DIR/"
rm -rf "$STAGING_DIR"

echo ">>> Re-fetching runtime config from SSM (applies SSM rotations)..."
sudo /bin/systemctl restart pushit-frontend-runtime-fetch

echo ">>> Deploy complete."
