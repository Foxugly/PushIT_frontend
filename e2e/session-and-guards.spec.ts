import { expect, Page, test } from '@playwright/test';
import { ConsoleState, mockConsoleApi, seedAuthenticatedSession } from './support/console-helpers';

// Authenticated plumbing: token refresh on 401 (with refresh-token rotation),
// a rejected refresh ending the session, the change-password page, and the
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
 * Every API call presenting the stale `access-token` answers 401, as the
 * backend does once the access JWT expired. Registered AFTER mockConsoleApi so
 * it is matched first (Playwright: most recent route wins).
 */
async function expireAccessToken(page: Page): Promise<void> {
  await page.route('**/api/v1/**', async (route) => {
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

test('an expired access token is refreshed, the call retried, and the rotated refresh kept', async ({ page }) => {
  await seedAuthenticatedSession(page, baseUser);
  await mockConsoleApi(page, state(baseUser));
  await expireAccessToken(page);

  const refreshBodies: unknown[] = [];
  await page.route('**/api/v1/auth/refresh/', async (route) => {
    refreshBodies.push(route.request().postDataJSON());
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ access: 'fresh-access', refresh: 'rotated-refresh' }),
    });
  });

  await page.goto('/dashboard/applications');

  // The retried call (Bearer fresh-access) reached the console mock.
  await expect(page.getByText('PushIT Mobile')).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard\/applications$/);
  expect(refreshBodies[0]).toEqual({ refresh: 'refresh-token' });

  // The backend blacklists the old refresh token: the new one must be persisted.
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('pushit.refreshToken')))
    .toBe('rotated-refresh');
  expect(await page.evaluate(() => localStorage.getItem('pushit.accessToken'))).toBe('fresh-access');
});

test('a rejected refresh token ends the session and sends the user to /auth', async ({ page }) => {
  await seedAuthenticatedSession(page, baseUser);
  await mockConsoleApi(page, state(baseUser));
  await expireAccessToken(page);
  await page.route('**/api/v1/auth/refresh/', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'token_not_valid', detail: 'Token is blacklisted' }),
    }),
  );

  await page.goto('/dashboard/applications');

  await expect(page).toHaveURL(/\/auth$/);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('pushit.refreshToken')))
    .toBeNull();
});

test('the change-password page is reachable when signed in', async ({ page }) => {
  await seedAuthenticatedSession(page, baseUser);
  await mockConsoleApi(page, state(baseUser));

  await page.goto('/dashboard/change-password');

  await expect(page).toHaveURL(/\/dashboard\/change-password$/);
  await expect(page.getByText('Changer de mot de passe').first()).toBeVisible();
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
