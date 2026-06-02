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
