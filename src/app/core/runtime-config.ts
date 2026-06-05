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
  turnstileSiteKey: string;
  sentry: RuntimeSentryConfig;
  features: Record<string, boolean>;
}

interface RuntimeGlobals {
  __PUSHIT_API_BASE_URL?: string;
  __PUSHIT_TURNSTILE_SITE_KEY?: string;
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

  // Shallow-copied so a consumer mutating config.features never reaches back
  // into the injected window.__PUSHIT_FEATURES global.
  const features =
    globals.__PUSHIT_FEATURES && typeof globals.__PUSHIT_FEATURES === 'object'
      ? { ...globals.__PUSHIT_FEATURES }
      : {};

  return {
    apiBaseUrl: trimmedOr(globals.__PUSHIT_API_BASE_URL, DEFAULT_API_BASE_URL),
    // Cloudflare Turnstile public site key (captcha on register). Empty when not
    // provisioned → the register panel skips the widget and the captcha is not
    // enforced (the backend is gated on its secret the same way). Prod value:
    // SSM /pushit-frontend/prod/TURNSTILE_SITE_KEY.
    turnstileSiteKey: (globals.__PUSHIT_TURNSTILE_SITE_KEY ?? '').trim(),
    sentry: {
      dsn: (globals.__PUSHIT_SENTRY_DSN ?? '').trim(),
      environment: trimmedOr(globals.__PUSHIT_SENTRY_ENV, DEFAULT_SENTRY_ENV),
      release: (globals.__PUSHIT_SENTRY_RELEASE ?? '').trim(),
    },
    features,
  };
}
