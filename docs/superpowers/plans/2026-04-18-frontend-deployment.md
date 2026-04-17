# Frontend Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Déployer automatiquement le frontend Angular PushIT sur `https://pushit.foxugly.com` (EC2 Ubuntu 24.04 partagé avec le backend Django) via GitHub Actions + Apache2 reverse-proxy.

**Architecture:** Build Angular en CI (Node 20), upload via rsync dans un staging `/tmp/` (owner `EC2_USER`), puis promotion en `sudo -u django rsync` vers `/var/www/django_websites/PushIT_frontend/`. Apache2 sert les fichiers statiques avec `FallbackResource /index.html` pour le routing SPA, et reverse-proxy `/api/v1` vers `http://127.0.0.1:8000/api/v1` (same-origin, zéro CORS).

**Tech Stack:** Angular 20 (builder `@angular/build:application`), GitHub Actions, Apache2 (modules `proxy`, `proxy_http`, `headers`, `rewrite`, `ssl`), Certbot, rsync.

**Spec de référence:** `docs/superpowers/specs/2026-04-17-frontend-deployment-design.md`

---

## File Structure

Fichiers à créer dans ce repo :

- **Créer** `.github/workflows/deploy.yml` — workflow CI : build Angular + rsync + ssh promotion
- **Créer** `deploy/pushit.foxugly.com.conf` — vhost Apache (template, à déposer manuellement sur le serveur lors du one-time)
- **Créer** `DEPLOY.md` — runbook one-time à la racine du repo, listant les étapes serveur à exécuter une seule fois

Pas de modification de code Angular : le routing API reste `/api/v1` relatif (comportement actuel de `src/app/core/services/settings.service.ts`), Apache fait le reverse-proxy.

---

## Task 1: Vhost Apache

Livrer le fichier de configuration Apache qui servira de modèle pour l'étape one-time sur le serveur. On le commit dans le repo pour qu'il soit versionné.

**Files:**
- Create: `deploy/pushit.foxugly.com.conf`

- [ ] **Step 1: Créer le dossier `deploy/`**

```bash
mkdir -p deploy
```

- [ ] **Step 2: Écrire le vhost**

Contenu de `deploy/pushit.foxugly.com.conf` :

```apache
# Vhost Apache pour pushit.foxugly.com
# À déposer dans /etc/apache2/sites-available/ lors du setup one-time.
# Certbot peut régénérer automatiquement la partie SSL après coup.

<VirtualHost *:80>
    ServerName pushit.foxugly.com
    Redirect permanent / https://pushit.foxugly.com/
</VirtualHost>

# URL du backend centralisée : une seule ligne à modifier si le backend
# déménage (port, host, ou scheme). Reste en tête de fichier pour visibilité.
Define BACKEND_URL http://127.0.0.1:8000

<VirtualHost *:443>
    ServerName pushit.foxugly.com
    DocumentRoot /var/www/django_websites/PushIT_frontend

    <Directory /var/www/django_websites/PushIT_frontend>
        Require all granted
        Options -Indexes
        FallbackResource /index.html
    </Directory>

    # Cache long pour les assets hashés par le build Angular
    <FilesMatch "\.[0-9a-f]{8,}\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico)$">
        Header set Cache-Control "public, max-age=31536000, immutable"
    </FilesMatch>

    # Pas de cache sur index.html (sinon les utilisateurs restent bloqués
    # sur une ancienne version qui référence des chunks supprimés)
    <FilesMatch "^index\.html$">
        Header set Cache-Control "no-cache, no-store, must-revalidate"
    </FilesMatch>

    # Reverse-proxy vers le backend local (same-origin, pas de CORS)
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

- [ ] **Step 3: Vérifier syntaxiquement (facultatif si apache2 présent localement)**

Run (sur le serveur si possible, pas obligatoire en local) :
```bash
sudo apache2ctl -t -f /etc/apache2/sites-available/pushit.foxugly.com.conf
```
Expected: `Syntax OK` (erreur attendue si les certs n'existent pas encore — c'est normal tant que certbot n'a pas tourné, on ignore à ce stade).

- [ ] **Step 4: Commit**

```bash
git add deploy/pushit.foxugly.com.conf
git commit -m "feat(deploy): add Apache vhost for pushit.foxugly.com"
```

---

## Task 2: Runbook DEPLOY.md

Documenter les étapes manuelles à faire une fois sur le serveur pour initialiser le déploiement.

**Files:**
- Create: `DEPLOY.md`

- [ ] **Step 1: Écrire le runbook**

Contenu de `DEPLOY.md` :

````markdown
# Déploiement — PushIT frontend

Ce document liste les étapes **one-time** à exécuter manuellement sur le serveur pour activer le déploiement automatique du frontend Angular. Une fois faites, le déploiement se fait automatiquement via GitHub Actions sur push `main`.

## Pré-requis

- Serveur EC2 Ubuntu 24.04 avec Apache2 et certbot installés
- Backend Django `pushit-api.foxugly.com` déjà en place
- DNS `pushit.foxugly.com` pointant vers l'IP de l'EC2

## Étapes

### 1. Secrets GitHub

Dupliquer les 3 secrets depuis le repo `PushIT_server` vers ce repo (Settings → Secrets and variables → Actions) :

- `EC2_HOST`
- `EC2_USER`
- `EC2_SSH_KEY`

### 2. Dossier cible sur le serveur

```bash
sudo mkdir -p /var/www/django_websites/PushIT_frontend
sudo chown django:www-data /var/www/django_websites/PushIT_frontend
sudo chmod 750 /var/www/django_websites/PushIT_frontend
```

### 3. Modules Apache

```bash
sudo a2enmod proxy proxy_http headers rewrite ssl
```

### 4. Vhost Apache

Copier `deploy/pushit.foxugly.com.conf` depuis ce repo vers `/etc/apache2/sites-available/` :

```bash
# Depuis une machine avec le repo cloné, ou via scp :
scp deploy/pushit.foxugly.com.conf ${EC2_USER}@${EC2_HOST}:/tmp/
ssh ${EC2_USER}@${EC2_HOST}
sudo mv /tmp/pushit.foxugly.com.conf /etc/apache2/sites-available/
sudo a2ensite pushit.foxugly.com
sudo apache2ctl configtest  # attendu: échouera tant que certbot n'a pas tourné, OK
```

### 5. Certificat SSL

```bash
sudo certbot --apache -d pushit.foxugly.com
```

Certbot va automatiquement réécrire le fichier `pushit.foxugly.com.conf` pour y injecter les bons chemins SSL. C'est normal.

Puis :
```bash
sudo systemctl reload apache2
```

### 6. Sudoers pour la promotion en sudo -u django

Autoriser `${EC2_USER}` à exécuter les commandes de promotion sans mot de passe. Créer `/etc/sudoers.d/pushit-frontend-deploy` :

```bash
sudo visudo -f /etc/sudoers.d/pushit-frontend-deploy
```

Contenu (remplacer `<EC2_USER>` par la valeur réelle du secret, p.ex. `ubuntu`) :

```
<EC2_USER> ALL=(django) NOPASSWD: /usr/bin/rsync -a --delete /tmp/pushit-frontend-staging/ /var/www/django_websites/PushIT_frontend/
<EC2_USER> ALL=(root) NOPASSWD: /bin/chown -R django\:www-data /var/www/django_websites/PushIT_frontend/, /bin/chmod -R g+rX /var/www/django_websites/PushIT_frontend/
```

### 7. Clé SSH

S'assurer que la clé publique correspondant au secret `EC2_SSH_KEY` est dans `~${EC2_USER}/.ssh/authorized_keys`. Si la clé est la même que celle utilisée pour `PushIT_server`, c'est déjà le cas.

### 8. Premier déploiement

Merger sur `main` (ou déclencher manuellement le workflow via l'onglet Actions de GitHub). Vérifier :

```bash
curl -I https://pushit.foxugly.com                    # 200 OK
curl -I https://pushit.foxugly.com/route-bidon-spa    # 200 OK (fallback index.html)
curl https://pushit.foxugly.com/api/v1/<endpoint>     # même réponse que pushit-api.foxugly.com
```

## Rollback

Pas de mécanisme automatique. En cas de régression : revert du commit fautif sur `main`, un nouveau déploiement repart.
````

- [ ] **Step 2: Commit**

```bash
git add DEPLOY.md
git commit -m "docs: add one-time server setup runbook for frontend deployment"
```

---

## Task 3: Workflow GitHub Actions

Construire le workflow de CI/CD qui build et déploie à chaque push `main`.

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Créer le dossier du workflow**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Écrire le workflow**

Contenu de `.github/workflows/deploy.yml` :

```yaml
name: Deploy frontend to EC2

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy-frontend
  cancel-in-progress: false

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build (production)
        run: npm run build

      - name: Verify build output
        run: test -f dist/pushit-frontend/browser/index.html

      - name: Setup SSH
        uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.EC2_SSH_KEY }}

      - name: Add EC2 host to known_hosts
        run: ssh-keyscan -H "${{ secrets.EC2_HOST }}" >> ~/.ssh/known_hosts

      - name: Rsync build to staging
        run: |
          rsync -az --delete \
            dist/pushit-frontend/browser/ \
            "${{ secrets.EC2_USER }}@${{ secrets.EC2_HOST }}:/tmp/pushit-frontend-staging/"

      - name: Promote staging to live
        run: |
          ssh "${{ secrets.EC2_USER }}@${{ secrets.EC2_HOST }}" bash -s <<'EOF'
          set -euo pipefail
          sudo -u django /usr/bin/rsync -a --delete \
            /tmp/pushit-frontend-staging/ \
            /var/www/django_websites/PushIT_frontend/
          sudo /bin/chown -R django:www-data /var/www/django_websites/PushIT_frontend/
          sudo /bin/chmod -R g+rX /var/www/django_websites/PushIT_frontend/
          rm -rf /tmp/pushit-frontend-staging
          EOF

      - name: Smoke test
        run: |
          curl --fail --silent --show-error -I https://pushit.foxugly.com > /dev/null
          echo "Deployment OK"
```

- [ ] **Step 3: Valider la syntaxe YAML localement**

Run :
```bash
python -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml'))"
```
Expected: aucune sortie (pas d'erreur).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Actions workflow for frontend deployment"
```

---

## Task 4: Vérifier que le build produit bien le dossier attendu

Le workflow attend `dist/pushit-frontend/browser/index.html`. Validons-le localement avant de pousser.

**Files:** (aucun changement — vérification seulement)

- [ ] **Step 1: Build local**

Run :
```bash
npm run build
```
Expected : build success, fichiers générés dans `dist/pushit-frontend/browser/`.

- [ ] **Step 2: Vérifier la structure**

Run :
```bash
test -f dist/pushit-frontend/browser/index.html && echo OK
```
Expected : `OK`.

Si `index.html` est ailleurs (p.ex. directement dans `dist/pushit-frontend/` sans sous-dossier `browser/`), adapter les chemins dans `.github/workflows/deploy.yml` (étapes `Verify build output` et `Rsync build to staging`).

- [ ] **Step 3: Nettoyer**

```bash
rm -rf dist/
```

Pas de commit sur cette task — c'est une validation.

---

## Task 5: Revue finale et push

- [ ] **Step 1: Relire les 3 fichiers**

```bash
git log --oneline -5
git show HEAD~2 HEAD~1 HEAD --stat
```

Expected : les commits `feat(deploy)`, `docs: add one-time`, `ci:` apparaissent, tous avec le bon scope.

- [ ] **Step 2: Exécuter les étapes one-time du `DEPLOY.md` sur le serveur**

Cette partie est **manuelle** et doit être faite par un humain qui a accès au serveur. Suivre `DEPLOY.md` sections 1 à 7.

- [ ] **Step 3: Pousser sur `main` pour déclencher le premier déploiement**

```bash
git push origin main
```

- [ ] **Step 4: Surveiller le workflow**

Aller sur l'onglet Actions de GitHub, vérifier que `Deploy frontend to EC2` passe au vert.

- [ ] **Step 5: Smoke test post-déploiement**

Run (depuis n'importe quelle machine) :
```bash
curl -I https://pushit.foxugly.com
curl -I https://pushit.foxugly.com/console/applications
curl -sSf https://pushit.foxugly.com/api/v1/ping 2>/dev/null || echo "(pas d'endpoint ping — tester manuellement un endpoint connu)"
```

Puis ouvrir `https://pushit.foxugly.com` dans un navigateur, se connecter, vérifier que la console charge.

- [ ] **Step 6: Vérifier que les autres sites tournent toujours**

```bash
curl -I https://pushit-api.foxugly.com/api/v1/<endpoint>   # backend PushIT intact
curl -I https://<autre-site-QuizOnline>.foxugly.com        # QuizOnline intact
```

---

## Notes de troubleshooting

- **Si le rsync échoue avec "Permission denied" sur `/tmp/pushit-frontend-staging/`** : le dossier existe déjà avec un autre owner. Solution : `ssh` puis `sudo rm -rf /tmp/pushit-frontend-staging/`.
- **Si `sudo -u django rsync` échoue avec mot de passe requis** : le fichier sudoers (étape 6 de DEPLOY.md) n'est pas bon — vérifier les chemins exacts avec `sudo -l -U ${EC2_USER}`.
- **Si le navigateur affiche des erreurs 404 sur des chunks JS** : Apache ne sert pas le bon dossier, ou le cache navigateur garde un ancien `index.html`. Vérifier `DocumentRoot` et le header `Cache-Control` sur `index.html`.
- **Si `/api/v1/...` renvoie 502** : `proxy_http` n'est pas activé, ou Django n'écoute pas sur `127.0.0.1:8000`. Vérifier `sudo a2enmod proxy_http && systemctl reload apache2`, puis `curl http://127.0.0.1:8000/api/v1/` en SSH.
