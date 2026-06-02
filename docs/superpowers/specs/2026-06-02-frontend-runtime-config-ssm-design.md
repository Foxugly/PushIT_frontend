# Alignement du frontend PushIT sur la convention de déploiement SSM/nginx

**Date :** 2026-06-02
**Statut :** Spec validée (design approuvé), prête pour plan d'implémentation
**Repo :** `PushIT_frontend` (Angular 20, `pushit.foxugly.com`)

## 1. Contexte

Le backend PushIT (`pushit-api.foxugly.com`, repo `PushIT_server`) a migré sur la
convention de déploiement partagée de l'EC2 (cohabitation avec QuizOnline) :
config via AWS SSM Parameter Store, unité systemd `oneshot` de fetch au boot,
reverse-proxy nginx, TLS via `certbot --nginx`. On aligne ce frontend sur la même
convention.

### État actuel du frontend (avant ce chantier)

- **Aucune config runtime.** L'URL d'API est la chaîne relative `/api/v1`
  (`src/app/core/services/settings.service.ts`), codée en dur comme défaut,
  surchargeable via le stockage navigateur. Pas de `@sentry/*` dans
  `package.json`, pas de feature flags, pas de fichier `environment.ts`, pas
  d'`APP_INITIALIZER`. Bootstrap direct depuis `app.config.ts`.
- **Servi en same-origin via Apache.** Le vhost actuel
  (`deploy/pushit.foxugly.com.conf`) reverse-proxie `/api/v1/ → 127.0.0.1:8000`.
  Déploiement build-time uniquement, rsync, pas de SSM.

### Références à imiter

- **Backend `PushIT_server/deploy/`** : `fetch-env-from-ssm.sh`,
  `seed-parameter-store.{sh,ps1}`, `systemd/pushit-env-fetch.service`,
  `nginx/pushit-api.conf`, `deploy.sh`, `setup-server.sh`.
- **Jumeau frontend QuizOnline** (`QuizOnline/deploy/`) :
  `fetch-frontend-runtime-from-ssm.sh`, `quizonline-frontend-runtime-fetch.service`,
  et l'injection `sub_filter` dans `nginx.conf`. QuizOnline ne sert **aucun**
  fichier de conf au navigateur : il écrit un snippet nginx et splice des globals
  `window.__QUIZONLINE_SENTRY_*` dans `index.html`.

## 2. Objectifs

1. Config runtime du frontend pilotée par **AWS SSM** (région `eu-west-1`),
   préfixe **dédié** `/pushit-frontend/prod/*` (pas de préfixe partagé →
   pas de collision avec QuizOnline ou le backend).
2. La config front est **publique** (servie au navigateur) → ce ne sont **pas**
   des secrets : type `String` uniquement (pas de `SecureString`), pas de
   `kms:Decrypt` requis dans l'IAM.
3. Mécanisme **Pattern A** (comme QuizOnline) : un script lit SSM → écrit un
   snippet nginx → nginx injecte les valeurs dans `index.html` via `sub_filter`
   → Angular lit les globals au démarrage (synchrone, avant bootstrap).
4. Unité systemd `oneshot` + `RemainAfterExit` qui fetch au boot, **avant** que
   nginx ne serve, et force le rôle d'instance EC2.
5. Vhost nginx versionné, reverse-proxy **supprimé** (l'API est désormais
   appelée en cross-origin).
6. **La CI re-fetch la conf à chaque déploiement** (le `deploy.sh` relance
   l'unité de fetch) : une rotation de valeur dans SSM est appliquée
   automatiquement, sans round-trip SSH manuel.
7. `deploy.sh`, `setup-server.sh` (nginx, remplace Apache) et CI alignés ;
   plus aucun secret côté CI (SSM = source de vérité).
8. Documentation dans le `CLAUDE.md` du repo.

## 3. Architecture

### 3.1 Chaîne complète (de SSM au navigateur)

```
[1] Poste local — seed-parameter-store.{sh,ps1}
        └─ put ─►  AWS SSM /pushit-frontend/prod/*  (String, eu-west-1)
                       API_BASE_URL, SENTRY_DSN, SENTRY_ENV,
                       SENTRY_RELEASE, FEATURES
[2] EC2 — fetch-frontend-runtime-from-ssm.sh  (au boot + à chaque deploy)
        └─ get-parameters-by-path (rôle d'instance, pas de clé sur disque)
        └─ écrit /etc/nginx/snippets/pushit-frontend-runtime.conf  (0644)
               set $pushit_api_base   "...";
               set $pushit_sentry_dsn "..."; ...
        └─ nginx -t  →  systemctl reload nginx
[3] nginx — à chaque requête de index.html (no-store)
        └─ sub_filter injecte <script>window.__PUSHIT_* = "..."</script>
[4] Angular — au démarrage
        └─ runtime-config.ts lit window.__PUSHIT_*  →  SettingsService / Sentry
```

**SSM est la source de vérité.** Le « snippet nginx » n'est qu'un format
intermédiaire interne (jamais exposé au navigateur) que nginx sait relire pour
injecter les valeurs dans la page.

### 3.2 Modèle d'origine : cross-origin

Le frontend (`pushit.foxugly.com`) appelle le backend
(`https://pushit-api.foxugly.com/api/v1`) en **cross-origin**. Le vhost frontend
ne reverse-proxie donc **plus** `/api`.

- `API_BASE_URL` devient une vraie valeur runtime (SSM).
- L'auth est JWT **Bearer** (pas de cookies) → pas de problème CSRF/cookie.
- **Prérequis backend (repo `PushIT_server`, hors de ce chantier — à signaler) :**
  le backend doit autoriser le CORS depuis `https://pushit.foxugly.com`
  (`CORS_ALLOWED_ORIGINS`), en autorisant l'en-tête `Authorization`.
- **Dev inchangé** : en local, le défaut inline `/api/v1` est proxifié par
  `proxy.conf.json` vers `127.0.0.1:8000` (same-origin). Le bundle est identique ;
  seul le global runtime diffère entre dev (absent → défaut) et prod (injecté).

### 3.3 Paramètres SSM (`/pushit-frontend/prod/*`, tous `String`)

| Clé | Exemple | Défaut si absent | Rôle |
|---|---|---|---|
| `API_BASE_URL` | `https://pushit-api.foxugly.com/api/v1` | `/api/v1` | Base des appels API |
| `SENTRY_DSN` | `https://abc@sentry.io/123` | `""` (SDK off) | Endpoint Sentry front |
| `SENTRY_ENV` | `production` | `production` | Environnement Sentry |
| `SENTRY_RELEASE` | `pushit-frontend-1.0.0` | `""` | Tag de release Sentry |
| `FEATURES` | `{}` | `{}` | Feature flags (placeholder, objet JSON) |

### 3.4 IAM (à faire en console — documenté ici)

Étendre le rôle d'instance **`quizonline-ec2`** avec `ssm:GetParametersByPath`
sur les **deux** ARNs (sinon `AccessDenied` — `GetParametersByPath` exige le
nœud nu **et** le wildcard) :

```
arn:aws:ssm:eu-west-1:362629935151:parameter/pushit-frontend/prod
arn:aws:ssm:eu-west-1:362629935151:parameter/pushit-frontend/prod/*
```

Pas de `kms:Decrypt` nécessaire (valeurs en `String`, pas `SecureString`).

## 4. Composants

### 4.1 Côté Angular (`src/`)

**`src/app/core/runtime-config.ts`** (nouveau)
- Lit `window.__PUSHIT_*` avec fallbacks build-time inline.
- Ordre de résolution : **global runtime → défaut inline**.
- Expose un objet typé : `{ apiBaseUrl, sentry: { dsn, env, release }, features }`.
- Défauts : `apiBaseUrl → '/api/v1'`, `sentry.dsn → ''` (off),
  `sentry.env → 'production'`, `sentry.release → ''`, `features → {}`.
- Lecture **synchrone** (les globals sont dans le DOM avant le bootstrap) — pas
  d'`APP_INITIALIZER`.
- Pas de fichiers `environment.ts` (YAGNI) : les défauts inline couvrent le dev.

**`src/sentry-init.ts`** (nouveau)
- Importé **en tête de `src/main.ts`, avant `bootstrapApplication`**, pour capter
  les crashs d'init.
- Lit la config runtime ; si `dsn` non vide, appelle `Sentry.init({ dsn, environment,
  release, integrations: [browserTracingIntegration()], tracePropagationTargets:
  [<origine API>] })`. **No-op si DSN vide** (cas dev / bootstrap sans SSM).

**`src/main.ts`** (modifié)
- `import './sentry-init';` en première ligne, avant tout le reste.

**`src/app/app.config.ts`** (modifié)
- Ajoute le provider Sentry : `{ provide: ErrorHandler, useValue:
  Sentry.createErrorHandler() }` et `Sentry.TraceService` (si tracing activé).

**`src/app/core/services/settings.service.ts`** (modifié)
- Le défaut d'URL API provient désormais de `runtime-config.ts` (au lieu du
  `'/api/v1'` codé en dur). La surcharge utilisateur via stockage reste
  prioritaire.

**`package.json`** (modifié)
- Ajout de la dépendance `@sentry/angular` (version compatible Angular 20).

**Tests** (`*.spec.ts`)
- Test unitaire de `runtime-config.ts` : résolution global → défaut, parsing de
  `features`, DSN vide = Sentry off. Maintient les seuils de couverture
  (statements 45 % / branches 30 % / functions 38 % / lines 45 %).

### 4.2 Côté deploy (`deploy/`)

**`deploy/fetch-frontend-runtime-from-ssm.sh`** (nouveau)
- `set -euo pipefail`.
- `aws ssm get-parameters-by-path --path /pushit-frontend/prod --recursive
  --region eu-west-1 --output json` → fichier temp.
- Parse en Python en lisant le JSON depuis un **fichier passé en argument**
  (jamais sur stdin : le heredoc EST déjà stdin).
- Pour chaque clé connue : **strip CRLF de fin** (`.strip("\r\n")`), **rejette**
  toute newline interne (corromprait la directive `set`).
- Mappe les clés sur les variables nginx, applique les **défauts** pour les clés
  absentes (cf. tableau 3.3).
- Écrit le snippet **atomiquement** (`tmp` → `install -m 0644 -o root -g root`).
- **Idempotence** : si le snippet est identique (`cmp -s`), ne recharge pas nginx.
- **Garde** : `nginx -t` avant le reload ; si KO, n'effectue pas le reload et
  sort non-zéro (le master tourne encore sur l'ancienne conf valide).
- `systemctl reload nginx`.

**`deploy/systemd/pushit-frontend-runtime-fetch.service`** (nouveau)
- `Type=oneshot`, `RemainAfterExit=yes`.
- `After=network-online.target nginx.service`, `Wants=network-online.target`.
- `User=root` (écrit `/etc/nginx/snippets/`, lance `nginx -t` et `reload`).
- `Environment=AWS_SHARED_CREDENTIALS_FILE=/dev/null`,
  `Environment=AWS_CONFIG_FILE=/dev/null`, `Environment=AWS_REGION=eu-west-1`
  (force le rôle d'instance `quizonline-ec2` ; sinon les clés statiques
  certbot-route53 de root masquent le rôle).
- Durcissement : `PrivateTmp=yes`, `ProtectSystem=full`,
  `ReadWritePaths=/etc/nginx/snippets`, `ProtectHome=yes`, `NoNewPrivileges=yes`,
  `RestrictSUIDSGID=yes`, `TimeoutStartSec=120`.
- `ExecStart=/var/www/django_websites/PushIT_frontend/deploy/fetch-frontend-runtime-from-ssm.sh`.
- `WantedBy=multi-user.target`.

**`deploy/nginx/pushit-frontend.conf`** (nouveau — remplace l'Apache)
- `server` :80 → redirect 301 vers https (certbot complète le bloc 443).
- `root /var/www/django_websites/PushIT_frontend/dist/pushit-frontend/browser;`
  (artefacts SPA, à l'intérieur du repo cloné — cf. §4.5).
- Défauts vides + include du snippet :
  ```nginx
  set $pushit_api_base       "";
  set $pushit_sentry_dsn     "";
  set $pushit_sentry_env     "production";
  set $pushit_sentry_release "";
  set $pushit_features       "{}";
  include /etc/nginx/snippets/pushit-frontend-runtime*.conf;   # glob tolère l'absence
  ```
- `location /` → `try_files $uri $uri/ /index.html;` (routing SPA).
- `location = /index.html` → `Cache-Control "no-store"` + injection :
  ```nginx
  sub_filter '</head>' '<script>window.__PUSHIT_API_BASE_URL="$pushit_api_base";window.__PUSHIT_SENTRY_DSN="$pushit_sentry_dsn";window.__PUSHIT_SENTRY_ENV="$pushit_sentry_env";window.__PUSHIT_SENTRY_RELEASE="$pushit_sentry_release";window.__PUSHIT_FEATURES=$pushit_features;</script></head>';
  sub_filter_once on;
  ```
  (`$pushit_features` injecté **sans** guillemets → littéral objet JS).
- `location ~* \.(js|css|woff2?|ttf|eot|svg|...)$` → `Cache-Control
  "public, immutable"; expires 1y;`.
- Headers de sécurité (HSTS, X-Content-Type-Options, X-Frame-Options,
  Referrer-Policy, Permissions-Policy), ré-émis dans les `location` qui posent
  leur propre `add_header` (non héritage nginx).
- **Pas de bloc `location /api/`** (cross-origin).

**`deploy/seed-parameter-store.sh`** + **`deploy/seed-parameter-store.ps1`** (nouveaux)
- Calqués sur le backend, **sans `SECRET_KEYS`** : tout est poussé en `String`.
- Préfixe `/pushit-frontend/prod`, région `eu-west-1`, `--overwrite`.
- Message de fin rappelant la procédure d'application (cf. §6).

**`deploy/deploy.sh`** (nouveau — promotion côté serveur)
- Appelé par la CI en SSH (remplace le heredoc inline de `deploy.yml`).
- `cd /var/www/django_websites/PushIT_frontend` ; `git fetch origin main` +
  `git reset --hard origin/main` (met à jour les scripts `deploy/` versionnés —
  `dist/` étant gitignoré, le reset ne touche pas les artefacts).
- Promeut le SPA : `rsync -a --delete /tmp/pushit-frontend-staging/
  dist/pushit-frontend/browser/`, `chown -R django:www-data`, `chmod -R g+rX`,
  `rm -rf` du staging.
- **Re-fetch de la conf** : `sudo systemctl restart pushit-frontend-runtime-fetch`
  (relit SSM → réécrit le snippet → reload nginx). Une rotation SSM est ainsi
  appliquée à chaque deploy.

**`deploy/setup-server.sh`** (réécrit — nginx, remplace la version Apache)
- **Migration vers le clone git** (cf. §4.5) : convertit l'ancien dossier
  d'artefacts en clone du repo `PushIT_frontend` (`django:www-data`), crée
  `dist/pushit-frontend/browser/` (traversable). Idempotent (`git reset` si déjà
  cloné).
- Installe le vhost nginx, `nginx -t`, `reload`.
- `certbot --nginx -d pushit.foxugly.com` (non-interactif).
- Installe + `enable` + `start` `pushit-frontend-runtime-fetch.service` (premier
  fetch). Échoue clairement si SSM non seedé / rôle non autorisé.
- Sudoers pour le user de deploy :
  `rsync … <TARGET>/`, `chown/chmod <TARGET>/`,
  `systemctl reload nginx`, **`systemctl restart pushit-frontend-runtime-fetch`**.
- Idempotent.

**`deploy/pushit.foxugly.com.conf`** (supprimé — ancien vhost Apache).

### 4.3 CI (`.github/workflows/deploy.yml`) (modifié)

- Build (`npm ci` + `npm run build`) + vérif de l'artefact (inchangé).
- Rsync `dist/pushit-frontend/browser/` → `/tmp/pushit-frontend-staging/`.
- `ssh … 'sudo /…/deploy/deploy.sh'` (au lieu du heredoc inline) → promotion
  **+ re-fetch de la conf**.
- Smoke test HTTPS (inchangé).
- Rsync `dist/pushit-frontend/browser/` → `/tmp/pushit-frontend-staging/` puis
  `ssh … deploy.sh` (qui promeut vers `…/PushIT_frontend/dist/pushit-frontend/browser/`).
- **Aucun secret de config** dans la CI (SSM = source de vérité). Secrets CI
  conservés : `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY` (accès SSH uniquement).

### 4.5 Arborescence serveur (décision : Option A)

Le dossier au nom du repo héberge le **clone git**, symétrique avec
`PushIT_server/` et avec QuizOnline (qui sert depuis `dist/…/browser/` à
l'intérieur du repo cloné) :

```
/var/www/django_websites/PushIT_frontend/            ← clone git du repo (django:www-data)
        deploy/                                       ← scripts + unité systemd (ExecStart pointe ici)
        dist/pushit-frontend/browser/                 ← artefacts SPA (gitignorés, cible rsync, root nginx)
```

- nginx `root` = `…/PushIT_frontend/dist/pushit-frontend/browser`.
- La CI build en GitHub Actions (jamais sur l'EC2) et rsync le `browser/` dans ce
  `dist/`. `dist/` est gitignoré → le `git reset --hard` de `deploy.sh` ne le
  touche pas.
- **Migration one-time** (dans `setup-server.sh`) : l'actuel
  `/var/www/django_websites/PushIT_frontend/` ne contient que des artefacts (pas
  de `.git`). Le setup le convertit en clone : déplacer l'ancien dossier
  (`PushIT_frontend` → `old/` ou suppression), `git clone` du repo à sa place
  (owner `django`), créer `dist/pushit-frontend/browser/`. Idempotent : si `.git`
  est déjà présent, faire `git fetch/reset` au lieu de re-cloner.

### 4.4 Documentation (`CLAUDE.md`) (modifié)

Ajout d'une section « Déploiement » : la chaîne SSM → snippet → injection →
Angular, le préfixe `/pushit-frontend/prod/*` (String, public), la note IAM
(deux ARNs), le modèle cross-origin + prérequis CORS backend, et le runbook
opérationnel (§6) — dont le fait qu'un **deploy de code applique** les
changements de conf SSM (re-fetch automatique).

## 5. Pièges à éviter (retours du backend)

1. `GetParametersByPath` exige le chemin **nu** ET le **wildcard** dans la policy.
2. Parsing JSON SSM en Python : lire les données depuis un **fichier en argument**,
   jamais sur stdin (le heredoc EST stdin).
3. **Strip `\r`/`\n` de fin** de valeur (artefact CRLF des `.env` édités sous
   Windows) ; rejeter toute newline **interne**.
4. Le répertoire de conf doit être traversable par l'utilisateur qui sert/lit le
   fichier (snippet `0644` dans `/etc/nginx/snippets`, dossier root standard).
5. Ne **jamais** utiliser `RuntimeDirectory=` pour le dossier de conf (l'arrêt de
   l'unité supprimerait le dossier et la conf). Le snippet vit dans
   `/etc/nginx/snippets/`, possédé par root, hors de toute unité.
6. nginx, **pas** Apache (Apache est retiré). Instance EC2 unique = un seul rôle
   (`quizonline-ec2`), partagé backend + QuizOnline + frontend.
7. Le `rsync --delete` du déploiement ne touche **que** le dossier des artefacts
   SPA ; le snippet (dans `/etc/nginx/`) n'est jamais effacé.

## 6. Runbook opérationnel

**Changer une valeur de conf (ex. rotation de DSN Sentry) :**
1. Éditer le `.env` local, `bash deploy/seed-parameter-store.sh ./prod.env`
   (ou `.ps1` sous Windows) → pousse dans SSM.
2. Appliquer, au choix :
   - **soit** déclencher un déploiement (la CI re-fetch automatiquement) ;
   - **soit**, hors déploiement, sur l'EC2 :
     `sudo systemctl restart pushit-frontend-runtime-fetch`
     (relit SSM → réécrit le snippet → `nginx -t` → `reload nginx`).

**Setup initial (one-time) :** seed SSM → étendre l'IAM (2 ARNs) →
`setup-server.sh` (vhost + certbot + unité fetch) → premier déploiement.

## 7. Critères de succès

- `https://pushit.foxugly.com` sert le SPA ; `index.html` est en `no-store` et
  contient le `<script>window.__PUSHIT_*…</script>` avec les valeurs SSM.
- Les appels API partent vers `https://pushit-api.foxugly.com/api/v1` (cross-origin,
  CORS OK).
- Sentry reçoit les erreurs front quand `SENTRY_DSN` est seedé ; aucun appel
  Sentry quand il est vide.
- Un `seed` + déploiement (ou `systemctl restart` de l'unité) applique une
  nouvelle valeur **sans rebuild** du frontend.
- `npm run test:ci` passe (seuils de couverture tenus).
- Aucun secret de config dans la CI ni sur le disque de l'EC2 (hors clé SSH).

## 8. Hors périmètre

- Le changement `CORS_ALLOWED_ORIGINS` côté backend `PushIT_server` (repo
  distinct — signalé comme prérequis, à faire en passe séparée).
- La création de feature flags concrets (`FEATURES` reste `{}` placeholder).
- Le tracing Sentry avancé (performance, profiling) au-delà de
  `browserTracingIntegration` basique.
