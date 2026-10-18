import { getRuntimeConfig, resolveSentryRelease } from './runtime-config';

interface MutableGlobals {
  __PUSHIT_API_BASE_URL?: string;
  __PUSHIT_TURNSTILE_SITE_KEY?: string;
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
    '__PUSHIT_TURNSTILE_SITE_KEY',
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
    expect(config.turnstileSiteKey).toBe('');
    expect(config.sentry).toEqual({ dsn: '', environment: 'production', release: '' });
    expect(config.features).toEqual({});
  });

  it('reads injected runtime globals and trims them', () => {
    globals().__PUSHIT_API_BASE_URL = '  https://pushit-api.foxugly.com/api/v1  ';
    globals().__PUSHIT_TURNSTILE_SITE_KEY = '  0x4AAAAAAA_sitekey  ';
    globals().__PUSHIT_SENTRY_DSN = ' https://abc@sentry.io/1 ';
    globals().__PUSHIT_SENTRY_ENV = 'staging';
    globals().__PUSHIT_SENTRY_RELEASE = 'pushit-frontend-1.2.3';
    globals().__PUSHIT_FEATURES = { beta: true };

    const config = getRuntimeConfig();

    expect(config.apiBaseUrl).toBe('https://pushit-api.foxugly.com/api/v1');
    expect(config.turnstileSiteKey).toBe('0x4AAAAAAA_sitekey');
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

describe('resolveSentryRelease', () => {
  it('prefers the build SHA injected by CI (source maps are uploaded under it)', () => {
    expect(resolveSentryRelease('0123abcd', 'pushit-frontend-1.0.0')).toBe('pushit-frontend@0123abcd');
  });

  it('falls back to the runtime (SSM) release when the build carries no SHA', () => {
    expect(resolveSentryRelease('', ' pushit-frontend-1.0.0 ')).toBe('pushit-frontend-1.0.0');
    expect(resolveSentryRelease('', undefined)).toBe('');
  });
});
