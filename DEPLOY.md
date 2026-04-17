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

### 7. Sudoers pour la promotion en sudo -u django

Autoriser `${EC2_USER}` à exécuter les commandes de promotion sans mot de passe. Créer `/etc/sudoers.d/pushit-frontend-deploy` :

```bash
sudo visudo -f /etc/sudoers.d/pushit-frontend-deploy
```

Contenu (remplacer `<EC2_USER>` par la valeur réelle du secret, p.ex. `ubuntu`) :

```
<EC2_USER> ALL=(django) NOPASSWD: /usr/bin/rsync -a --delete /tmp/pushit-frontend-staging/ /var/www/django_websites/PushIT_frontend/
<EC2_USER> ALL=(root) NOPASSWD: /bin/chown -R django\:www-data /var/www/django_websites/PushIT_frontend/, /bin/chmod -R g+rX /var/www/django_websites/PushIT_frontend/
```

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
