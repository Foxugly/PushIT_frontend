# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PushIT is a push notification management platform. This repository is the **Angular frontend** that communicates with a Django REST backend at `http://127.0.0.1:8000`. The backend API is proxied through `/api` in development via `proxy.conf.json`.

## Commands

- **Dev server:** `npm start` (serves at `http://localhost:4200`, proxies `/api` to backend, HMR disabled)
- **Dev server with HMR:** `npm run start:hmr`
- **Build:** `npm run build`
- **Unit tests:** `npm test` (Karma + Jasmine, watches by default)
- **Unit tests (CI):** `npm run test:ci` (headless Chrome, coverage check)
- **E2E tests:** `npm run test:e2e` (builds then runs Playwright against Chromium)
- **Single test file:** `ng test --include=**/path-to-spec.ts`

## Coverage Thresholds

Enforced by `scripts/check-coverage.mjs`: statements 45%, branches 30%, functions 38%, lines 45%.

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
- **Auth flow** — JWT with access/refresh tokens; interceptor auto-refreshes on 401; `SKIP_AUTH` HttpContext token bypasses auth for login/register endpoints
- **i18n** — Trilingual (FR/NL/EN), default French; `PublicI18nService` manages language; `ConsoleCopyService` and `AppCopyService` provide translated strings via signals
- **API service** — `PushitApiService` is the single point of contact for all HTTP calls; all endpoints return typed `Observable`s

### Component File Convention
Components use single-file-name pattern (e.g., `about-page.ts` contains the component class, with co-located `about-page.html` and `about-page.scss`). No `.component` suffix in filenames.

## Déploiement (prod : pushit.foxugly.com)

Hébergé sur l'EC2 partagée (cohabite avec PushIT_server + QuizOnline), servi par
**nginx**, TLS via `certbot --nginx`. Le repo est cloné dans
`/var/www/django_websites/PushIT_frontend/` ; le SPA est servi depuis
`dist/pushit-frontend/browser/` (artefacts rsync'és par la CI, gitignorés).

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

Paramètres : `API_BASE_URL`, `SENTRY_DSN`, `SENTRY_ENV`, `SENTRY_RELEASE`,
`FEATURES` (objet JSON, placeholder `{}`).

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

**Rôle d'instance `quizonline-ec2`** — `ssm:GetParametersByPath` sur les **deux**
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
