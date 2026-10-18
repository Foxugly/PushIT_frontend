import type { Event } from '@sentry/angular';

import { FILTERED, scrubBreadcrumb, scrubEvent, scrubUrl } from './sentry-scrub';

describe('scrubUrl', () => {
  it.each([
    ['https://pushit.foxugly.com/reset-password/MQ/abc-123', `https://pushit.foxugly.com/reset-password/${FILTERED}`],
    ['/auth/confirm-email/MQ/tok-1?x=1', `/auth/confirm-email/${FILTERED}?x=1`],
    ['/auth/magic-link/s3cr3t#frag', `/auth/magic-link/${FILTERED}#frag`],
    ['/auth?uid=MQ&token=abc&code=42&lang=fr', `/auth?uid=${FILTERED}&token=${FILTERED}&code=${FILTERED}&lang=fr`],
    ['/dashboard/applications', '/dashboard/applications'],
  ])('%s', (input, expected) => {
    expect(scrubUrl(input)).toBe(expected);
  });

  it('leaves empty values alone', () => {
    expect(scrubUrl(undefined)).toBeUndefined();
    expect(scrubUrl('')).toBe('');
  });
});

describe('scrubEvent', () => {
  it('scrubs request, transaction, breadcrumbs, spans and trace data', () => {
    const event = {
      type: 'transaction',
      transaction: '/reset-password/MQ/abc-123',
      request: {
        url: 'https://pushit.foxugly.com/reset-password/MQ/abc-123',
        query_string: 'token=abc&lang=fr',
        headers: { Referer: 'https://pushit.foxugly.com/auth/magic-link/zzz' },
      },
      breadcrumbs: [{ category: 'navigation', data: { from: '/', to: '/auth/magic-link/zzz' } }],
      spans: [
        {
          description: 'GET /auth/confirm-email/MQ/tok',
          data: { url: '/auth/confirm-email/MQ/tok' },
        },
      ],
      contexts: { trace: { data: { url: '/auth/magic-link/zzz' } } },
    } as unknown as Event;

    const out = scrubEvent(event);
    const serialized = JSON.stringify(out);

    expect(serialized).not.toContain('abc-123');
    expect(serialized).not.toContain('zzz');
    expect(serialized).not.toContain('MQ/tok');
    expect(out.transaction).toBe(`/reset-password/${FILTERED}`);
    expect(out.request?.query_string).toBe(`token=${FILTERED}&lang=fr`);
  });

  it('keeps an event without URLs intact', () => {
    const event = { message: 'boom' } as Event;
    expect(scrubEvent(event)).toEqual({ message: 'boom' });
  });
});

describe('scrubBreadcrumb', () => {
  it('scrubs xhr/fetch and navigation URLs', () => {
    const crumb = scrubBreadcrumb({
      category: 'fetch',
      message: 'GET /reset-password/MQ/abc',
      data: { url: 'https://x/auth/magic-link/zzz?token=1' },
    });
    expect(crumb.data?.['url']).toBe(`https://x/auth/magic-link/${FILTERED}?token=${FILTERED}`);
    expect(crumb.message).toBe(`GET /reset-password/${FILTERED}`);
  });
});
