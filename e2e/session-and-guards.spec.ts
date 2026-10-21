import { expect, Page, test } from '@playwright/test';
import {
  ConsoleState,
  mockConsoleApi,
  REFRESH_COOKIE,
  requestCookies,
  seedAuthenticatedSession,
} from './support/console-helpers';

// Authenticated plumbing: the HttpOnly refresh cookie (silent restore, refresh
// on 401, legacy-token migration, logout across tabs), a rejected refresh
// ending the session, the change-password redirect, and the
// client-side admin / superuser guards. The real authorization boundary is the
// backend (IsAdminUser / IsSuperUser); these only check the UI does not offer
// the pages to accounts that cannot use them.

test.use({ locale: 'fr-FR' });

const baseUser = {
  id: 1,
  email: 'renaud@example.com',
  userkey: 'usr_123',
  is_active: true,
  language: 'FR' as const,
};

const apps = [
  {
    id: 10,
    name: 'PushIT Mobile',
    description: 'Application mobile',
    app_token_prefix: 'apt_12345678',
    enrolment_code: 'apk_Ab12Cd34Ef56',
    enrolment_code_rotated_at: null,
    legacy_send_last_used_at: null,
    inbound_email_alias: 'apt_fc4471fe12345678',
    inbound_email_address: 'apt_fc4471fe12345678@pushit.com',
    is_active: true,
    revoked_at: null,
    last_used_at: null,
    created_at: '2026-03-27T12:00:00+01:00',
  },
];

function state(user: ConsoleState['user']): ConsoleState {
  return { user, apps, devices: [], notifications: [], futureNotifications: [] };
}

/**
 * Application calls presenting the stale `access-token` answer 401, as the
 * backend does once the access JWT expired. Registered AFTER mockConsoleApi so
 * it is matched first (Playwright: most recent route wins). `/auth/me/` is left
 * alone so the silent restore succeeds with that token.
 */
async function expireAccessToken(page: Page): Promise<void> {
  await page.route('**/api/v1/apps/**', async (route) => {
    const auth = route.request().headers()['authorization'];
    if (auth === 'Bearer access-token') {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'token_not_valid', detail: 'Token expired' }),
      });
    }
    return route.fallback();
  });
}

async function storageDump(page: Page): Promise<string> {
  return page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
}

test('a reload restores the session from the HttpOnly cookie, with no token in storage', async ({ page }) => {
  await seedAuthenticatedSession(page, baseUser);
  await mockConsoleApi(page, state(baseUser));
  const refreshes: Array<{ cookies: Record<string, string>; mode?: string; body: unknown }> = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/v1/auth/refresh/')) {
      refreshes.push({
        cookies: requestCookies(request.headers()),
        mode: request.headers()['x-auth-mode'],
        body: request.postDataJSON(),
      });
    }
  });

  await page.goto('/dashboard/applications');
  await expect(page.getByText('PushIT Mobile')).toBeVisible();
  await page.reload();
  await expect(page.getByText('PushIT Mobile')).toBeVisible();

  expect(refreshes).toHaveLength(2);
  for (const refresh of refreshes) {
    expect(refresh.cookies[REFRESH_COOKIE]).toBe('refresh-token');
    expect(refresh.mode).toBe('cookie');
    expect(refresh.body).toEqual({});
  }
  const cookie = (await page.context().cookies()).find((item) => item.name === REFRESH_COOKIE);
  expect(cookie?.httpOnly).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain(REFRESH_COOKIE);
  expect(await storageDump(page)).not.toContain('access-token');
  expect(await storageDump(page)).not.toContain('refresh-token');
});

test('an expired access token is refreshed through the cookie and the call retried', async ({ page }) => {
  await seedAuthenticatedSession(page, baseUser);
  await mockConsoleApi(page, state(baseUser));
  await expireAccessToken(page);

  let refreshCount = 0;
  await page.route('**/api/v1/auth/refresh/', async (route) => {
    refreshCount += 1;
    // 1st = silent restore (still the soon-expired token), 2nd = after the 401.
    const access = refreshCount === 1 ? 'access-token' : 'fresh-access';
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access }) });
  });

  await page.goto('/dashboard/applications');

  // The retried call (Bearer fresh-access) reached the console mock.
  await expect(page.getByText('PushIT Mobile')).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard\/applications$/);
  expect(refreshCount).toBe(2);
  expect(await storageDump(page)).not.toContain('fresh-access');
});

test('a rejected refresh cookie ends the session and sends the user to /auth', async ({ page }) => {
  await seedAuthenticatedSession(page, baseUser);
  await mockConsoleApi(page, state(baseUser));
  await page.route('**/api/v1/auth/refresh/', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'token_not_valid', detail: 'Token is blacklisted' }),
    }),
  );

  await page.goto('/dashboard/applications');

  await expect(page).toHaveURL(/\/auth$/);
});

test('a legacy refresh token in localStorage is migrated once to the cookie, then deleted', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('e2e.seeded')) return;
    sessionStorage.setItem('e2e.seeded', '1');
    localStorage.setItem('pushit.accessToken', 'legacy-access');
    localStorage.setItem('pushit.refreshToken', 'legacy-refresh');
    localStorage.setItem('pushit.user', '{"id":1}');
  });
  await mockConsoleApi(page, state(baseUser));
  const bodies: unknown[] = [];
  await page.route('**/api/v1/auth/refresh/', async (route) => {
    const request = route.request();
    bodies.push(request.postDataJSON());
    const migrating = request.postDataJSON()?.refresh === 'legacy-refresh';
    const hasCookie = Boolean(requestCookies(request.headers())[REFRESH_COOKIE]);
    if (request.headers()['x-auth-mode'] !== 'cookie' || (!migrating && !hasCookie)) {
      return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'set-cookie': `${REFRESH_COOKIE}=rotated; Path=/api/v1/auth/; HttpOnly; SameSite=Lax` },
      body: JSON.stringify({ access: 'access-token' }),
    });
  });

  await page.goto('/dashboard/applications');
  await expect(page.getByText('PushIT Mobile')).toBeVisible();

  expect(bodies).toEqual([{ refresh: 'legacy-refresh' }]);
  const legacy = await page.evaluate(() => [
    localStorage.getItem('pushit.accessToken'),
    localStorage.getItem('pushit.refreshToken'),
    localStorage.getItem('pushit.user'),
  ]);
  expect(legacy).toEqual([null, null, null]);
  expect(await page.evaluate(() => localStorage.getItem('pushit.session'))).not.toBeNull();

  // The next load uses the cookie set by the migration, without a body token.
  await page.reload();
  await expect(page.getByText('PushIT Mobile')).toBeVisible();
  expect(bodies).toEqual([{ refresh: 'legacy-refresh' }, {}]);
});

test('logging out clears the cookie session and the other tabs follow', async ({ page }) => {
  await seedAuthenticatedSession(page, baseUser);
  await mockConsoleApi(page, state(baseUser));
  const other = await page.context().newPage();
  await mockConsoleApi(other, state(baseUser));
  let logoutMode: string | undefined;
  await page.route('**/api/v1/auth/logout/', (route) => {
    logoutMode = route.request().headers()['x-auth-mode'];
    return route.fallback();
  });

  await page.goto('/dashboard/applications');
  await other.goto('/dashboard/applications');
  await expect(other.getByText('PushIT Mobile')).toBeVisible();

  await page.getByRole('button', { name: baseUser.email }).first().click();
  await page.getByRole('menuitem', { name: 'Déconnexion' }).click();

  await expect(page).toHaveURL(/\/auth$/);
  expect(logoutMode).toBe('cookie');
  await expect(other).toHaveURL(/\/auth$/);
  const cookie = (await page.context().cookies()).find((item) => item.name === REFRESH_COOKIE);
  expect(cookie).toBeUndefined();
});

test('the old change-password URL redirects to « Mon compte » when signed in', async ({ page }) => {
  await seedAuthenticatedSession(page, baseUser);
  await mockConsoleApi(page, state(baseUser));

  await page.goto('/dashboard/change-password');

  await expect(page).toHaveURL(/\/dashboard\/settings#security$/);
  await expect(page.getByRole('button', { name: 'Changer de mot de passe' })).toBeVisible();
});

test('the change-password page requires a session', async ({ page }) => {
  await page.goto('/dashboard/change-password');
  await expect(page).toHaveURL(/\/auth$/);
});

test('a non-staff user is bounced from /dashboard/admin to the dashboard', async ({ page }) => {
  const user = { ...baseUser, is_staff: false, is_superuser: false };
  await seedAuthenticatedSession(page, user);
  await mockConsoleApi(page, state(user));

  await page.goto('/dashboard/admin');

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('État du backend')).toHaveCount(0);
});

test('a staff user can open /dashboard/admin', async ({ page }) => {
  const user = { ...baseUser, is_staff: true, is_superuser: false };
  await seedAuthenticatedSession(page, user);
  await mockConsoleApi(page, state(user));

  await page.goto('/dashboard/admin');

  await expect(page.getByText('État du backend').first()).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard\/admin$/);
});

test('a staff user who is not superuser is bounced from /dashboard/accounts', async ({ page }) => {
  const user = { ...baseUser, is_staff: true, is_superuser: false };
  await seedAuthenticatedSession(page, user);
  await mockConsoleApi(page, state(user));

  await page.goto('/dashboard/accounts');

  await expect(page).toHaveURL(/\/dashboard$/);
});

test('a superuser can open /dashboard/accounts', async ({ page }) => {
  const user = { ...baseUser, is_staff: true, is_superuser: true };
  await seedAuthenticatedSession(page, user);
  await mockConsoleApi(page, state(user));

  await page.goto('/dashboard/accounts');

  await expect(page.getByRole('heading', { name: 'Comptes' })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard\/accounts$/);
});

test('an anonymous deep link into the console lands on /auth without calling the API', async ({ page }) => {
  const apiCalls: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/')) apiCalls.push(request.url());
  });

  await page.goto('/dashboard/applications/10?tab=sending');

  await expect(page).toHaveURL(/\/auth$/);
  // No session hint → no silent restore, and the guard runs before any page loads data.
  expect(apiCalls).toEqual([]);
});

for (const guestPath of ['/auth', '/register', '/forgot-password', '/reset-password/MQ/abc-123']) {
  test(`a signed-in user opening ${guestPath} is sent to the dashboard`, async ({ page }) => {
    await seedAuthenticatedSession(page, baseUser);
    await mockConsoleApi(page, state(baseUser));

    await page.goto(guestPath);

    await expect(page).toHaveURL(/\/dashboard$/);
  });
}

test('parallel calls rejected with 401 share a single refresh, then all retry', async ({ page }) => {
  await seedAuthenticatedSession(page, baseUser);
  await mockConsoleApi(page, state(baseUser));
  // Every console call presenting the restored (soon-expired) token answers 401;
  // /auth/* is left alone so the silent restore and the refresh go through.
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const isAuth = new URL(request.url()).pathname.includes('/api/v1/auth/');
    if (!isAuth && request.headers()['authorization'] === 'Bearer access-token') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
    }
    return route.fallback();
  });
  let refreshCount = 0;
  await page.route('**/api/v1/auth/refresh/', async (route) => {
    refreshCount += 1;
    const access = refreshCount === 1 ? 'access-token' : 'fresh-access';
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access }) });
  });
  const retried: string[] = [];
  page.on('request', (request) => {
    if (request.headers()['authorization'] === 'Bearer fresh-access') retried.push(request.url());
  });

  await page.goto('/dashboard');

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect.poll(() => retried.length).toBeGreaterThan(1);
  // 1 = boot restore, 1 = the shared refresh after the burst of 401s.
  expect(refreshCount).toBe(2);
});

test('a refresh failing with a 5xx keeps the session instead of logging out', async ({ page }) => {
  await seedAuthenticatedSession(page, baseUser);
  await mockConsoleApi(page, state(baseUser));
  await expireAccessToken(page);
  let refreshCount = 0;
  await page.route('**/api/v1/auth/refresh/', async (route) => {
    refreshCount += 1;
    if (refreshCount === 1) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access: 'access-token' }),
      });
    }
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/dashboard/applications');

  await expect.poll(() => refreshCount).toBe(2);
  await expect(page).toHaveURL(/\/dashboard\/applications$/);
  expect(await page.evaluate(() => localStorage.getItem('pushit.session'))).not.toBeNull();
});
