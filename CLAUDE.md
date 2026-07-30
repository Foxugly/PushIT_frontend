# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PushIT is a push notification management platform. This repository is the **Angular frontend** that communicates with a Django REST backend at `http://127.0.0.1:8000`. The backend API is proxied through `/api` in development via `proxy.conf.json`.

## Commands

- **Dev server:** `npm start` (serves at `http://localhost:4200`, proxies `/api` to backend, HMR disabled)
- **Dev server with HMR:** `npm run start:hmr`
- **Build:** `npm run build`
- **Unit tests:** `npm test` (Vitest via `@angular/build:unit-test`, watches by default)
- **Unit tests (CI):** `npm run test:ci` (jsdom, coverage check)
- **E2E tests:** `npm run test:e2e` (builds then runs Playwright against Chromium)
- **Single test file:** `ng test --include=**/path-to-spec.ts`

## Coverage Thresholds

Enforced by `scripts/check-coverage.mjs`: statements 45%, branches 30%, functions 38%, lines 45%.
Le rapport est lu depuis `coverage/coverage-summary.json` (vitest) ; l'ancien chemin karma
`coverage/pushit-frontend/` reste accepté en repli.

## Tests : karma → vitest (2026-07-30)

Le runner est passé de karma/jasmine à **vitest**, pour sortir de karma 6.4 (déprécié, et il
tirait une chaîne `glob 7 → minimatch 3 → brace-expansion 1.x` responsable de 9 alertes
Dependabot *high* sans correctif possible dans ces lignes majeures).

Les 28 specs n'ont **pas** été réécrits : `src/testing/jasmine-compat.ts` mappe
`jasmine.createSpyObj` / `createSpy` / `objectContaining` / `any`, `spyOn`, `.and.*`,
`spy.calls` et les matchers `toBeTrue` / `toBeFalse` / `toHaveBeenCalledOnceWith` sur leurs
équivalents vitest. Les nouveaux specs doivent utiliser l'**API vitest native** (`vi.fn()`,
`vi.spyOn`, `mockReturnValue`) ; le shim disparaîtra quand les 28 fichiers seront convertis.

Pièges découverts pendant la bascule, à connaître :

- **`fakeAsync` / `tick` ne fonctionnent pas.** zone.js ne publie des patches que pour
  jasmine, mocha et jest — **aucun pour vitest** — donc aucun ProxyZone n'est installé.
  Utiliser `vi.useFakeTimers()` + `await vi.advanceTimersByTimeAsync(n)`, et les installer
  **avant** le code qui arme le minuteur.
- **`src/testing/test-setup.ts`** comble ce que jsdom n'a pas et que Chrome fournissait :
  `ResizeObserver` (PrimeNG `p-tabs`), `document.execCommand`, `URL.createObjectURL`, et
  **épingle `navigator.language` à `fr-FR`** — `PublicI18nService` le lit, jsdom répond
  `en-US`, et les specs qui assertent une chaîne française échouaient.
- **Ne pas stubber `document.createElement` sans condition** : Angular l'appelle pendant le
  rendu et jsdom lève `HierarchyRequestError`. Filtrer sur la balise voulue.
- **Un `.d.ts` ne doit pas partager son nom de base avec un `.ts`** : TypeScript ignore alors
  le `.d.ts` (il le prend pour la déclaration générée). D'où `jasmine-globals.d.ts` à côté de
  `jasmine-compat.ts`.

## Architecture

### Stack
- Angular 20 with standalone components (no NgModules)
- PrimeNG 20 (Aura theme) for UI components
- SCSS for component styles
- Strict TypeScript (`strict: true`, `strictTemplates: true`)

### Directory Structure (`src/app/`)
- **`core/`** — Singleton services, guards, interceptors, models, and utilities
  - `models/api.models.ts` — All API request/response TypeScript interfaces
  - `services/pushit-api.service.ts` — Central HTTP client wrapping all backend endpoints
  - `services/session.service.ts` — JWT auth state (access/refresh tokens, user) via Angular signals, persisted to local/session storage
  - `services/settings.service.ts` — Configurable API base URL (default `/api/v1`)
  - `interceptors/auth.interceptor.ts` — Attaches Bearer token, handles 401 with automatic token refresh
  - `guards/auth.guard.ts` — `authGuard` (requires login) and `guestGuard` (requires logged-out)
- **`features/`** — Lazy-loaded feature pages, organized by route
  - `public/` — Public layout (home, about, features, donate)
  - `auth/`, `register/`, `forgot-password/` — Auth flows (guest-only routes)
  - `console/` — Authenticated dashboard with sub-pages: applications, devices, notifications, quiet-periods, settings, change-password
- **`shared/`** — Reusable UI components (alert, confirm dialog, emoji picker, header, footer, register panel)

### Key Patterns
- **All components are standalone** — use `imports` array in `@Component`, no shared modules
- **Signals-based state** — services use Angular signals (`signal()`, `computed()`) rather than BehaviorSubject
- **Lazy loading** — all routes use `loadComponent` with dynamic imports
- **Auth flow** — JWT with access/refresh tokens; interceptor auto-refreshes on 401; `SKIP_AUTH` HttpContext token bypasses auth for login/register endpoints. The backend **rotates + blacklists** the refresh token on every `auth/refresh/`, so `SessionService.refreshAccessToken` MUST persist the returned `refresh` (it does) — otherwise the next refresh 401s and silently logs the user out. Refresh lifetime is long (365 d) → sessions stay alive like a native app as long as the SPA is opened within the window.
- **Admin area** — `dashboard/admin` (lazy, `canActivate: [adminGuard]`) is staff-only. `SessionService.isAdmin` reads `user().is_staff` (surfaced by `/me/`); the nav entry and route are both gated on it. The page renders the backend health panel from `GET /admin/status/` (DB / Celery broker+workers / Exchange + metrics) and links to the Django admin. The **Django admin URL** is derived from `SettingsService.apiBaseUrl()` by stripping `/api/v1` → backend origin + `/admin/`. Owners can also verify an app's inbound-email alias from the application detail page (`GET apps/<id>/alias-status/`).
- **i18n** — Trilingual (FR/NL/EN), default French; `PublicI18nService` manages language; `ConsoleCopyService` and `AppCopyService` provide translated strings via signals
- **API service** — `PushitApiService` is the single point of contact for all HTTP calls; all endpoints return typed `Observable`s

### Component File Convention
Components use single-file-name pattern (e.g., `about-page.ts` contains the component class, with co-located `about-page.html` and `about-page.scss`). No `.component` suffix in filenames.

## Déploiement (prod : pushit.foxugly.com)

Hébergé sur l'EC2 partagée (cohabite avec PushIT_server + QuizOnline), servi par
**nginx**, TLS via `certbot --nginx`. Le repo est cloné dans
`/var/www/django_websites/PushIT_frontend/` ; le SPA est servi depuis
`dist/pushit-frontend/browser/` (artefacts rsync'és par la CI, gitignorés).

**Admin Django** : le vhost (`deploy/nginx/pushit-frontend.conf`) redirige (301)
`pushit.foxugly.com/admin` → `https://pushit-api.foxugly.com/admin/` (l'admin
canonique du backend, où ses cookies de session/CSRF et `/static/admin/` sont
déjà servis). On redirige plutôt qu'on ne reverse-proxy pour ne pas éclater les
cookies de l'admin sur deux hôtes. ⚠️ Le deploy installe le vhost depuis le blob
git mais **ne recharge pas toujours nginx** — après un changement de template,
vérifier la conf live et `sudo systemctl reload nginx` au besoin (drift connu,
cf. l'historique `/media/`).

### Config runtime (publique) via AWS SSM — Pattern A

La config front (URL d'API, Sentry, feature flags) est **publique** et lue au
**runtime**, pas au build. Source de vérité : **AWS SSM** `/pushit-frontend/prod/*`
(région `eu-west-1`), **tout en `String`** (jamais de secret, jamais SecureString).

Chaîne : `seed-parameter-store.{sh,ps1}` pousse un `.env` local dans SSM →
`fetch-frontend-runtime-from-ssm.sh` lit SSM et écrit le snippet
`/etc/nginx/snippets/pushit-frontend-runtime.conf` (`set $pushit_* "...";`) →
nginx injecte `window.__PUSHIT_*` dans `index.html` via `sub_filter` →
`src/app/core/runtime-config.ts` lit ces globals au démarrage (défauts inline en
dev). Sentry est initialisé dans `src/sentry-init.ts` avant le bootstrap.

Paramètres : `API_BASE_URL`, `TURNSTILE_SITE_KEY` (clé publique du widget
Cloudflare Turnstile — captcha sur l'inscription ; vide = widget masqué et
captcha non requis, le backend étant gated sur son secret de la même façon),
`SENTRY_DSN`, `SENTRY_ENV`, `SENTRY_RELEASE`, `FEATURES` (objet JSON,
placeholder `{}`).

### Appliquer un changement de config

```bash
# 1. pousser la nouvelle valeur dans SSM
bash deploy/seed-parameter-store.sh ./prod.env        # ou .ps1 sous Windows
# 2a. soit déclencher un déploiement : la CI relance le fetch automatiquement
# 2b. soit, hors déploiement, sur l'EC2 :
sudo systemctl restart pushit-frontend-runtime-fetch   # relit SSM + reload nginx
```

Un **déploiement de code applique** les changements SSM (`deploy.sh` relance
l'unité de fetch). L'unité est `oneshot`+`RemainAfterExit` : elle ne re-fetch pas
seule à l'exécution.

### Pipeline de déploiement

La CI (`.github/workflows/deploy.yml`) build en GitHub Actions puis déploie via
**GitHub OIDC → SSM + bundle S3** (aucune clé SSH longue durée), comme le reste
de la fleet (OPERATIONS.md §3.11) : le job `build-and-deploy` (gated par l'e2e,
`environment: production`) build + precompress, **tar le bundle → S3**
(`s3://<bucket>/builds/pushit-frontend/<sha>.tar.gz`, via un rôle OIDC), puis
`aws ssm send-command` (AWS-RunShellScript, **root**) qui : (1) `git reset` en
`django` (maj des sources `deploy/`), (2) installe l'unité / le script de fetch
root / le vhost nginx **depuis le blob git committé** (jamais l'arbre django →
§3.10), (3) **pull le bundle depuis S3** via le rôle d'instance (creds certbot
blankées) et l'**atomic-swap** dans `dist/pushit-frontend/browser/`, (4) restart
`pushit-frontend-runtime-fetch` (relit SSM + `nginx -t` + reload), (5) normalise
les perms. L'unité de fetch exécute `/usr/local/sbin/pushit-frontend-runtime-fetch.sh`
(**root:root, hors arbre applicatif**) — un RCE du process web (`django`) ne peut
influencer aucun code exécuté en root. **Secrets CI** : `AWS_DEPLOY_ROLE_ARN`,
`EC2_INSTANCE_ID`, `S3_DEPLOY_BUCKET` (plus de `EC2_SSH_KEY`/`EC2_HOST`/`EC2_USER`).
`deploy/deploy.sh` (modèle rsync, et le sudoers `pushit-frontend-deploy` /
l'authorized_keys de django) sont **obsolètes** depuis la bascule OIDC.

### IAM

**Rôle d'instance `foxugly-fleet-ec2`** — `ssm:GetParametersByPath` sur les **deux**
ARNs (le nœud nu ET le wildcard — sinon `AccessDenied`), + `s3:GetObject` pour
pull le bundle (depuis la bascule OIDC) :

```
arn:aws:ssm:eu-west-1:362629935151:parameter/pushit-frontend/prod
arn:aws:ssm:eu-west-1:362629935151:parameter/pushit-frontend/prod/*
arn:aws:s3:::<bucket>/builds/pushit-frontend/*        (s3:GetObject)
```
Pas de `kms:Decrypt` (config en String public).

**Rôle OIDC `pushit-frontend-deploy`** (déploiement, off-box) — trust pinné à
`repo:Foxugly/PushIT_frontend:environment:production` ; perms : `ssm:SendCommand`
(instance + doc `AWS-RunShellScript`), `ssm:GetCommandInvocation`, `s3:PutObject`
sur `<bucket>/builds/pushit-frontend/*`.

### Cross-origin / CORS

Le front appelle `https://pushit-api.foxugly.com/api/v1` en **cross-origin**
(auth JWT Bearer, pas de cookie). Prérequis backend (repo PushIT_server) :
`CORS_ALLOWED_ORIGINS` doit inclure `https://pushit.foxugly.com`.

### Setup initial (one-time)

```bash
sudo bash deploy/setup-server.sh <DEPLOY_USER>   # ex. ubuntu
```
(après avoir seedé SSM et étendu l'IAM). Voir
`docs/superpowers/specs/2026-06-02-frontend-runtime-config-ssm-design.md`.
