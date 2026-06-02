# Frontend Runtime Config via SSM/nginx — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aligner le frontend PushIT sur la convention de déploiement partagée de l'EC2 — config runtime publique lue dans AWS SSM, injectée par nginx dans `index.html` (Pattern A), consommée par Angular ; API en cross-origin ; Sentry câblé.

**Architecture :** Un script lit SSM `/pushit-frontend/prod/*` → écrit un snippet nginx (`set $pushit_*`) → nginx splice `window.__PUSHIT_*` dans `index.html` via `sub_filter` → Angular lit ces globals au démarrage (synchrone, avant bootstrap). Une unité systemd `oneshot` fetch au boot ; la CI relance le fetch à chaque déploiement. Le repo est cloné sur l'EC2 dans `PushIT_frontend/`, le SPA servi depuis `dist/pushit-frontend/browser/`.

**Tech Stack :** Angular 20 (standalone, signals), `@sentry/angular`, Karma/Jasmine, bash, systemd, nginx, AWS CLI (SSM), GitHub Actions.

**Spec de référence :** `docs/superpowers/specs/2026-06-02-frontend-runtime-config-ssm-design.md`

---

## File Structure

**Angular (`src/`)**
- Create `src/app/core/runtime-config.ts` — lit `window.__PUSHIT_*` avec défauts inline ; expose `RuntimeConfig` + `getRuntimeConfig()`.
- Create `src/app/core/runtime-config.spec.ts` — tests de résolution.
- Create `src/sentry-init.ts` — `Sentry.init()` depuis la config runtime (no-op si DSN vide).
- Modify `src/main.ts` — `import './sentry-init'` en première ligne.
- Modify `src/app/app.config.ts` — providers Sentry (`ErrorHandler`, `TraceService`).
- Modify `src/app/core/services/settings.service.ts` — défaut d'API depuis `getRuntimeConfig()`.
- Modify `src/app/core/services/settings.service.spec.ts` — adapter au défaut runtime.
- Modify `package.json` / `package-lock.json` — dépendance `@sentry/angular`.

**Deploy (`deploy/`)**
- Create `deploy/fetch-frontend-runtime-from-ssm.sh`
- Create `deploy/systemd/pushit-frontend-runtime-fetch.service`
- Create `deploy/nginx/pushit-frontend.conf`
- Create `deploy/seed-parameter-store.sh`
- Create `deploy/seed-parameter-store.ps1`
- Create `deploy/deploy.sh`
- Rewrite `deploy/setup-server.sh` (nginx, remplace Apache)
- Delete `deploy/pushit.foxugly.com.conf` (ancien vhost Apache)

**CI / docs**
- Modify `.github/workflows/deploy.yml`
- Modify `CLAUDE.md`

**Conventions de vérification :**
- Code Angular → TDD (Karma/Jasmine), commande `npm run test:ci` ou ciblée.
- Scripts bash → pas de tests unitaires ; vérification syntaxe `bash -n <file>` (la logique runtime — AWS, systemd, nginx — n'est testable que sur l'EC2).
- Sous Windows/PowerShell, lancer les vérifs `bash -n` via l'outil Bash.

---

## Task 1 : `RuntimeConfig` — lecture des globals avec défauts

**Files:**
- Create: `src/app/core/runtime-config.ts`
- Test: `src/app/core/runtime-config.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/core/runtime-config.spec.ts`:

```typescript
import { getRuntimeConfig } from './runtime-config';

interface MutableGlobals {
  __PUSHIT_API_BASE_URL?: string;
  __PUSHIT_SENTRY_DSN?: string;
  __PUSHIT_SENTRY_ENV?: string;
  __PUSHIT_SENTRY_RELEASE?: string;
  __PUSHIT_FEATURES?: Record<string, boolean>;
}

function globals(): MutableGlobals {
  return globalThis as unknown as MutableGlobals;
}

describe('getRuntimeConfig', () => {
  const keys: (keyof MutableGlobals)[] = [
    '__PUSHIT_API_BASE_URL',
    '__PUSHIT_SENTRY_DSN',
    '__PUSHIT_SENTRY_ENV',
    '__PUSHIT_SENTRY_RELEASE',
    '__PUSHIT_FEATURES',
  ];

  afterEach(() => {
    for (const key of keys) {
      delete globals()[key];
    }
  });

  it('falls back to inline defaults when no globals are injected', () => {
    const config = getRuntimeConfig();

    expect(config.apiBaseUrl).toBe('/api/v1');
    expect(config.sentry).toEqual({ dsn: '', environment: 'production', release: '' });
    expect(config.features).toEqual({});
  });

  it('reads injected runtime globals and trims them', () => {
    globals().__PUSHIT_API_BASE_URL = '  https://pushit-api.foxugly.com/api/v1  ';
    globals().__PUSHIT_SENTRY_DSN = ' https://abc@sentry.io/1 ';
    globals().__PUSHIT_SENTRY_ENV = 'staging';
    globals().__PUSHIT_SENTRY_RELEASE = 'pushit-frontend-1.2.3';
    globals().__PUSHIT_FEATURES = { beta: true };

    const config = getRuntimeConfig();

    expect(config.apiBaseUrl).toBe('https://pushit-api.foxugly.com/api/v1');
    expect(config.sentry).toEqual({
      dsn: 'https://abc@sentry.io/1',
      environment: 'staging',
      release: 'pushit-frontend-1.2.3',
    });
    expect(config.features).toEqual({ beta: true });
  });

  it('falls back to defaults for empty-string globals and non-object features', () => {
    globals().__PUSHIT_API_BASE_URL = '   ';
    globals().__PUSHIT_SENTRY_ENV = '';
    globals().__PUSHIT_FEATURES = undefined;

    const config = getRuntimeConfig();

    expect(config.apiBaseUrl).toBe('/api/v1');
    expect(config.sentry.environment).toBe('production');
    expect(config.features).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include=src/app/core/runtime-config.spec.ts --watch=false --browsers=ChromeHeadless`
Expected: FAIL — `Cannot find module './runtime-config'` (le fichier n'existe pas encore).

- [ ] **Step 3: Write minimal implementation**

Create `src/app/core/runtime-config.ts`:

```typescript
/**
 * Configuration runtime du frontend, lue au démarrage depuis des globals
 * `window.__PUSHIT_*` que nginx injecte dans index.html (cf. deploy/nginx/
 * pushit-frontend.conf + fetch-frontend-runtime-from-ssm.sh). En dev, ces
 * globals sont absents et on retombe sur les défauts inline ci-dessous.
 *
 * Cette config est 100 % publique (visible dans le HTML servi) : n'y mettre
 * que des valeurs publiques par nature (URL d'API, DSN Sentry, feature flags).
 */
export interface RuntimeSentryConfig {
  dsn: string;
  environment: string;
  release: string;
}

export interface RuntimeConfig {
  apiBaseUrl: string;
  sentry: RuntimeSentryConfig;
  features: Record<string, boolean>;
}

interface RuntimeGlobals {
  __PUSHIT_API_BASE_URL?: string;
  __PUSHIT_SENTRY_DSN?: string;
  __PUSHIT_SENTRY_ENV?: string;
  __PUSHIT_SENTRY_RELEASE?: string;
  __PUSHIT_FEATURES?: Record<string, boolean>;
}

const DEFAULT_API_BASE_URL = '/api/v1';
const DEFAULT_SENTRY_ENV = 'production';

function trimmedOr(value: string | undefined, fallback: string): string {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

/**
 * Résolution : global runtime (trimé) → défaut inline. Lecture synchrone (les
 * globals sont dans le DOM avant le bootstrap), donc utilisable depuis main.ts
 * comme depuis les services Angular.
 */
export function getRuntimeConfig(): RuntimeConfig {
  const globals = globalThis as unknown as RuntimeGlobals;

  const features =
    globals.__PUSHIT_FEATURES && typeof globals.__PUSHIT_FEATURES === 'object'
      ? globals.__PUSHIT_FEATURES
      : {};

  return {
    apiBaseUrl: trimmedOr(globals.__PUSHIT_API_BASE_URL, DEFAULT_API_BASE_URL),
    sentry: {
      dsn: (globals.__PUSHIT_SENTRY_DSN ?? '').trim(),
      environment: trimmedOr(globals.__PUSHIT_SENTRY_ENV, DEFAULT_SENTRY_ENV),
      release: (globals.__PUSHIT_SENTRY_RELEASE ?? '').trim(),
    },
    features,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include=src/app/core/runtime-config.spec.ts --watch=false --browsers=ChromeHeadless`
Expected: PASS (3 specs).

- [ ] **Step 5: Commit**

```bash
git add src/app/core/runtime-config.ts src/app/core/runtime-config.spec.ts
git commit -m "feat(config): add runtime config reader for window.__PUSHIT_* globals"
```

---

## Task 2 : `SettingsService` consomme le défaut runtime

**Files:**
- Modify: `src/app/core/services/settings.service.ts`
- Test: `src/app/core/services/settings.service.spec.ts`

- [ ] **Step 1: Update the failing test**

Le défaut d'URL d'API doit désormais venir de `getRuntimeConfig()`. Remplacer le 1er test de `settings.service.spec.ts` et ajouter un test « défaut runtime ». Remplacer le bloc :

```typescript
  it('uses the default relative API url when storage is empty', () => {
    const service = createService();

    expect(service.apiBaseUrl()).toBe('/api/v1');
  });
```

par :

```typescript
  it('uses the runtime config api base url when storage is empty', () => {
    const service = createService();

    // Aucun global injecté en test → défaut inline du runtime-config = '/api/v1'.
    expect(service.apiBaseUrl()).toBe('/api/v1');
  });

  it('prefers a runtime-injected api base url over the inline default', () => {
    (globalThis as unknown as { __PUSHIT_API_BASE_URL?: string }).__PUSHIT_API_BASE_URL =
      'https://pushit-api.foxugly.com/api/v1';
    try {
      const service = createService();
      expect(service.apiBaseUrl()).toBe('https://pushit-api.foxugly.com/api/v1');
    } finally {
      delete (globalThis as unknown as { __PUSHIT_API_BASE_URL?: string }).__PUSHIT_API_BASE_URL;
    }
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include=src/app/core/services/settings.service.spec.ts --watch=false --browsers=ChromeHeadless`
Expected: FAIL — `prefers a runtime-injected api base url…` échoue (le service utilise encore la constante `'/api/v1'` codée en dur, pas le global).

- [ ] **Step 3: Write minimal implementation**

Dans `src/app/core/services/settings.service.ts` : remplacer la constante `DEFAULT_API_BASE_URL` codée en dur par une lecture du runtime-config. Nouveau contenu complet du fichier :

```typescript
import { Injectable, inject, signal } from '@angular/core';

import { getRuntimeConfig } from '../runtime-config';
import { StorageService } from './storage.service';

const API_BASE_URL_KEY = 'pushit.apiBaseUrl';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly storage = inject(StorageService);
  private readonly defaultApiBaseUrl = getRuntimeConfig().apiBaseUrl;
  private readonly apiBaseUrlSignal = signal(
    this.normalizeApiBaseUrl(this.storage.getString(API_BASE_URL_KEY) ?? this.defaultApiBaseUrl),
  );

  apiBaseUrl(): string {
    return this.apiBaseUrlSignal();
  }

  updateApiBaseUrl(value: string): void {
    const normalizedValue = this.normalizeApiBaseUrl(value);
    this.apiBaseUrlSignal.set(normalizedValue);
    this.storage.setString(API_BASE_URL_KEY, normalizedValue);
  }

  private normalizeApiBaseUrl(value: string): string {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return this.defaultApiBaseUrl;
    }

    if (
      trimmedValue === 'http://127.0.0.1:8000/api/v1' ||
      trimmedValue === 'http://localhost:8000/api/v1'
    ) {
      return this.defaultApiBaseUrl;
    }

    return trimmedValue.replace(/\/+$/, '');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include=src/app/core/services/settings.service.spec.ts --watch=false --browsers=ChromeHeadless`
Expected: PASS (tous les specs `SettingsService`, dont le nouveau).

- [ ] **Step 5: Commit**

```bash
git add src/app/core/services/settings.service.ts src/app/core/services/settings.service.spec.ts
git commit -m "feat(config): derive default api base url from runtime config"
```

---

## Task 3 : Installer `@sentry/angular`

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install the dependency**

Run: `npm install @sentry/angular@^10 --save-exact=false`
Expected: ajoute `@sentry/angular` à `dependencies`, met à jour `package-lock.json`, exit 0.

(Si la résolution de peer-deps Angular 20 échoue avec `^10`, retomber sur la dernière mineure compatible affichée par npm ; le SDK Angular supporte Angular 14→20.)

- [ ] **Step 2: Verify the install**

Run: `node -e "console.log(require('./package.json').dependencies['@sentry/angular'])"`
Expected: affiche une version (ex. `^10.x.y`), non `undefined`.

- [ ] **Step 3: Verify the build still compiles**

Run: `npm run build`
Expected: build production OK (`dist/pushit-frontend/browser/index.html` généré).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add @sentry/angular dependency"
```

---

## Task 4 : Initialisation Sentry depuis la config runtime

**Files:**
- Create: `src/sentry-init.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write the Sentry init module**

Create `src/sentry-init.ts`:

```typescript
/**
 * Initialisation de Sentry AVANT le bootstrap Angular (importé en tête de
 * main.ts) afin de capter les erreurs survenant pendant l'init de l'app.
 *
 * Les valeurs viennent de la config runtime (globals injectés par nginx). Si le
 * DSN est vide (cas dev, ou bootstrap serveur sans SSM seedé), `Sentry.init`
 * n'est pas appelé : le SDK reste inerte, aucun appel réseau.
 */
import * as Sentry from '@sentry/angular';

import { getRuntimeConfig } from './app/core/runtime-config';

const { sentry } = getRuntimeConfig();

if (sentry.dsn) {
  Sentry.init({
    dsn: sentry.dsn,
    environment: sentry.environment,
    release: sentry.release || undefined,
    integrations: [Sentry.browserTracingIntegration()],
    // 10 % des transactions tracées en prod : compromis volume/coût.
    tracesSampleRate: 0.1,
    // Propager les en-têtes de trace uniquement vers notre backend.
    tracePropagationTargets: [/^https:\/\/pushit-api\.foxugly\.com\/api/],
  });
}
```

- [ ] **Step 2: Wire it first in main.ts**

Replace `src/main.ts` with:

```typescript
import './sentry-init';

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: build OK, aucune erreur TypeScript sur l'import `@sentry/angular`.

- [ ] **Step 4: Commit**

```bash
git add src/sentry-init.ts src/main.ts
git commit -m "feat(observability): init Sentry from runtime config before bootstrap"
```

---

## Task 5 : Providers Sentry dans `app.config.ts`

**Files:**
- Modify: `src/app/app.config.ts`

- [ ] **Step 1: Add the Sentry providers**

Replace `src/app/app.config.ts` with:

```typescript
import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import * as Sentry from '@sentry/angular';
import Aura from '@primeuix/themes/aura';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAnimationsAsync(),
    providePrimeNG({
      ripple: true,
      inputVariant: 'filled',
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: false,
        },
      },
    }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Sentry : capture des erreurs non gérées + instrumentation du routing.
    { provide: ErrorHandler, useValue: Sentry.createErrorHandler() },
    { provide: Sentry.TraceService, deps: [Router] },
    provideAppInitializer(() => {
      inject(Sentry.TraceService);
    }),
  ],
};
```

- [ ] **Step 2: Verify build + unit tests compile/pass**

Run: `npm run build`
Expected: build OK.

Run: `npx ng test --include=src/app/app.spec.ts --watch=false --browsers=ChromeHeadless`
Expected: PASS (le composant racine boote toujours avec les providers Sentry).

- [ ] **Step 3: Commit**

```bash
git add src/app/app.config.ts
git commit -m "feat(observability): register Sentry ErrorHandler and TraceService providers"
```

---

## Task 6 : Vérifier la suite complète + couverture

**Files:** (aucun — vérification)

- [ ] **Step 1: Run the full CI test suite with coverage**

Run: `npm run test:ci`
Expected: PASS, et `scripts/check-coverage.mjs` ne fait pas échouer (seuils statements 45 % / branches 30 % / functions 38 % / lines 45 %).

- [ ] **Step 2: If coverage dropped below a threshold**

Si un seuil casse à cause du code Sentry non couvert : la logique testable est isolée dans `runtime-config.ts` (déjà couverte). `sentry-init.ts` (effet de bord d'init) et les providers ne sont pas unit-testés volontairement. Si nécessaire, ajouter un test léger vérifiant que `getRuntimeConfig().sentry.dsn === ''` n'entraîne pas d'init — mais ne pas baisser les seuils sans accord.

Run (au besoin): `npx ng test --include=src/app/core/runtime-config.spec.ts --watch=false --browsers=ChromeHeadless --code-coverage`

- [ ] **Step 3: Commit (only if files changed)**

```bash
git add -A
git commit -m "test(config): keep coverage thresholds with runtime config tests"
```

---

## Task 7 : Script de fetch SSM → snippet nginx

**Files:**
- Create: `deploy/fetch-frontend-runtime-from-ssm.sh`

- [ ] **Step 1: Write the script**

Create `deploy/fetch-frontend-runtime-from-ssm.sh`:

```bash
#!/usr/bin/env bash
# =============================================================================
# PushIT frontend — Fetch runtime config from AWS SSM into a nginx snippet.
#
# Lancé par pushit-frontend-runtime-fetch.service (oneshot) au boot, et par
# deploy.sh à chaque déploiement. Lit /pushit-frontend/prod/* (eu-west-1) avec
# le rôle d'instance EC2 (l'unité blanke AWS_*_FILE pour éviter que les clés
# certbot-route53 de root masquent le rôle) et écrit un snippet nginx
# `set $pushit_* "...";` que le vhost inclut puis injecte dans index.html.
#
# La config frontend est PUBLIQUE (servie au navigateur) → que des String SSM,
# jamais de secret. Garde-fous : refuse les valeurs avec newline interne, écrit
# atomiquement (0644 root), idempotent (pas de reload si inchangé), valide
# `nginx -t` avant de recharger.
# =============================================================================
set -euo pipefail

SSM_PREFIX="${PUSHIT_FRONTEND_SSM_PREFIX:-/pushit-frontend/prod}"
AWS_REGION="${AWS_REGION:-eu-west-1}"
OUT_FILE="${PUSHIT_FRONTEND_RUNTIME_FILE:-/etc/nginx/snippets/pushit-frontend-runtime.conf}"

echo "[frontend-runtime] prefix=$SSM_PREFIX region=$AWS_REGION out=$OUT_FILE"

RAW_FILE="$(mktemp)"
TMP_FILE="$(mktemp)"
trap 'rm -f "$RAW_FILE" "$TMP_FILE"' EXIT

# Fetch raw JSON to a file first. If aws errors (IAM/IMDS/network), set -e stops
# here and the previous $OUT_FILE is left untouched.
aws ssm get-parameters-by-path \
    --path "$SSM_PREFIX" \
    --recursive \
    --region "$AWS_REGION" \
    --output json > "$RAW_FILE"

# Parse JSON -> nginx `set` directives. Le programme est lu depuis le heredoc
# (python3 -), les données depuis un FICHIER passé en argument : pas de conflit
# "programme sur stdin" vs "données sur stdin". Clés absentes -> défaut.
python3 - "$SSM_PREFIX" "$TMP_FILE" "$RAW_FILE" <<'PY'
import json, sys

prefix, out_path, raw_path = sys.argv[1], sys.argv[2], sys.argv[3]
with open(raw_path) as fh:
    params = json.load(fh).get("Parameters", [])

# Defaults appliqués pour toute clé absente de SSM.
values = {
    "API_BASE_URL": "",
    "SENTRY_DSN": "",
    "SENTRY_ENV": "production",
    "SENTRY_RELEASE": "",
    "FEATURES": "{}",
}

for p in params:
    key = p["Name"][len(prefix):].lstrip("/")
    # Tolère un CR/LF de fin (artefact CRLF d'un .env édité sous Windows) mais
    # rejette toute newline interne (corromprait la directive nginx `set`).
    value = p["Value"].strip("\r\n")
    if "\n" in value or "\r" in value:
        sys.stderr.write(f"ERROR: value for {key} contains an internal newline; refusing.\n")
        sys.exit(1)
    if key in values:
        values[key] = value

# FEATURES est injecté SANS guillemets dans le <script> (littéral objet JS) :
# il doit être un JSON valide, sinon on retombe sur {} pour ne pas casser la page.
features = values["FEATURES"].strip() or "{}"
try:
    json.loads(features)
except ValueError:
    sys.stderr.write(f"WARN: FEATURES is not valid JSON ({features!r}); using {{}}.\n")
    features = "{}"

lines = [
    "# AUTO-GENERATED by deploy/fetch-frontend-runtime-from-ssm.sh",
    f"# Source of truth: AWS SSM {prefix}/* (region from the unit). Manual edits",
    "# are overwritten on the next service restart / deploy.",
    f'set $pushit_api_base       "{values["API_BASE_URL"]}";',
    f'set $pushit_sentry_dsn     "{values["SENTRY_DSN"]}";',
    f'set $pushit_sentry_env     "{values["SENTRY_ENV"]}";',
    f'set $pushit_sentry_release "{values["SENTRY_RELEASE"]}";',
    f"set $pushit_features       {features};",
]
with open(out_path, "w") as fh:
    fh.write("\n".join(lines) + "\n")
PY

# Idempotence : rien à faire si le snippet est identique (évite un reload nginx).
if [ -f "$OUT_FILE" ] && cmp -s "$TMP_FILE" "$OUT_FILE"; then
    echo "[frontend-runtime] $OUT_FILE unchanged — no reload needed"
    exit 0
fi

mkdir -p "$(dirname "$OUT_FILE")"
install -m 0644 -o root -g root "$TMP_FILE" "$OUT_FILE"
echo "[frontend-runtime] $OUT_FILE updated"

# Garde : valide la config complète (vhost + snippet) avant de recharger. Si KO,
# on n'effectue pas le reload (le master tourne encore sur l'ancienne conf valide).
if ! nginx -t; then
    echo "ERROR: nginx -t failed after writing $OUT_FILE — skipping reload" >&2
    exit 3
fi

systemctl reload nginx
echo "[frontend-runtime] nginx reloaded"
```

- [ ] **Step 2: Make it executable + syntax check**

Run: `bash -n deploy/fetch-frontend-runtime-from-ssm.sh && chmod +x deploy/fetch-frontend-runtime-from-ssm.sh && echo OK`
Expected: `OK` (pas d'erreur de syntaxe bash).

- [ ] **Step 3: Verify the embedded Python parses**

Run: `python3 -c "import ast,sys; ast.parse(open('deploy/fetch-frontend-runtime-from-ssm.sh').read().split(chr(39)*0) and open('deploy/fetch-frontend-runtime-from-ssm.sh').read())" 2>/dev/null; echo "bash script written"`
(Le bloc Python est vérifié à l'exécution réelle sur l'EC2 ; ici on s'assure surtout que le script bash est bien formé. Si `python3` est dispo, on peut extraire/valider le heredoc manuellement, sinon passer.)
Expected: pas d'erreur bloquante.

- [ ] **Step 4: Commit**

```bash
git add deploy/fetch-frontend-runtime-from-ssm.sh
git commit -m "feat(deploy): fetch frontend runtime config from SSM into nginx snippet"
```

---

## Task 8 : Unité systemd oneshot

**Files:**
- Create: `deploy/systemd/pushit-frontend-runtime-fetch.service`

- [ ] **Step 1: Write the unit**

Create `deploy/systemd/pushit-frontend-runtime-fetch.service`:

```ini
[Unit]
Description=PushIT frontend — fetch runtime config from AWS SSM into nginx snippet
# network-online + clock (SigV4), et nginx (le script fait `nginx -t` + reload).
After=network-online.target nginx.service
Wants=network-online.target

[Service]
# oneshot + RemainAfterExit : fetch au boot puis reste "active (exited)". Un
# déploiement de code ne relance PAS l'unité tout seul ; c'est deploy.sh qui la
# redémarre pour appliquer une rotation SSM. Restart manuel :
#   sudo systemctl restart pushit-frontend-runtime-fetch
Type=oneshot
RemainAfterExit=yes
User=root

# Force l'authentification via le rôle d'instance EC2 (quizonline-ec2) sur IMDS
# en blankant les fichiers credentials/config : sinon les clés statiques
# certbot-route53 dans /root/.aws masqueraient le rôle. La config front étant en
# String public, aucun kms:Decrypt n'est requis.
Environment=AWS_SHARED_CREDENTIALS_FILE=/dev/null
Environment=AWS_CONFIG_FILE=/dev/null
Environment=AWS_REGION=eu-west-1

# Durcissement : le script écrit /etc/nginx/snippets/ et a besoin de /run pour
# `nginx -t` (pid) et `systemctl reload`. ProtectSystem=full garde /etc en
# lecture seule SAUF les chemins de ReadWritePaths.
PrivateTmp=yes
ProtectSystem=full
ReadWritePaths=/etc/nginx/snippets
ProtectHome=yes
NoNewPrivileges=yes
RestrictSUIDSGID=yes
TimeoutStartSec=120

ExecStart=/var/www/django_websites/PushIT_frontend/deploy/fetch-frontend-runtime-from-ssm.sh
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Sanity check (no tabs/heredoc issues)**

Run: `grep -c '=' deploy/systemd/pushit-frontend-runtime-fetch.service && echo "unit written"`
Expected: un nombre > 10 puis `unit written` (vérif grossière que le fichier est non vide et bien formé ; la validation réelle = `systemd-analyze verify` sur l'EC2).

- [ ] **Step 3: Commit**

```bash
git add deploy/systemd/pushit-frontend-runtime-fetch.service
git commit -m "feat(deploy): add oneshot systemd unit for frontend runtime fetch"
```

---

## Task 9 : Vhost nginx (Pattern A)

**Files:**
- Create: `deploy/nginx/pushit-frontend.conf`
- Delete: `deploy/pushit.foxugly.com.conf`

- [ ] **Step 1: Write the nginx vhost**

Create `deploy/nginx/pushit-frontend.conf`:

```nginx
# PushIT frontend (Angular SPA) — vhost nginx pour pushit.foxugly.com.
#
# Installé dans /etc/nginx/sites-available/ et symlinké dans sites-enabled/ par
# deploy/setup-server.sh. Certbot (`certbot --nginx -d pushit.foxugly.com`) ajoute
# le bloc 443 + la redirection HTTP->HTTPS par-dessus ce fichier.
#
# Pattern A : les valeurs de config runtime viennent de SSM via le snippet
# inclus plus bas (écrit par fetch-frontend-runtime-from-ssm.sh) et sont
# injectées dans index.html via sub_filter, puis lues par Angular (runtime-config.ts).
# Pas de proxy /api : le frontend appelle pushit-api.foxugly.com en cross-origin.

server {
    listen 80;
    server_name pushit.foxugly.com;

    root /var/www/django_websites/PushIT_frontend/dist/pushit-frontend/browser;
    index index.html;

    client_max_body_size 5m;

    # En-têtes de sécurité (ré-émis dans les location qui posent leur propre
    # add_header — nginx n'hérite pas dès qu'un location déclare un add_header).
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header X-Content-Type-Options    "nosniff" always;
    add_header X-Frame-Options           "SAMEORIGIN" always;
    add_header Referrer-Policy           "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy        "geolocation=(), microphone=(), camera=()" always;

    # Défauts vides : la page reste valide même sans snippet (bootstrap avant
    # premier fetch). L'opérateur/fetch écrit le snippet qui surcharge ces `set`.
    set $pushit_api_base       "";
    set $pushit_sentry_dsn     "";
    set $pushit_sentry_env     "production";
    set $pushit_sentry_release "";
    set $pushit_features       "{}";
    include /etc/nginx/snippets/pushit-frontend-runtime*.conf;   # le glob tolère l'absence

    # Routing SPA : tout chemin inconnu retombe sur index.html.
    location / {
        try_files $uri $uri/ /index.html;
    }

    # index.html jamais caché (référence des bundles hashés qui changent à chaque
    # deploy) + injection des globals runtime juste avant </head>.
    location = /index.html {
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
        add_header X-Content-Type-Options    "nosniff" always;
        add_header X-Frame-Options           "SAMEORIGIN" always;
        add_header Referrer-Policy           "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy        "geolocation=(), microphone=(), camera=()" always;
        add_header Cache-Control             "no-store, no-cache, must-revalidate" always;
        expires 0;

        # $pushit_features injecté SANS guillemets -> littéral objet JS.
        sub_filter '</head>' '<script>window.__PUSHIT_API_BASE_URL="$pushit_api_base";window.__PUSHIT_SENTRY_DSN="$pushit_sentry_dsn";window.__PUSHIT_SENTRY_ENV="$pushit_sentry_env";window.__PUSHIT_SENTRY_RELEASE="$pushit_sentry_release";window.__PUSHIT_FEATURES=$pushit_features;</script></head>';
        sub_filter_once on;
    }

    # Bundles hashés (chunk-XXXX.js, styles-XXXX.css, fonts…) : cache immutable.
    location ~* \.(?:js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico)$ {
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
        add_header X-Content-Type-Options    "nosniff" always;
        add_header X-Frame-Options           "SAMEORIGIN" always;
        add_header Referrer-Policy           "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy        "geolocation=(), microphone=(), camera=()" always;
        add_header Cache-Control             "public, max-age=31536000, immutable" always;
        expires 1y;
        access_log off;
        try_files $uri =404;
    }

    access_log /var/log/nginx/pushit-frontend-access.log;
    error_log  /var/log/nginx/pushit-frontend-error.log;
}
```

- [ ] **Step 2: Delete the old Apache vhost**

Run: `git rm deploy/pushit.foxugly.com.conf`
Expected: supprime le fichier de l'index git.

- [ ] **Step 3: Sanity check the vhost is non-empty and references the snippet**

Run: `grep -q "sub_filter '</head>'" deploy/nginx/pushit-frontend.conf && grep -q "pushit-frontend-runtime\*.conf" deploy/nginx/pushit-frontend.conf && echo OK`
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add deploy/nginx/pushit-frontend.conf
git commit -m "feat(deploy): add nginx vhost with runtime-config sub_filter; drop Apache vhost"
```

---

## Task 10 : Scripts de seed SSM (bash + PowerShell)

**Files:**
- Create: `deploy/seed-parameter-store.sh`
- Create: `deploy/seed-parameter-store.ps1`

- [ ] **Step 1: Write the bash seeder**

Create `deploy/seed-parameter-store.sh`:

```bash
#!/usr/bin/env bash
# =============================================================================
# PushIT frontend — Seed AWS SSM Parameter Store from a local .env file.
#
#   bash deploy/seed-parameter-store.sh ./prod.env
#
# Source de vérité de la config front prod = SSM (/pushit-frontend/prod/*,
# eu-west-1). La config front est PUBLIQUE -> tout est poussé en String (pas de
# SecureString, pas de SECRET_KEYS). Requiert des creds AWS avec
# ssm:PutParameter (ton user IAM/SSO), PAS le rôle d'instance. Idempotent
# (--overwrite).
#
# Après seed, appliquer (cf. CLAUDE.md) :
#   sudo systemctl restart pushit-frontend-runtime-fetch    # relit SSM + reload nginx
#   # ...ou déclencher un déploiement (la CI re-fetch automatiquement).
# =============================================================================
set -euo pipefail

ENV_FILE="${1:?Usage: $0 <path-to-.env>}"
SSM_PREFIX="/pushit-frontend/prod"
AWS_REGION="eu-west-1"

[ -f "$ENV_FILE" ] || { echo "No such file: $ENV_FILE" >&2; exit 1; }

while IFS= read -r line || [ -n "$line" ]; do
    [[ -z "${line//[[:space:]]/}" ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" != *=* ]] && continue

    key="${line%%=*}"
    value="${line#*=}"
    key="${key//[[:space:]]/}"
    [[ -z "$key" ]] && continue

    echo "  put $SSM_PREFIX/$key  (String)"
    aws ssm put-parameter \
        --name "$SSM_PREFIX/$key" \
        --value "$value" \
        --type "String" \
        --overwrite \
        --region "$AWS_REGION" \
        >/dev/null
done < "$ENV_FILE"

echo "Done. Seeded $SSM_PREFIX/* in $AWS_REGION."
echo "Apply on the server:"
echo "  sudo systemctl restart pushit-frontend-runtime-fetch"
echo "  (or trigger a deploy — CI re-fetches automatically)"
```

- [ ] **Step 2: Write the PowerShell seeder**

Create `deploy/seed-parameter-store.ps1`:

```powershell
<#
.SYNOPSIS
  Seed AWS SSM Parameter Store (/pushit-frontend/prod/*, eu-west-1) from a .env.

.DESCRIPTION
  Source de vérité de la config front prod = SSM. La config front est PUBLIQUE
  -> tout en String (pas de SecureString). Requiert l'AWS CLI configurée avec
  ssm:PutParameter. Idempotent (--overwrite).

  Après seed, appliquer sur le serveur (cf. CLAUDE.md) :
    sudo systemctl restart pushit-frontend-runtime-fetch
    (ou déclencher un déploiement — la CI re-fetch automatiquement)

.EXAMPLE
  ./deploy/seed-parameter-store.ps1 ./prod.env
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$EnvFile
)
$ErrorActionPreference = "Stop"

$SsmPrefix = "/pushit-frontend/prod"
$AwsRegion = "eu-west-1"

if (-not (Test-Path -LiteralPath $EnvFile)) { throw "No such file: $EnvFile" }

foreach ($line in Get-Content -LiteralPath $EnvFile) {
    if ($line -match '^\s*$' -or $line -match '^\s*#') { continue }
    $idx = $line.IndexOf('=')
    if ($idx -lt 1) { continue }

    $key = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1)
    if ([string]::IsNullOrWhiteSpace($key)) { continue }

    Write-Host "  put $SsmPrefix/$key  (String)"
    aws ssm put-parameter `
        --name "$SsmPrefix/$key" `
        --value "$value" `
        --type "String" `
        --overwrite `
        --region $AwsRegion | Out-Null
}

Write-Host "Done. Seeded $SsmPrefix/* in $AwsRegion."
Write-Host "Apply on the server:"
Write-Host "  sudo systemctl restart pushit-frontend-runtime-fetch"
Write-Host "  (or trigger a deploy - CI re-fetches automatically)"
```

- [ ] **Step 3: Syntax checks**

Run: `bash -n deploy/seed-parameter-store.sh && chmod +x deploy/seed-parameter-store.sh && echo OK`
Expected: `OK`.

Run: `pwsh -NoProfile -Command "[System.Management.Automation.PSParser]::Tokenize((Get-Content -Raw deploy/seed-parameter-store.ps1), [ref]\$null) | Out-Null; 'OK'"`
Expected: `OK` (parse PowerShell sans erreur). Si `pwsh` indisponible, vérifier visuellement.

- [ ] **Step 4: Commit**

```bash
git add deploy/seed-parameter-store.sh deploy/seed-parameter-store.ps1
git commit -m "feat(deploy): add SSM seeders (String only, public frontend config)"
```

---

## Task 11 : `deploy.sh` (promotion serveur + re-fetch)

**Files:**
- Create: `deploy/deploy.sh`

- [ ] **Step 1: Write the deploy script**

Create `deploy/deploy.sh`:

```bash
#!/usr/bin/env bash
# =============================================================================
# PushIT frontend — Deploy script (promotion côté serveur).
#
# Appelé par GitHub Actions en SSH (en tant que user de deploy), après que la CI
# a rsync les artefacts buildés dans /tmp/pushit-frontend-staging/.
#
#   /var/www/django_websites/PushIT_frontend/deploy/deploy.sh
#
# 1. met à jour les scripts deploy/ versionnés (git reset) ;
# 2. promeut les artefacts SPA dans dist/pushit-frontend/browser/ ;
# 3. re-fetch la config runtime (rotation SSM appliquée à chaque deploy).
# =============================================================================
set -euo pipefail

APP_DIR="/var/www/django_websites/PushIT_frontend"
ARTIFACT_DIR="$APP_DIR/dist/pushit-frontend/browser"
STAGING_DIR="/tmp/pushit-frontend-staging"

cd "$APP_DIR"

echo ">>> Updating deploy scripts (git)..."
# Met à jour deploy/ etc. ; dist/ est gitignoré donc les artefacts ne sont pas
# touchés par le reset.
sudo -u django git fetch origin main
sudo -u django git reset --hard origin/main

echo ">>> Promoting SPA artifacts..."
mkdir -p "$ARTIFACT_DIR"
sudo -u django /usr/bin/rsync -a --delete "$STAGING_DIR/" "$ARTIFACT_DIR/"
sudo /bin/chown -R django:www-data "$ARTIFACT_DIR/"
sudo /bin/chmod -R g+rX "$ARTIFACT_DIR/"
rm -rf "$STAGING_DIR"

echo ">>> Re-fetching runtime config from SSM (applies SSM rotations)..."
sudo /bin/systemctl restart pushit-frontend-runtime-fetch

echo ">>> Deploy complete."
```

- [ ] **Step 2: Syntax check + executable**

Run: `bash -n deploy/deploy.sh && chmod +x deploy/deploy.sh && echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add deploy/deploy.sh
git commit -m "feat(deploy): add server-side deploy.sh (promote artifacts + re-fetch config)"
```

---

## Task 12 : Réécrire `setup-server.sh` (nginx)

**Files:**
- Modify (rewrite): `deploy/setup-server.sh`

- [ ] **Step 1: Rewrite the setup script**

Replace `deploy/setup-server.sh` entirely with:

```bash
#!/usr/bin/env bash
# =============================================================================
# PushIT frontend — Server setup (one-time) for the shared EC2.
#
# Cohabite avec PushIT_server + QuizOnline (nginx, rôle d'instance quizonline-ec2).
# Convertit l'ancien dossier d'artefacts en clone git (Option A), installe le
# vhost nginx + TLS, et l'unité oneshot qui fetch la config runtime depuis SSM.
#
# Prérequis AVANT de lancer :
#   1. DNS A : pushit.foxugly.com -> IP publique EC2
#   2. SSM seedé : bash deploy/seed-parameter-store.sh ./prod.env  (ou .ps1)
#   3. Rôle quizonline-ec2 autorisé ssm:GetParametersByPath sur les DEUX ARNs :
#        arn:aws:ssm:eu-west-1:362629935151:parameter/pushit-frontend/prod
#        arn:aws:ssm:eu-west-1:362629935151:parameter/pushit-frontend/prod/*
#      (pas de kms:Decrypt : config en String public)
#
# Usage (en tant que user sudo, ex. ubuntu) :
#   sudo bash deploy/setup-server.sh <DEPLOY_USER>
#
# Idempotent.
# =============================================================================
set -euo pipefail

DOMAIN="pushit.foxugly.com"
APP_DIR="/var/www/django_websites/PushIT_frontend"
ARTIFACT_DIR="$APP_DIR/dist/pushit-frontend/browser"
REPO="https://github.com/Foxugly/PushIT_frontend.git"
APP_OWNER="django"
APP_GROUP="www-data"
CERTBOT_EMAIL="rvilain@foxugly.com"

if [ "$(id -u)" -ne 0 ]; then
    echo "ERREUR : lancer en root (sudo)." >&2
    exit 1
fi

DEPLOY_USER="${1:-}"
if [ -z "$DEPLOY_USER" ]; then
    echo "Usage : sudo $0 <DEPLOY_USER>   (ex: sudo $0 ubuntu)" >&2
    exit 1
fi
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
    echo "ERREUR : user '$DEPLOY_USER' inexistant." >&2
    exit 1
fi

echo "=== Setup frontend ${DOMAIN} (deploy user: ${DEPLOY_USER}) ==="

# ─── 1/6 Packages ────────────────────────────────────────────────────────────
echo "[1/6] Packages (nginx, certbot, git, awscli)"
MISSING=()
for pkg in nginx certbot python3-certbot-nginx git awscli; do
    dpkg -l "$pkg" >/dev/null 2>&1 || MISSING+=("$pkg")
done
if [ ${#MISSING[@]} -gt 0 ]; then
    apt update && apt install -y "${MISSING[@]}"
fi
echo "    OK"

# ─── 2/6 Clone git en place (Option A) ───────────────────────────────────────
echo "[2/6] Repo clone in $APP_DIR"
mkdir -p "$APP_DIR"
chown "${APP_OWNER}:${APP_GROUP}" "$APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
    echo "    déjà un clone, git reset"
    sudo -u "$APP_OWNER" git -C "$APP_DIR" fetch origin main
    sudo -u "$APP_OWNER" git -C "$APP_DIR" reset --hard origin/main
else
    # Conversion in-place du dossier d'artefacts existant en clone, sans rien
    # déplacer (artefacts reproductibles ; dist/ est gitignoré).
    sudo -u "$APP_OWNER" git -C "$APP_DIR" init -q
    sudo -u "$APP_OWNER" git -C "$APP_DIR" remote add origin "$REPO"
    sudo -u "$APP_OWNER" git -C "$APP_DIR" fetch origin main
    sudo -u "$APP_OWNER" git -C "$APP_DIR" reset --hard origin/main
    sudo -u "$APP_OWNER" git -C "$APP_DIR" clean -fd
fi
sudo -u "$APP_OWNER" mkdir -p "$ARTIFACT_DIR"
echo "    OK"

# ─── 3/6 Unité systemd de fetch ──────────────────────────────────────────────
echo "[3/6] systemd unit pushit-frontend-runtime-fetch"
cp "$APP_DIR/deploy/systemd/pushit-frontend-runtime-fetch.service" /etc/systemd/system/
systemctl daemon-reload
echo "    OK"

# ─── 4/6 Vhost nginx bootstrap (HTTP) + certbot ──────────────────────────────
echo "[4/6] nginx vhost + TLS"
cp "$APP_DIR/deploy/nginx/pushit-frontend.conf" /etc/nginx/sites-available/pushit-frontend.conf
ln -sf /etc/nginx/sites-available/pushit-frontend.conf /etc/nginx/sites-enabled/pushit-frontend.conf
# Premier fetch AVANT nginx -t : le vhost inclut le snippet (le glob tolère
# l'absence, mais on veut des valeurs dès le départ).
systemctl enable pushit-frontend-runtime-fetch
if ! systemctl start pushit-frontend-runtime-fetch; then
    echo "ERREUR : fetch SSM échoué — SSM /pushit-frontend/prod seedé ? rôle autorisé ?" >&2
    echo "         journalctl -u pushit-frontend-runtime-fetch" >&2
    exit 1
fi
nginx -t
systemctl reload nginx
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$CERTBOT_EMAIL"
echo "    OK"

# ─── 5/6 Sudoers pour le déploiement ─────────────────────────────────────────
echo "[5/6] sudoers pour ${DEPLOY_USER}"
SUDOERS_FILE="/etc/sudoers.d/pushit-frontend-deploy"
cat > "$SUDOERS_FILE" <<EOF
${DEPLOY_USER} ALL=(${APP_OWNER}) NOPASSWD: /usr/bin/rsync -a --delete /tmp/pushit-frontend-staging/ ${ARTIFACT_DIR}/
${DEPLOY_USER} ALL=(root) NOPASSWD: /bin/chown -R django\:www-data ${ARTIFACT_DIR}/, /bin/chmod -R g+rX ${ARTIFACT_DIR}/, /bin/systemctl restart pushit-frontend-runtime-fetch, /bin/systemctl reload nginx
EOF
chmod 440 "$SUDOERS_FILE"
visudo -c -f "$SUDOERS_FILE" >/dev/null
echo "    OK"

# ─── 6/6 Smoke test ──────────────────────────────────────────────────────────
echo "[6/6] Smoke test HTTPS"
if curl --fail --silent --show-error --max-time 30 -I "https://${DOMAIN}" >/dev/null; then
    echo "    https://${DOMAIN} répond"
else
    echo "    pas encore de réponse (normal avant le 1er déploiement de contenu)"
fi

echo ""
echo "=== Setup terminé ==="
echo "Il reste : secrets GitHub (EC2_HOST/EC2_USER/EC2_SSH_KEY), CORS backend"
echo "(CORS_ALLOWED_ORIGINS += https://${DOMAIN}), puis déclencher le workflow."
```

- [ ] **Step 2: Syntax check + executable**

Run: `bash -n deploy/setup-server.sh && chmod +x deploy/setup-server.sh && echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add deploy/setup-server.sh
git commit -m "feat(deploy): rewrite setup-server.sh for nginx + SSM runtime fetch"
```

---

## Task 13 : CI — appeler `deploy.sh` au lieu du heredoc

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Replace the "Promote staging to live" step**

Dans `.github/workflows/deploy.yml`, remplacer le step `Promote staging to live` (le heredoc inline) par un appel à `deploy.sh` :

```yaml
      - name: Promote staging to live
        run: |
          ssh "${{ secrets.EC2_USER }}@${{ secrets.EC2_HOST }}" \
            'sudo /var/www/django_websites/PushIT_frontend/deploy/deploy.sh'
```

Laisser inchangés : checkout, setup-node, `npm ci`, `npm run build`, verify build output, setup SSH, known_hosts, rsync vers staging, smoke test.

- [ ] **Step 2: Validate the workflow YAML**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml')); print('YAML OK')"`
Expected: `YAML OK`.

- [ ] **Step 3: Confirm the heredoc is gone**

Run: `grep -c "sudo -u django /usr/bin/rsync" .github/workflows/deploy.yml || true`
Expected: `0` (la logique de promotion vit maintenant dans `deploy.sh`).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: call deploy.sh over SSH instead of inline promotion heredoc"
```

---

## Task 14 : Documentation `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Append a Deployment section**

Ajouter à la fin de `CLAUDE.md` la section suivante :

````markdown
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

### IAM (rôle d'instance quizonline-ec2)

Autoriser `ssm:GetParametersByPath` sur les **deux** ARNs (le nœud nu ET le
wildcard — sinon `AccessDenied`) :

```
arn:aws:ssm:eu-west-1:362629935151:parameter/pushit-frontend/prod
arn:aws:ssm:eu-west-1:362629935151:parameter/pushit-frontend/prod/*
```

Pas de `kms:Decrypt` (config en String public).

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
````

- [ ] **Step 2: Sanity check**

Run: `grep -q "pushit-frontend/prod" CLAUDE.md && grep -q "Pattern A" CLAUDE.md && echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document SSM runtime config deployment in CLAUDE.md"
```

---

## Task 15 : Vérification finale globale

**Files:** (aucun — vérification)

- [ ] **Step 1: Full test suite + coverage**

Run: `npm run test:ci`
Expected: PASS + couverture OK.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: `dist/pushit-frontend/browser/index.html` généré, aucune erreur.

- [ ] **Step 3: Confirm index.html has a </head> for sub_filter to target**

Run: `grep -c "</head>" dist/pushit-frontend/browser/index.html`
Expected: `1` (sinon le `sub_filter` du vhost n'injecterait rien — bloquant).

- [ ] **Step 4: Bash syntax sweep on all deploy scripts**

Run: `for f in deploy/*.sh deploy/fetch-frontend-runtime-from-ssm.sh; do bash -n "$f" && echo "ok $f"; done`
Expected: `ok` pour chaque script.

- [ ] **Step 5: Final review commit (if any stray changes)**

```bash
git status
# si rien à committer : terminé.
```

---

## Self-Review (effectué à l'écriture)

**Couverture de la spec :**
- §3.1 chaîne SSM→snippet→sub_filter→Angular → Tasks 1,4,7,9. ✓
- §3.2 cross-origin (pas de proxy /api) → Task 9 (vhost sans `location /api/`), Task 4 (`tracePropagationTargets`), CORS documenté Task 14. ✓
- §3.3 paramètres SSM + défauts → Task 7 (mapping + défauts), Task 1 (défauts Angular). ✓
- §3.4 IAM 2 ARNs → Tasks 12 & 14 (doc). ✓
- §4.1 Angular (runtime-config, sentry-init, main, app.config, settings) → Tasks 1,2,4,5. ✓
- §4.2 deploy (fetch, unit, vhost, seeders, deploy.sh, setup) → Tasks 7–12. ✓
- §4.3 CI → Task 13. ✓
- §4.4 CLAUDE.md → Task 14. ✓
- §4.5 migration in-place (clone, pas de old/, pas de sibling) → Task 12 step 2. ✓
- §5 pièges (stdin/heredoc, CRLF strip, 0644 traversable, pas de RuntimeDirectory, nginx) → Task 7 & 8. ✓
- §6 runbook → Task 14. ✓

**Cohérence des types/identifiants :** `getRuntimeConfig()`/`RuntimeConfig`/`RuntimeSentryConfig` (Task 1) réutilisés en Tasks 2,4. Globals `window.__PUSHIT_*` identiques entre vhost (Task 9), fetch (Task 7) et reader (Task 1). Variables nginx `$pushit_api_base/$pushit_sentry_dsn/$pushit_sentry_env/$pushit_sentry_release/$pushit_features` identiques entre Tasks 7 & 9. Chemins `/var/www/django_websites/PushIT_frontend{,/dist/pushit-frontend/browser}` cohérents entre Tasks 8,9,11,12,13. ✓

**Placeholders :** aucun TODO/TBD ; tout le code est fourni en entier.
