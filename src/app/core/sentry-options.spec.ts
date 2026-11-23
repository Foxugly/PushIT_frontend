import * as Sentry from '@sentry/angular';
import type { BrowserOptions } from '@sentry/angular';

import { buildSentryOptions } from './sentry-options';
import { FILTERED } from './sentry-scrub';

/**
 * Fait tourner les vraies options dans un vrai client Sentry (transport factice)
 * et inspecte les enveloppes qui partiraient : prouve que le nettoyage des jetons
 * s'applique encore aux transactions sous Sentry 11, où `beforeSendTransaction`
 * est ignoré hors `traceLifecycle: 'static'`.
 */
async function sentEnvelopes(
  overrides: Pick<BrowserOptions, 'traceLifecycle'>,
  run: () => void,
): Promise<string> {
  const bodies: string[] = [];
  const decoder = new TextDecoder();
  const options = buildSentryOptions({
    dsn: 'https://public@o0.ingest.sentry.io/1',
    environment: 'test',
    release: '',
  });
  const client = new Sentry.BrowserClient({
    ...options,
    ...overrides,
    // L'instrumentation du navigateur n'est pas l'objet du test.
    integrations: [],
    tracesSampleRate: 1,
    stackParser: Sentry.defaultStackParser,
    transport: (transportOptions) =>
      Sentry.createTransport(transportOptions, async (request) => {
        bodies.push(typeof request.body === 'string' ? request.body : decoder.decode(request.body));
        return { statusCode: 200 };
      }),
  });

  Sentry.withScope((scope) => {
    scope.setClient(client);
    client.init();
    run();
  });
  await client.flush(2000);
  return bodies.join('\n');
}

function navigateWithToken(): void {
  // Comme browserTracingIntegration : tant que la route n'est pas résolue, le
  // nom vaut le pathname brut (source `url`, donc absent du contexte de trace).
  Sentry.startSpan(
    {
      name: '/reset-password/MQ/abc-123',
      op: 'navigation',
      forceTransaction: true,
      attributes: {
        'sentry.segment.name.source': 'url',
        'url.path': '/reset-password/MQ/abc-123',
        'url.full': 'https://pushit.foxugly.com/reset-password/MQ/abc-123',
      },
    },
    () => {
      Sentry.startSpan(
        {
          name: 'GET https://pushit.foxugly.com/auth/magic-link/s3cr3t',
          op: 'http.client',
          attributes: { 'url.full': 'https://pushit.foxugly.com/auth/magic-link/s3cr3t' },
        },
        () => undefined,
      );
    },
  );
}

describe('buildSentryOptions', () => {
  it('pins the restrictive v10 data-collection baseline and the static trace lifecycle', () => {
    const options = buildSentryOptions({ dsn: 'x', environment: 'production', release: '' });
    expect(options.traceLifecycle).toBe('static');
    expect(options.dataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpBodies: [],
      databaseQueryData: false,
    });
    expect(options.release).toBeUndefined();
  });

  it('masks the one-time token in the transaction name and its spans before sending', async () => {
    const sent = await sentEnvelopes({}, navigateWithToken);

    expect(sent).toContain('"type":"transaction"');
    expect(sent).toContain(`/reset-password/${FILTERED}`);
    expect(sent).toContain(`magic-link/${FILTERED}`);
    expect(sent).not.toContain('abc-123');
    expect(sent).not.toContain('s3cr3t');
  });

  it('would leak the token with the v11 default (streamed) lifecycle — why "static" is pinned', async () => {
    const sent = await sentEnvelopes({ traceLifecycle: 'stream' }, navigateWithToken);

    expect(sent).toContain('abc-123');
  });
});
