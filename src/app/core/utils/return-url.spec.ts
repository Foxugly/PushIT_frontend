import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_RETURN_URL,
  rememberReturnUrl,
  safeReturnUrl,
  takeRememberedReturnUrl,
} from './return-url';

describe('safeReturnUrl', () => {
  it.each([
    '/dashboard/applications/10?tab=sending',
    '/dashboard/notifications?app=3&create=1#top',
    '/dashboard/settings#security',
    '/about',
    '/authors-page',
  ])('keeps the same-app path %s', (url) => {
    expect(safeReturnUrl(url)).toBe(url);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a number', 42],
    ['an empty string', ''],
    ['a relative path without slash', 'dashboard'],
    ['protocol-relative', '//evil.example/dashboard'],
    ['backslash host', '/\\evil.example'],
    ['backslash further in', '/dashboard\\..\\x'],
    ['an absolute URL', 'https://evil.example/dashboard'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a data: URL', 'data:text/html,<script>alert(1)</script>'],
    ['a tab', '/\t/evil.example'],
    ['a newline', '/dashboard\n'],
    ['a NUL', '/dashboard\u0000'],
    ['DEL', '/dash\u007fboard'],
    ['the login page', '/auth'],
    ['the login page with a query', '/auth?returnUrl=/dashboard'],
    ['a login sub-page', '/auth/magic-link/abc'],
    ['the login page (case)', '/AUTH'],
    ['register', '/register'],
    ['forgot-password', '/forgot-password'],
    ['reset-password', '/reset-password/uid/token'],
    ['an overlong value', `/${'a'.repeat(3000)}`],
  ])('falls back to the dashboard for %s', (_label, url) => {
    expect(safeReturnUrl(url)).toBe(DEFAULT_RETURN_URL);
  });
});

describe('remembered return URL (magic link round trip)', () => {
  afterEach(() => localStorage.clear());

  it('remembers a safe URL once', () => {
    rememberReturnUrl('/dashboard/devices');

    expect(takeRememberedReturnUrl()).toBe('/dashboard/devices');
    expect(takeRememberedReturnUrl()).toBe(DEFAULT_RETURN_URL);
  });

  it('does not store an unsafe URL and clears a previous one', () => {
    rememberReturnUrl('/dashboard/devices');
    rememberReturnUrl('//evil.example');

    expect(takeRememberedReturnUrl()).toBe(DEFAULT_RETURN_URL);
  });

  it('re-sanitises what it reads back', () => {
    localStorage.setItem('pushit.returnUrl', 'https://evil.example');

    expect(takeRememberedReturnUrl()).toBe(DEFAULT_RETURN_URL);
  });
});
