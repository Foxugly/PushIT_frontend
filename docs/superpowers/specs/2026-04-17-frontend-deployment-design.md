# Frontend deployment — PushIT Angular

**Date:** 2026-04-17
**Owner:** rvilain@foxugly.com
**Target:** `https://pushit.foxugly.com`

## Goal

Déployer automatiquement le frontend Angular sur le serveur EC2 Ubuntu 24.04 partagé, via GitHub Actions, sans casser le backend Django (QuizOnline + PushIT API) qui tourne déjà sur la même machine.

## Contexte serveur

- EC2 Ubuntu 24.04 partagé, Apache2 déjà installé
- Chemin cible : `/var/www/django_websites/PushIT_frontend/`
- Propriétaire : `django:www-data`
- Accès SSH : via les secrets GitHub `EC2_USER@EC2_HOST` avec la clé `EC2_SSH_KEY` ; les opérations app sont exécutées en `sudo -u django`
- Backend PushIT API : `https://pushit-api.foxugly.com` (vhost Apache séparé, déjà en place) → proxifie vers `http://127.0.0.1:8000`
- Certbot déjà installé
- Node.js **non** disponible sur le serveur → le build se fait en CI

## Décisions prises

### 1. Routing API : Apache reverse-proxy (same-origin)

Apache sur `pushit.foxugly.com` reverse-proxy `/api/v1` → `http://127.0.0.1:8000/api/v1` (backend local), pas via `pushit-api.foxugly.com`.

**Conséquences :**
- Pas de CORS à configurer côté Django
- Le défaut `/api/v1` dans `SettingsService` fonctionne tel quel — aucun changement de code frontend
- L'API reste accessible via ses deux sous-domaines (`pushit-api.foxugly.com` ET `pushit.foxugly.com/api/v1`) — acceptable pour l'instant

### 2. Stratégie de déploiement : rsync direct avec staging

- Build en CI, upload via rsync vers `/tmp/pushit-frontend-staging/` (ownership = ubuntu)
- Puis `sudo -u django rsync -a --delete` vers `/var/www/django_websites/PushIT_frontend/` pour que l'ownership final soit correct
- Pas de stratégie release/symlink (overkill pour du statique)

### 3. Build output Angular 20

Le builder `@angular/build:application` produit `dist/pushit-frontend/browser/` — c'est ce dossier qu'on déploie (pas le parent `dist/pushit-frontend/`).

### 4. CI : GitHub Actions sur push `main`

- Utilise exactement les 3 secrets du repository : `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY` (connexion `${EC2_USER}@${EC2_HOST}` avec la clé privée `EC2_SSH_KEY`)
- À dupliquer manuellement depuis le repo `PushIT_server` vers ce repo

## Architecture

```
   ┌─────────────────────────────────┐
   │  GitHub Actions (push main)     │
   │  - checkout                     │
   │  - setup Node 20                │
   │  - npm ci                       │
   │  - npm run build                │
   │  - rsync dist → EC2 /tmp/       │
   │  - ssh: sudo -u django install  │
   └─────────────────────────────────┘
                   │
                   ▼
   ┌─────────────────────────────────┐
   │  EC2 Ubuntu 24.04               │
   │                                 │
   │  Apache :443                    │
   │  ├─ pushit.foxugly.com          │
   │  │   ├─ DocumentRoot /var/www/…/PushIT_frontend
   │  │   ├─ FallbackResource /index.html  (SPA routing)
   │  │   └─ ProxyPass /api/v1 → 127.0.0.1:8000/api/v1
   │  │                              │
   │  └─ pushit-api.foxugly.com      │
   │      └─ ProxyPass / → 127.0.0.1:8000
   │                                 │
   │  Django (gunicorn) :8000        │
   └─────────────────────────────────┘
```

## Livrables

### L1. `.github/workflows/deploy.yml`

Workflow GitHub Actions déclenché sur push `main`.

Étapes :
1. `actions/checkout@v4`
2. `actions/setup-node@v4` avec Node 20 + cache npm
3. `npm ci`
4. `npm run build` (configuration production par défaut)
5. Installer la clé SSH depuis `secrets.EC2_SSH_KEY` (via `webfactory/ssh-agent` ou équivalent)
6. `rsync -az --delete dist/pushit-frontend/browser/ ${EC2_USER}@${EC2_HOST}:/tmp/pushit-frontend-staging/`
7. `ssh` pour exécuter la promotion :
   ```bash
   sudo -u django rsync -a --delete /tmp/pushit-frontend-staging/ /var/www/django_websites/PushIT_frontend/
   sudo chown -R django:www-data /var/www/django_websites/PushIT_frontend/
   sudo chmod -R g+rX /var/www/django_websites/PushIT_frontend/
   rm -rf /tmp/pushit-frontend-staging
   ```

Secrets requis (à dupliquer depuis `PushIT_server`) : `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`.

### L2. Vhost Apache `pushit.foxugly.com.conf`

Un fichier à déposer dans `/etc/apache2/sites-available/`. Deux VirtualHost :

**:80** — redirige tout vers HTTPS :
```apache
<VirtualHost *:80>
    ServerName pushit.foxugly.com
    Redirect permanent / https://pushit.foxugly.com/
</VirtualHost>
```

**:443** — sert les fichiers statiques + reverse-proxy API. L'URL du backend est déclarée via `Define` en tête de vhost pour rester en un seul endroit configurable :
```apache
Define BACKEND_URL http://127.0.0.1:8000

<VirtualHost *:443>
    ServerName pushit.foxugly.com
    DocumentRoot /var/www/django_websites/PushIT_frontend

    <Directory /var/www/django_websites/PushIT_frontend>
        Require all granted
        Options -Indexes
        FallbackResource /index.html
    </Directory>

    # Cache long pour les assets hashés (fichiers avec hash dans le nom)
    <FilesMatch "\.[0-9a-f]{8,}\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico)$">
        Header set Cache-Control "public, max-age=31536000, immutable"
    </FilesMatch>

    # Pas de cache sur index.html
    <FilesMatch "^index\.html$">
        Header set Cache-Control "no-cache, no-store, must-revalidate"
    </FilesMatch>

    # Reverse-proxy API vers backend local
    ProxyPreserveHost On
    ProxyPass /api/v1 ${BACKEND_URL}/api/v1
    ProxyPassReverse /api/v1 ${BACKEND_URL}/api/v1

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/pushit.foxugly.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/pushit.foxugly.com/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf

    ErrorLog ${APACHE_LOG_DIR}/pushit.foxugly.com-error.log
    CustomLog ${APACHE_LOG_DIR}/pushit.foxugly.com-access.log combined
</VirtualHost>
```

Note : les chemins certbot finaux seront ceux générés par `certbot --apache` lors de l'étape one-time.

### L3. `DEPLOY.md`

Document à la racine du repo listant les étapes **one-time** à exécuter sur le serveur (pas automatisées, ne sont à faire qu'une fois) :

1. Créer le dossier cible :
   ```bash
   sudo mkdir -p /var/www/django_websites/PushIT_frontend
   sudo chown django:www-data /var/www/django_websites/PushIT_frontend
   sudo chmod 750 /var/www/django_websites/PushIT_frontend
   ```

2. Activer les modules Apache nécessaires :
   ```bash
   sudo a2enmod proxy proxy_http headers rewrite ssl
   ```

3. Déposer le vhost (L2) dans `/etc/apache2/sites-available/pushit.foxugly.com.conf`, puis :
   ```bash
   sudo a2ensite pushit.foxugly.com
   sudo systemctl reload apache2
   ```

4. Générer le certificat avec certbot :
   ```bash
   sudo certbot --apache -d pushit.foxugly.com
   ```

5. Ajouter le pointeur DNS (A/CNAME `pushit.foxugly.com` → IP EC2) si pas déjà fait.

6. Dupliquer les secrets GitHub (`EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`) depuis le repo `PushIT_server` vers ce repo.

7. S'assurer que la clé publique correspondant au secret `EC2_SSH_KEY` est bien dans `~${EC2_USER}/.ssh/authorized_keys` sur le serveur (déjà le cas si la clé est partagée avec le déploiement backend).

8. Autoriser l'utilisateur `${EC2_USER}` à lancer les commandes de promotion en `sudo -u django` sans mot de passe (sudoers NOPASSWD ciblé sur `rsync`, `chown`, `chmod` vers `/var/www/django_websites/PushIT_frontend/`).

## Tests / validation

- Après premier déploiement : `curl -I https://pushit.foxugly.com` → 200 + HTML
- `curl -I https://pushit.foxugly.com/non/existing/route` → 200 + `index.html` (SPA fallback)
- `curl https://pushit.foxugly.com/api/v1/<endpoint public>` → même réponse que `https://pushit-api.foxugly.com/api/v1/<endpoint public>`
- Login depuis le navigateur réel → token reçu, redirect console OK
- Backend QuizOnline + `pushit-api.foxugly.com` toujours fonctionnels

## Hors scope

- Stratégie release/rollback avec symlink atomique
- Monitoring/alerting sur le déploiement
- Environnement staging séparé
- Rebuild automatique sur changement d'URL API (non nécessaire avec l'option same-origin)
- Tests E2E dans la CI de déploiement (gardés séparés)
