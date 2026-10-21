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
  - **Diagnostiquer un échec e2e en CI** : le job archive `playwright-report` et
    `playwright-traces` (uniquement `if: failure()`). Télécharger le second et ouvrir
    la trace avec `npx playwright show-trace trace.zip` — DOM, réseau et console à
    chaque étape. Pas de `retries` sur CI, délibérément : un retry masquerait les
    tests instables au lieu de les signaler.
  - **Piège** : ne jamais enchaîner un `click` qui change de formulaire et un `fill`
    sans attendre le nouveau bloc. `auth-page.html` rend deux `input[type="email"]`
    (`@if (!magicMode())` / `@else`) ; le `fill` pouvait atterrir dans celui qui
    allait disparaître. Attendre un élément propre au nouveau bloc, puis verrouiller
    la saisie avec `toHaveValue`.
- **Single test file:** `ng test --include=**/path-to-spec.ts`

## Coverage Thresholds

Enforced by `scripts/check-coverage.mjs`: statements 45%, branches 30%, functions 38%, lines 45%.
Le chemin du rapport a changé trois fois (karma → `coverage/<projet>/`, vitest sous Angular 20 →
`coverage/`, Angular 21 → `coverage/<projet>/`). Le script prend donc toujours le fichier le plus
**récent** et affiche lequel : choisir par ordre de préférence laissait un rapport périmé masquer
le rapport frais, et le seuil était vérifié contre de vieux chiffres.

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
- Angular 21 with standalone components (no NgModules)
- PrimeNG 21 (Aura theme) for UI components
- SCSS for component styles
- Strict TypeScript (`strict: true`, `strictTemplates: true`)

### Directory Structure (`src/app/`)
- **`core/`** — Singleton services, guards, interceptors, models, and utilities
  - `models/api.models.ts` — All API request/response TypeScript interfaces
  - `services/pushit-api.service.ts` — Central HTTP client wrapping all backend endpoints
  - `services/session.service.ts` — auth state via Angular signals: access token + user **in memory only**; the refresh token is an HttpOnly cookie set by the backend (see Auth flow)
  - `services/settings.service.ts` — Configurable API base URL (default `/api/v1`)
  - `interceptors/auth.interceptor.ts` — Attaches Bearer token, handles 401 with automatic token refresh
  - `guards/auth.guard.ts` — `authGuard` (requires login) and `guestGuard` (requires logged-out)
- **`features/`** — Lazy-loaded feature pages, organized by route
  - `public/` — Public layout (home, about, features, donate)
  - `auth/`, `register/`, `forgot-password/` — Auth flows (guest-only routes)
  - `console/` — Authenticated dashboard with sub-pages: applications, devices, notifications, quiet-periods, settings (« Mon compte » : compte, sécurité = `ChangePasswordPanel`, zone de danger ; `dashboard/change-password` redirige vers `dashboard/settings#security`)
- **`shared/`** — Reusable UI components (alert, confirm dialog, emoji picker, header, footer, register panel)

### Key Patterns
- **All components are standalone** — use `imports` array in `@Component`, no shared modules
- **Signals-based state** — services use Angular signals (`signal()`, `computed()`) rather than BehaviorSubject
- **Lazy loading** — all routes use `loadComponent` with dynamic imports
- **Auth flow (HttpOnly refresh cookie, 2026-10-18 — fleet pilot, design in PushIT_server `CLAUDE.md`)** — the refresh token is **never** visible to JavaScript: auth calls (login, magic-link verify, email confirm, refresh, logout, password change, `DELETE me`) send `X-Auth-Mode: cookie` + `withCredentials` (`core/http/auth-cookie.ts`, only on those calls), and the backend sets/rotates/clears an `HttpOnly; Secure; SameSite=Lax` cookie scoped to `/api/v1/auth/` on the API host, leaving `refresh` out of the body. The **access token and user live in memory only**. On load, the app initializer runs `SessionService.restore()`: `POST auth/refresh/` (cookie) then `GET auth/me/` — only when the non-secret `pushit.session` hint (localStorage) says a session exists, bounded by a 10 s timeout. "Remember me" is sent as `remember_me` at login (unchecked = browser-session cookie). The interceptor attaches the Bearer, refreshes through the cookie on 401 and clears the session only when `auth/refresh/` answers 401/403 (a network error / 5xx keeps it). **Multi-tab**: the refresh runs under a Web Lock (`pushit.refresh`) so two tabs never present the same cookie (rotation would reject the second); `storage` events on `pushit.session` carry only "session changed" (other tabs re-restore from the shared cookie) or "logged out" (removed → other tabs drop memory and go to `/auth`), never a token. **Migration**: a pre-cookie `pushit.refreshToken` left in local/session storage is presented once in the refresh body (with the cookie opt-in, so the rotated token lands in the cookie), then `pushit.accessToken/refreshToken/user` are deleted (also deleted on 401/403; kept on a network error). **Change password**: the backend blacklists every refresh token, re-sets the cookie and returns a fresh access token adopted via `SessionService.adoptTokens`. **Logout** posts without Bearer (cookie only), so an expired access token cannot turn it into a 401. Turnstile's `api.js` is injected on demand by `TurnstileController.render()` (not in `index.html`). CI runs `npm run test:ci` as the **Unit tests** job (also a deploy gate). E2E: `seedAuthenticatedSession` adds the `pushit_refresh` cookie with `context.addCookies` + the hint; `mockConsoleApi` answers `auth/refresh/` (401 without cookie/header) and `auth/logout/`.
- **Admin area** — `dashboard/admin` (lazy, `canActivate: [adminGuard]`) is staff-only. `SessionService.isAdmin` reads `user().is_staff` (surfaced by `/me/`); the nav entry and route are both gated on it. The page renders the backend health panel from `GET /admin/status/` (DB / Celery broker+workers / Exchange + metrics) and links to the Django admin. The **Django admin URL** is derived from `SettingsService.apiBaseUrl()` by stripping `/api/v1` → backend origin + `/admin/`. Owners can also verify an app's inbound-email alias from the application detail page (`GET apps/<id>/alias-status/`).
- **Application detail tabs** — `/dashboard/applications/:appId` is a PrimeNG `p-tabs` page whose active tab lives in `?tab=` (`overview` = default/absent, `recipients`, `sending`, `notifications`, `quiet-periods`; unknown — incl. the former `settings` — → overview). Switching tabs rewrites the param with `replaceUrl` (Back leaves the page, it does not step through tabs). Aperçu = counters, legacy warning, inline name/description, logo, activate/deactivate, facts table and the danger zone (delete → list) — the former Paramètres tab was merged into it (2026-10-21); Destinataires = enrolment + linked devices; Envoi = send tokens, legacy app-token regenerate/revoke, inbound e-mail (+ `InboundSenderPolicyPanel` « Qui peut envoyer par e-mail » : owner/anyone, allow/block lists (`alice@x.com`, `@x.com` = exact domain, `@*.x.com` = domain + subdomains; formats explained on an info-icon tooltip), refusal notices — its own PATCH; + `InboundEmailLogPanel` « Mails reçus » : `GET apps/<id>/inbound-email-logs/` (last 50, refusal codes mapped to readable reasons), loaded the first time the Envoi tab is shown, then on « Actualiser »), code examples and the one-time `<app-token-reveal>` (auto-opened when a token was just minted for the app and no `tab` is given; create lands on `?tab=sending`); Notifications = list + « Nouvelle notification » → `/dashboard/notifications?app=<id>&create=1` (opens the create modal pre-selected, then drops the params). `applications/:appId/edit` redirects to the overview; `ApplicationFormPage` is create-only. The list row opens the app on click and only keeps QR d'enrôlement / activer-désactiver / ouvrir. All tab panels are rendered (not lazy), hidden by `p-tabpanel` — e2e must select the tab (or `goto ?tab=`) before asserting visibility. **Unsaved edits (2026-10-21)**: each form keeps its own draft — a reload of the application (another section's save, toggle, logo…) re-seeds a form **only while it is pristine** (`settingsForm.dirty`; the policy panel's `dirty()` compares the normalized form with what was last loaded), and a form is reset after its own save. Since panels are only hidden, tab switches keep drafts and never prompt (query-param navigations do not run CanDeactivate). Leaving the route with a draft → `unsavedChangesGuard` (`core/guards/unsaved-changes.guard.ts`, `HasUnsavedChanges`) asks through `AppConfirmService` (copy `console.unsavedChanges`; skipped once logged out or after deleting the app); closing/reloading the browser tab → `beforeunload`. A « Modifications non enregistrées » hint sits by each dirty section's save button.
- **Account deletion** — Mon compte → « Zone de danger » (`DeleteAccountPanel`, `p-confirmdialog` with the password inside) calls `DELETE /auth/me/ {current_password}`; on 204 the backend has already blacklisted every refresh token, so the SPA only drops the local session (no `logout` call) and lands on `/`. **`/account-deletion` is the public URL registered in the Google Play Data safety form — do not rename it**; the privacy page links to it.
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

Le fetch **refuse** (exit 1, snippet précédent conservé) toute valeur scalaire hors
`[A-Za-z0-9:/._@+-]` — elle est injectée entre guillemets dans le `<script nonce>` —
et ne garde de `FEATURES` qu'un objet plat `{nom: booléen}` qu'il re-sérialise (sinon `{}`).

**Release Sentry** : la CI fige le SHA dans le bundle (`ng build --define
PUSHIT_BUILD_SHA=...`, lu par `src/app/core/build-info.ts`) → release
`pushit-frontend@<sha>`, qui **prime** sur `SENTRY_RELEASE` (SSM, désormais simple
repli hors CI). Le build prod émet des source maps **hidden** ; `deploy.yml` les
envoie à Sentry (org `foxugly-srl`, projet `pushit-frontend`, `de.sentry.io`) **si**
le secret `SENTRY_AUTH_TOKEN` existe, puis les **supprime** du bundle (le vhost
renvoie aussi 404 sur `*.map`). Les URLs portant un jeton (reset / confirm-email /
magic-link, params `uid`/`token`/`code`) sont masquées avant envoi
(`src/app/core/sentry-scrub.ts`).

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
`EC2_INSTANCE_ID`, `S3_DEPLOY_BUCKET`, + optionnel `SENTRY_AUTH_TOKEN` (upload des source maps) (plus de `EC2_SSH_KEY`/`EC2_HOST`/`EC2_USER`).
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
(access JWT en Bearer ; refresh en cookie HttpOnly sur les seuls appels d'auth).
Prérequis backend (repo PushIT_server) : `CORS_ALLOWED_ORIGINS` doit inclure
`https://pushit.foxugly.com` (liste explicite : credentials autorisés, et c'est
aussi la liste des `Origin` acceptées en mode cookie), `x-auth-mode` dans les
en-têtes autorisés. Les deux hôtes sont *same-site* (`foxugly.com`), d'où
`SameSite=Lax` suffisant. Rien à changer côté nginx/CSP (`connect-src` couvre déjà l'API).

### Setup initial (one-time)

```bash
sudo bash deploy/setup-server.sh <DEPLOY_USER>   # ex. ubuntu
```
(après avoir seedé SSM et étendu l'IAM). Voir
`docs/superpowers/specs/2026-06-02-frontend-runtime-config-ssm-design.md`.
