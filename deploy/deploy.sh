#!/usr/bin/env bash
# =============================================================================
# PushIT frontend — Deploy script (promotion côté serveur).
#
# Exécuté EN TANT QUE `django` (CI : ssh django@host '.../deploy/deploy.sh'),
# SANS sudo. Tout est non privilégié sauf UN appel `sudo` à une commande précise
# (redémarrage de l'unité oneshot de fetch SSM), listée dans
# /etc/sudoers.d/pushit-frontend-deploy.
#
# Modèle de sécurité : ce fichier vit dans un arbre inscriptible par `django`,
# donc il ne doit JAMAIS tourner en root. Le seul code exécuté en root est
# l'unité systemd, dont l'ExecStart pointe un script root-owned hors de l'arbre
# applicatif (/usr/local/sbin) — `django` (donc un RCE du process web) ne peut
# pas influencer ce qui s'exécute en root.
#
#   /var/www/django_websites/PushIT_frontend/deploy/deploy.sh
#
# 1. met à jour les sources versionnées deploy/ (git) ;
# 2. promeut les artefacts SPA dans dist/pushit-frontend/browser/ ;
# 3. normalise les permissions (django:www-data, dossiers 750 / fichiers 640) ;
# 4. applique la config runtime (rotation SSM) via l'unité de fetch privilégiée.
# =============================================================================
set -euo pipefail
umask 027

APP_DIR="/var/www/django_websites/PushIT_frontend"
ARTIFACT_DIR="$APP_DIR/dist/pushit-frontend/browser"
STAGING_DIR="/tmp/pushit-frontend-staging"

# Refuse de tourner en root : sinon on recréerait le chemin d'escalade fermé ici.
if [ "$(id -u)" -eq 0 ]; then
    echo "ERREUR : deploy.sh doit tourner en tant que 'django', jamais en root." >&2
    exit 1
fi

cd "$APP_DIR"

echo ">>> Updating deploy sources (git, non privilégié)..."
# Met à jour deploy/ etc. ; dist/ est gitignoré donc les artefacts ne sont pas
# touchés par le reset.
git fetch origin main
git reset --hard origin/main

echo ">>> Promoting SPA artifacts (django, sans sudo)..."
# Le docroot appartient à django : promotion directe, aucun root requis. Le
# staging (/tmp/pushit-frontend-staging, rsync'é par la CI en tant que django)
# est donc lisible sans gymnastique cross-user.
mkdir -p "$ARTIFACT_DIR"
/usr/bin/rsync -a --delete "$STAGING_DIR/" "$ARTIFACT_DIR/"
rm -rf "$STAGING_DIR"

echo ">>> Normalizing perms (django:www-data, dossiers 750 / fichiers 640)..."
# Schéma durable, ré-appliqué à chaque deploy (idempotent) : groupe www-data
# (django ∈ www-data → chgrp/chmod sur ses propres fichiers, sans root) ;
# g+rX garantit que nginx (groupe www-data) lit/traverse ; g-w,o-rwx durcit
# (aucune écriture-groupe, aucun accès "autres"). Le bit u+x (scripts) n'est
# jamais touché (aucune clause 'u').
chgrp -R www-data "$APP_DIR"
chmod -R g+rX,g-w,o-rwx "$APP_DIR"

echo ">>> Applying runtime config (SSM) — seule étape privilégiée..."
# Unique commande root : restart de l'unité oneshot de fetch (re-lit SSM puis
# `nginx -t` + reload). Chemin absolu = doit matcher exactement le drop-in
# sudoers. `-n` : échoue plutôt que de prompter si le droit manque.
sudo -n /usr/bin/systemctl restart pushit-frontend-runtime-fetch

echo ">>> Deploy complete."
