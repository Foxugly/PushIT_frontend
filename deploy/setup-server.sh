#!/usr/bin/env bash
# =============================================================================
# PushIT frontend — Server setup (one-time) for the shared EC2.
#
# Cohabite avec PushIT_server + QuizOnline (nginx, rôle d'instance quizonline-ec2).
# Convertit l'ancien dossier d'artefacts en clone git (Option A), installe le
# vhost nginx + TLS, et l'unité oneshot qui fetch la config runtime depuis SSM.
#
# Prérequis AVANT de lancer :
#   1. DNS A : pushit.foxugly.com -> IP publique EC2
#   2. SSM seedé : bash deploy/seed-parameter-store.sh ./prod.env  (ou .ps1)
#   3. Rôle quizonline-ec2 autorisé ssm:GetParametersByPath sur les DEUX ARNs :
#        arn:aws:ssm:eu-west-1:362629935151:parameter/pushit-frontend/prod
#        arn:aws:ssm:eu-west-1:362629935151:parameter/pushit-frontend/prod/*
#      (pas de kms:Decrypt : config en String public)
#
# Usage (en tant que user sudo, ex. ubuntu) :
#   sudo bash deploy/setup-server.sh <DEPLOY_USER>
#
# où DEPLOY_USER est le user SSH qui recevra les déploiements (= secret GitHub
# EC2_USER). Il obtiendra le droit NOPASSWD de lancer deploy/deploy.sh en root.
#
# Idempotent.
# =============================================================================
set -euo pipefail

DOMAIN="pushit.foxugly.com"
APP_DIR="/var/www/django_websites/PushIT_frontend"
ARTIFACT_DIR="$APP_DIR/dist/pushit-frontend/browser"
REPO="https://github.com/Foxugly/PushIT_frontend.git"
APP_OWNER="django"
APP_GROUP="www-data"
CERTBOT_EMAIL="rvilain@foxugly.com"

if [ "$(id -u)" -ne 0 ]; then
    echo "ERREUR : lancer en root (sudo)." >&2
    exit 1
fi

DEPLOY_USER="${1:-}"
if [ -z "$DEPLOY_USER" ]; then
    echo "Usage : sudo $0 <DEPLOY_USER>   (ex: sudo $0 ubuntu)" >&2
    exit 1
fi
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
    echo "ERREUR : user '$DEPLOY_USER' inexistant." >&2
    exit 1
fi

echo "=== Setup frontend ${DOMAIN} (deploy user: ${DEPLOY_USER}) ==="

# ─── 1/6 Packages ────────────────────────────────────────────────────────────
echo "[1/6] Packages (nginx, certbot, git, awscli)"
MISSING=()
for pkg in nginx certbot python3-certbot-nginx git awscli; do
    dpkg -l "$pkg" >/dev/null 2>&1 || MISSING+=("$pkg")
done
if [ ${#MISSING[@]} -gt 0 ]; then
    apt update && apt install -y "${MISSING[@]}"
fi
echo "    OK"

# ─── 2/6 Clone git en place (Option A) ───────────────────────────────────────
echo "[2/6] Repo clone in $APP_DIR"
mkdir -p "$APP_DIR"
chown "${APP_OWNER}:${APP_GROUP}" "$APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
    echo "    déjà un clone, git reset"
    sudo -u "$APP_OWNER" git -C "$APP_DIR" fetch origin main
    sudo -u "$APP_OWNER" git -C "$APP_DIR" reset --hard origin/main
else
    # Conversion in-place du dossier d'artefacts existant en clone, sans rien
    # déplacer (artefacts reproductibles ; dist/ est gitignoré). Ne touche PAS
    # au dossier voisin old/.
    sudo -u "$APP_OWNER" git -C "$APP_DIR" init -q
    sudo -u "$APP_OWNER" git -C "$APP_DIR" remote add origin "$REPO"
    sudo -u "$APP_OWNER" git -C "$APP_DIR" fetch origin main
    sudo -u "$APP_OWNER" git -C "$APP_DIR" reset --hard origin/main
    sudo -u "$APP_OWNER" git -C "$APP_DIR" clean -fd
fi
sudo -u "$APP_OWNER" mkdir -p "$ARTIFACT_DIR"
echo "    OK"

# ─── 3/6 Unité systemd de fetch ──────────────────────────────────────────────
echo "[3/6] systemd unit pushit-frontend-runtime-fetch"
cp "$APP_DIR/deploy/systemd/pushit-frontend-runtime-fetch.service" /etc/systemd/system/
systemctl daemon-reload
echo "    OK"

# ─── 4/6 Vhost nginx + premier fetch + certbot ───────────────────────────────
echo "[4/6] nginx vhost + TLS"
cp "$APP_DIR/deploy/nginx/pushit-frontend.conf" /etc/nginx/sites-available/pushit-frontend.conf
ln -sf /etc/nginx/sites-available/pushit-frontend.conf /etc/nginx/sites-enabled/pushit-frontend.conf
# Premier fetch : écrit le snippet, valide la conf (HTTP-only à ce stade) et
# recharge nginx. Échoue si SSM non seedé / rôle non autorisé.
systemctl enable pushit-frontend-runtime-fetch
if ! systemctl start pushit-frontend-runtime-fetch; then
    echo "ERREUR : fetch SSM échoué — SSM /pushit-frontend/prod seedé ? rôle autorisé ?" >&2
    echo "         journalctl -u pushit-frontend-runtime-fetch" >&2
    exit 1
fi
nginx -t
systemctl reload nginx
# certbot ajoute le bloc 443 + la redirection HTTP->HTTPS au vhost.
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$CERTBOT_EMAIL"
echo "    OK"

# ─── 5/6 Sudoers pour le déploiement ─────────────────────────────────────────
echo "[5/6] sudoers pour ${DEPLOY_USER}"
# Modèle : la CI lance `sudo deploy.sh` ; tout le script tourne en root, donc
# une seule règle suffit (les `sudo -u django` / `sudo systemctl` internes ne
# requièrent alors aucun mot de passe).
SUDOERS_FILE="/etc/sudoers.d/pushit-frontend-deploy"
cat > "$SUDOERS_FILE" <<EOF
${DEPLOY_USER} ALL=(root) NOPASSWD: ${APP_DIR}/deploy/deploy.sh
EOF
chmod 440 "$SUDOERS_FILE"
visudo -c -f "$SUDOERS_FILE" >/dev/null
echo "    OK"

# ─── 6/6 Smoke test ──────────────────────────────────────────────────────────
echo "[6/6] Smoke test HTTPS"
if curl --fail --silent --show-error --max-time 30 -I "https://${DOMAIN}" >/dev/null; then
    echo "    https://${DOMAIN} répond"
else
    echo "    pas encore de réponse (normal avant le 1er déploiement de contenu)"
fi

echo ""
echo "=== Setup terminé ==="
echo "Il reste :"
echo "  - Secrets GitHub : EC2_HOST, EC2_USER (= '${DEPLOY_USER}'), EC2_SSH_KEY"
echo "  - Clé publique de EC2_SSH_KEY dans ~${DEPLOY_USER}/.ssh/authorized_keys"
echo "  - CORS backend : CORS_ALLOWED_ORIGINS += https://${DOMAIN} (repo PushIT_server)"
echo "  - Déclencher le workflow : https://github.com/Foxugly/PushIT_frontend/actions"
