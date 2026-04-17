#!/usr/bin/env bash
#
# Setup one-shot du serveur pour le déploiement du frontend PushIT.
# À exécuter UNE SEULE FOIS en root sur l'EC2 après avoir scp'é le dossier
# deploy/ sur le serveur.
#
# Usage (depuis le dossier deploy/ sur le serveur) :
#   sudo ./setup-server.sh <DEPLOY_USER>
#
# où DEPLOY_USER est le user SSH qui recevra les déploiements
# (typiquement la valeur du secret GitHub EC2_USER, ex: ubuntu).
#
# Idempotent : peut être relancé sans danger.

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────
DOMAIN="pushit.foxugly.com"
TARGET_DIR="/var/www/django_websites/PushIT_frontend"
APP_OWNER="django"
APP_GROUP="www-data"
CERTBOT_EMAIL="rvilain@foxugly.com"

# ─── Vérifications préalables ────────────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
    echo "ERREUR : ce script doit être lancé en root (utilise sudo)." >&2
    exit 1
fi

DEPLOY_USER="${1:-}"
if [ -z "$DEPLOY_USER" ]; then
    echo "Usage : sudo $0 <DEPLOY_USER>" >&2
    echo "  ex : sudo $0 ubuntu" >&2
    exit 1
fi

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
    echo "ERREUR : le user '$DEPLOY_USER' n'existe pas sur ce serveur." >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
VHOST_SRC="${SCRIPT_DIR}/pushit.foxugly.com.conf"

if [ ! -f "$VHOST_SRC" ]; then
    echo "ERREUR : fichier vhost introuvable : $VHOST_SRC" >&2
    echo "(scp le dossier deploy/ complet sur le serveur d'abord)" >&2
    exit 1
fi

echo "=== Setup serveur pour ${DOMAIN} ==="
echo "Deploy user : ${DEPLOY_USER}"
echo "Target dir  : ${TARGET_DIR}"
echo ""

# ─── Étape 1 : dossier cible ─────────────────────────────────────────────────
echo "[1/7] Dossier cible"
mkdir -p "$TARGET_DIR"
chown "${APP_OWNER}:${APP_GROUP}" "$TARGET_DIR"
chmod 750 "$TARGET_DIR"
echo "    OK"

# ─── Étape 2 : modules Apache ────────────────────────────────────────────────
echo "[2/7] Modules Apache (proxy, proxy_http, headers, rewrite, ssl)"
a2enmod proxy proxy_http headers rewrite ssl >/dev/null
echo "    OK"

# ─── Étape 3 : vhost bootstrap pour certbot ──────────────────────────────────
echo "[3/7] Vhost bootstrap HTTP-only (pour challenge certbot)"
# Désactive le vrai vhost si déjà installé, sinon certbot va re-échouer sur
# une config avec SSL sans cert.
a2dissite "${DOMAIN}" >/dev/null 2>&1 || true
cat > "/etc/apache2/sites-available/pushit-bootstrap.conf" <<EOF
<VirtualHost *:80>
    ServerName ${DOMAIN}
    DocumentRoot /var/www/html
</VirtualHost>
EOF
a2ensite pushit-bootstrap >/dev/null
systemctl reload apache2
echo "    OK"

# ─── Étape 4 : certificat SSL ────────────────────────────────────────────────
echo "[4/7] Certificat SSL via certbot"
if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
    echo "    certificat déjà présent, skip"
else
    certbot certonly --webroot -w /var/www/html -d "${DOMAIN}" \
        --non-interactive --agree-tos --email "${CERTBOT_EMAIL}"
    echo "    OK"
fi

# ─── Étape 5 : vrai vhost ────────────────────────────────────────────────────
echo "[5/7] Installation du vhost final"
a2dissite pushit-bootstrap >/dev/null
rm -f "/etc/apache2/sites-available/pushit-bootstrap.conf"
cp "$VHOST_SRC" "/etc/apache2/sites-available/${DOMAIN}.conf"
a2ensite "${DOMAIN}" >/dev/null
apache2ctl configtest
systemctl reload apache2
echo "    OK"

# ─── Étape 6 : sudoers pour le déploiement ───────────────────────────────────
echo "[6/7] Sudoers NOPASSWD pour ${DEPLOY_USER}"
SUDOERS_FILE="/etc/sudoers.d/pushit-frontend-deploy"
cat > "${SUDOERS_FILE}" <<EOF
${DEPLOY_USER} ALL=(django) NOPASSWD: /usr/bin/rsync -a --delete /tmp/pushit-frontend-staging/ ${TARGET_DIR}/
${DEPLOY_USER} ALL=(root) NOPASSWD: /bin/chown -R django\:www-data ${TARGET_DIR}/, /bin/chmod -R g+rX ${TARGET_DIR}/
EOF
chmod 440 "${SUDOERS_FILE}"
visudo -c -f "${SUDOERS_FILE}" >/dev/null
echo "    OK"

# ─── Étape 7 : smoke test ────────────────────────────────────────────────────
echo "[7/7] Smoke test HTTPS"
if curl --fail --silent --show-error --max-time 30 -I "https://${DOMAIN}" >/dev/null; then
    echo "    https://${DOMAIN} répond (normal: 200 ou 404 selon si index.html est déjà déployé)"
else
    echo "    pas de réponse (normal avant le premier déploiement de contenu)"
fi

# ─── Récapitulatif ───────────────────────────────────────────────────────────
echo ""
echo "=== Setup terminé ==="
echo ""
echo "Il reste à faire manuellement (une fois) :"
echo ""
echo "  1. Ajouter les secrets GitHub sur le repo PushIT_frontend"
echo "     (Settings > Secrets and variables > Actions) :"
echo "       - EC2_HOST"
echo "       - EC2_USER  (= '${DEPLOY_USER}')"
echo "       - EC2_SSH_KEY"
echo "     Dupliquer depuis le repo PushIT_server."
echo ""
echo "  2. Ajouter 'pushit.foxugly.com' à ALLOWED_HOSTS dans la config"
echo "     Django, puis redémarrer gunicorn/uwsgi."
echo ""
echo "  3. Vérifier que la clé publique correspondant à EC2_SSH_KEY est"
echo "     dans ~${DEPLOY_USER}/.ssh/authorized_keys"
echo ""
echo "  4. Déclencher le workflow :"
echo "     https://github.com/Foxugly/PushIT_frontend/actions"
echo "     > Deploy frontend to EC2 > Run workflow"
echo ""
