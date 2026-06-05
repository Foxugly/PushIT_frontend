#!/usr/bin/env bash
# =============================================================================
# PushIT frontend — first-time server setup for the shared EC2.
#
# Installs the git clone + nginx vhost (wildcard TLS, no certbot) + the oneshot
# unit that fetches the runtime config from SSM. The SPA bundle itself is NOT
# built here — the first GitHub Actions deploy (OIDC → SSM + S3) uploads it to
# S3 and the SSM step unpacks it into dist/pushit-frontend/browser.
#
# Deploy model is OIDC → SSM + S3 (no long-lived SSH key, no sudoers): the CI
# assumes a per-repo OIDC role and drives the box via `aws ssm send-command`
# (root), which installs the unit / fetch-script / vhost from the COMMITTED git
# blob and pulls the bundle from S3 via the instance role. See OPERATIONS.md
# §3.11 + CLAUDE.md. This script only bootstraps the box for that first deploy.
#
# Run as 'ubuntu' (needs sudo), AFTER:
#   - DNS A record  pushit.foxugly.com → EC2 public IP
#   - SSM /pushit-frontend/prod/* seeded (deploy/seed-parameter-store.sh)
#   - instance role foxugly-fleet-ec2 granted ssm:GetParametersByPath on BOTH
#     /pushit-frontend/prod and /pushit-frontend/prod/* (no kms: config is
#     public String) + s3:GetObject on the deploy bucket builds/pushit-frontend/*
#
#   bash /var/www/django_websites/PushIT_frontend/deploy/setup-server.sh
# Idempotent.
# =============================================================================
set -euo pipefail

APP_DIR="/var/www/django_websites/PushIT_frontend"
DOC_DIR="$APP_DIR/dist/pushit-frontend/browser"
REPO="https://github.com/Foxugly/PushIT_frontend.git"
APP_USER="django"
APP_GROUP="www-data"

echo "=== 1/6 Packages (nginx, git, awscli) ==="
MISSING=()
for pkg in nginx git awscli; do dpkg -l "$pkg" &>/dev/null || MISSING+=("$pkg"); done
[ ${#MISSING[@]} -gt 0 ] && { sudo apt update; sudo apt install -y "${MISSING[@]}"; } || echo "packages OK"

echo "=== 2/6 App dir + clone ==="
sudo mkdir -p "$APP_DIR"
sudo chown "$APP_USER:$APP_GROUP" "$APP_DIR"
# Existence test as ROOT (sudo test): the unprivileged shell can't traverse the
# 750 django tree, so a plain [ -d .git ] would mis-report and re-clone.
if sudo test -d "$APP_DIR/.git"; then
    sudo -u "$APP_USER" git -C "$APP_DIR" fetch origin main
    sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard origin/main
else
    sudo -u "$APP_USER" git clone "$REPO" "$APP_DIR"
fi
sudo -u "$APP_USER" mkdir -p "$DOC_DIR"   # empty until the first bundle deploy

echo "=== 3/6 Install root-only runtime-fetch script + unit (§3.10) ==="
sudo install -o root -g root -m 0755 "$APP_DIR/deploy/fetch-frontend-runtime-from-ssm.sh" /usr/local/sbin/pushit-frontend-runtime-fetch.sh
sudo install -o root -g root -m 0644 "$APP_DIR/deploy/systemd/pushit-frontend-runtime-fetch.service" /etc/systemd/system/pushit-frontend-runtime-fetch.service
sudo systemctl daemon-reload

echo "=== 4/6 nginx vhost (wildcard TLS) ==="
# Retire un éventuel ancien vhost pushit.foxugly.com (reste d'un certbot --nginx)
# qui revendiquerait le même server_name. Notre fichier s'appelle
# pushit-frontend.conf, donc ceci ne le supprime jamais.
sudo rm -f /etc/nginx/sites-enabled/pushit.foxugly.com /etc/nginx/sites-available/pushit.foxugly.com
sudo install -o root -g root -m 0644 "$APP_DIR/deploy/nginx/pushit-frontend.conf" /etc/nginx/sites-available/pushit-frontend.conf
sudo ln -sf /etc/nginx/sites-available/pushit-frontend.conf /etc/nginx/sites-enabled/pushit-frontend.conf
sudo nginx -t
sudo systemctl reload nginx

echo "=== 5/6 Fetch runtime config from SSM (writes nginx snippet) ==="
sudo systemctl enable pushit-frontend-runtime-fetch
if ! sudo systemctl start pushit-frontend-runtime-fetch; then
    echo "ERROR: pushit-frontend-runtime-fetch failed — is /pushit-frontend/prod seeded and" >&2
    echo "       the instance role allowed to read it? journalctl -u pushit-frontend-runtime-fetch" >&2
    exit 1
fi

echo "=== 6/6 Normalise perms ==="
sudo chown -R "$APP_USER:$APP_GROUP" "$APP_DIR"
sudo chmod -R g-w,o-rwx "$APP_DIR"

echo ""
echo "=== Setup complete ==="
echo "  Site:  https://pushit.foxugly.com  (404 until the first GitHub deploy ships a bundle)"
echo "  Next:  CORS backend (PushIT_server): CORS_ALLOWED_ORIGINS += https://pushit.foxugly.com"
echo "         Trigger the deploy: https://github.com/Foxugly/PushIT_frontend/actions"
echo "  Logs:  journalctl -u pushit-frontend-runtime-fetch"
echo "         tail -f /var/log/nginx/pushit-frontend-error.log"
