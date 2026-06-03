# Déploiement — PushIT frontend

Ce document liste les étapes **one-time** à exécuter manuellement sur le serveur pour activer le déploiement automatique du frontend Angular. Une fois faites, le déploiement se fait automatiquement via GitHub Actions sur push `main`.

**Raccourci :** les étapes 2, 3, 5, 6, 7 sont automatisées par `deploy/setup-server.sh`. Pour l'utiliser : `scp -r deploy/ <EC2_USER>@<EC2_HOST>:/tmp/`, puis sur le serveur `sudo /tmp/deploy/setup-server.sh <EC2_USER>`. Les étapes 1 (secrets GitHub), 4 (Django ALLOWED_HOSTS), 8 (clé SSH) et 9 (premier déploiement) restent manuelles.

## Pré-requis

- Serveur EC2 Ubuntu 24.04 avec Apache2 et certbot installés
- Backend Django `pushit-api.foxugly.com` déjà en place
- DNS `pushit.foxugly.com` pointant vers l'IP de l'EC2

## Étapes

### 1. Secrets GitHub

Dupliquer les 3 secrets depuis le repo `PushIT_server` vers ce repo (Settings → Secrets and variables → Actions) :

- `EC2_HOST`
- `EC2_USER` — **doit valoir `django`** (le déploiement se connecte et tourne en
  `django`, plus en `ubuntu` ; cf. §7 sécurité)
- `EC2_SSH_KEY` (sa clé publique doit être dans `~django/.ssh/authorized_keys`)

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

### 4. Django ALLOWED_HOSTS

Le vhost utilise `ProxyPreserveHost On`, donc le backend Django reçoit les requêtes avec `Host: pushit.foxugly.com`. Ajouter ce hostname à `ALLOWED_HOSTS` dans la configuration Django (probablement dans `PushIT_server/settings.py` ou équivalent) si ce n'est pas déjà le cas, puis redémarrer gunicorn/uwsgi.

Sans cet ajout, Django renverra `400 Bad Request: Invalid HTTP_HOST header` sur les appels `/api/v1`.

### 5. Vhost Apache

Copier `deploy/pushit.foxugly.com.conf` depuis ce repo vers `/etc/apache2/sites-available/` :

```bash
# Depuis une machine avec le repo cloné, ou via scp :
scp deploy/pushit.foxugly.com.conf ${EC2_USER}@${EC2_HOST}:/tmp/
ssh ${EC2_USER}@${EC2_HOST}
sudo mv /tmp/pushit.foxugly.com.conf /etc/apache2/sites-available/
sudo a2ensite pushit.foxugly.com
sudo apache2ctl configtest  # attendu : échouera tant que certbot n'a pas tourné, OK
```

### 6. Certificat SSL

```bash
sudo certbot --apache -d pushit.foxugly.com
```

Certbot va automatiquement réécrire le fichier `pushit.foxugly.com.conf` pour y injecter les bons chemins SSL. C'est normal.

Puis :
```bash
sudo systemctl reload apache2
```

### 7. Sudoers least-privilege (django)

⚠️ **Sécurité** — `deploy.sh` vit dans un arbre inscriptible par `django` : il ne
doit donc **jamais** tourner en root (sinon un RCE du process web `django`
réécrirait `deploy.sh` et obtiendrait root). La CI se connecte donc **en `django`**
et lance `deploy.sh` **sans sudo** ; le script ne fait qu'**une** action root :
redémarrer l'unité de fetch SSM. Le drop-in est versionné dans
`deploy/sudoers/pushit-frontend-deploy` et installé (root:root 0440) par
`setup-server.sh`. Pour l'installer/valider à la main :

```bash
sudo visudo -cf deploy/sudoers/pushit-frontend-deploy           # valide la SOURCE
sudo install -o root -g root -m 0440 \
  deploy/sudoers/pushit-frontend-deploy /etc/sudoers.d/pushit-frontend-deploy
sudo visudo -cf /etc/sudoers.d/pushit-frontend-deploy           # valide la CIBLE
```

Contenu (cf. `deploy/sudoers/pushit-frontend-deploy`) :

```
Cmnd_Alias PUSHIT_FRONTEND_DEPLOY = /usr/bin/systemctl restart pushit-frontend-runtime-fetch
Defaults!PUSHIT_FRONTEND_DEPLOY !setenv, !env_keep
django ALL=(root) NOPASSWD: PUSHIT_FRONTEND_DEPLOY
```

L'unité de fetch exécute `/usr/local/sbin/pushit-frontend-runtime-fetch.sh`
(root:root 0755, **hors de l'arbre applicatif**), de sorte qu'aucun chemin ne
permet à `django` d'influencer du code exécuté en root. Vérifier :
`sudo -l -U django` ne doit lister que ce `systemctl restart`.

### 8. Clé SSH

S'assurer que la clé publique correspondant au secret `EC2_SSH_KEY` est dans `~${EC2_USER}/.ssh/authorized_keys`. Si la clé est la même que celle utilisée pour `PushIT_server`, c'est déjà le cas.

### 9. Premier déploiement

Merger sur `main` (ou déclencher manuellement le workflow via l'onglet Actions de GitHub). Vérifier :

```bash
curl -I https://pushit.foxugly.com                    # 200 OK
curl -I https://pushit.foxugly.com/route-bidon-spa    # 200 OK (fallback index.html)
curl https://pushit.foxugly.com/api/v1/<endpoint>     # même réponse que pushit-api.foxugly.com
```

## Rollback

Pas de mécanisme automatique. En cas de régression : revert du commit fautif sur `main`, un nouveau déploiement repart.
