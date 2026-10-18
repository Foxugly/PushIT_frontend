import { expect, Page, Request, test } from '@playwright/test';

import { mockConsoleApi, seedAuthenticatedSession } from './support/console-helpers';

// Console change-password page (POST auth/password/change/). The backend
// blacklists every refresh token of the user and returns a fresh pair, which
// the SPA must store so this session stays signed in.

test.use({ locale: 'fr-FR' });

const user = {
  id: 1,
  email: 'renaud@example.com',
  userkey: 'usr_123',
  is_active: true,
  language: 'FR' as const,
};

async function mockPasswordChange(
  page: Page,
  respond: (body: { current_password: string; new_password: string }) => { status: number; body: unknown },
): Promise<Request[]> {
  const calls: Request[] = [];
  // Registered after mockConsoleApi: Playwright tries the most recent route first.
  await page.route('**/api/v1/auth/password/change/', async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') {
      return route.fallback();
    }
    calls.push(request);
    const { status, body } = respond(request.postDataJSON());
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return calls;
}

async function fillForm(page: Page, current: string, next: string, confirm = next): Promise<void> {
  await page.locator('#change-password-current').fill(current);
  await page.locator('#change-password-new').fill(next);
  await page.locator('#change-password-confirm').fill(confirm);
  await expect(page.locator('#change-password-confirm')).toHaveValue(confirm);
}

test.beforeEach(async ({ page }) => {
  await seedAuthenticatedSession(page, user);
  await mockConsoleApi(page, { user, apps: [], devices: [], notifications: [], futureNotifications: [] });
});

test('changing the password stores the fresh tokens and keeps the session', async ({ page }) => {
  const calls = await mockPasswordChange(page, () => ({
    status: 200,
    body: {
      code: 'password_changed',
      detail: 'Your password has been changed.',
      access: 'access-after-change',
      refresh: 'refresh-after-change',
      user,
    },
  }));

  await page.goto('/dashboard/change-password');
  await expect(page.getByRole('heading', { level: 1, name: 'Changer de mot de passe' })).toBeVisible();
  await expect(page.locator('#change-password-current')).toHaveAttribute('autocomplete', 'current-password');
  await expect(page.locator('#change-password-new')).toHaveAttribute('autocomplete', 'new-password');

  await fillForm(page, 'AncienSecret123!', 'NouveauSecret456?');
  await page.getByRole('button', { name: 'Changer de mot de passe' }).click();

  await expect(page.getByTestId('change-password-success')).toContainText('Votre mot de passe a été changé');
  expect(calls).toHaveLength(1);
  expect(calls[0].postDataJSON()).toEqual({
    current_password: 'AncienSecret123!',
    new_password: 'NouveauSecret456?',
  });

  const stored = await page.evaluate(() => ({
    access: localStorage.getItem('pushit.accessToken'),
    refresh: localStorage.getItem('pushit.refreshToken'),
  }));
  expect(stored).toEqual({ access: 'access-after-change', refresh: 'refresh-after-change' });
  await expect(page).toHaveURL(/\/dashboard\/change-password$/);
  await expect(page.locator('#change-password-current')).toHaveValue('');
});

test('a wrong current password shows a translated error and keeps the tokens', async ({ page }) => {
  await mockPasswordChange(page, () => ({
    status: 400,
    body: { code: 'current_password_invalid', detail: 'Current password is incorrect.' },
  }));

  await page.goto('/dashboard/change-password');
  await fillForm(page, 'mauvais', 'NouveauSecret456?');
  await page.getByRole('button', { name: 'Changer de mot de passe' }).click();

  await expect(page.getByTestId('change-password-error')).toContainText('Le mot de passe actuel est incorrect.');
  expect(await page.evaluate(() => localStorage.getItem('pushit.refreshToken'))).toBe('refresh-token');
});

test('validator messages are listed for a rejected password', async ({ page }) => {
  await mockPasswordChange(page, () => ({
    status: 400,
    body: {
      code: 'password_invalid',
      detail: 'This password is too common.',
      errors: { new_password: ['This password is too common.'] },
    },
  }));

  await page.goto('/dashboard/change-password');
  await fillForm(page, 'AncienSecret123!', 'password123');
  await page.getByRole('button', { name: 'Changer de mot de passe' }).click();

  const error = page.getByTestId('change-password-error');
  await expect(error).toContainText('Ce mot de passe a été refusé');
  await expect(error).toContainText('This password is too common.');
});

test('client-side checks block a mismatching confirmation without calling the API', async ({ page }) => {
  const calls = await mockPasswordChange(page, () => ({ status: 500, body: {} }));

  await page.goto('/dashboard/change-password');
  await fillForm(page, 'AncienSecret123!', 'NouveauSecret456?', 'Different789!');
  await page.getByRole('button', { name: 'Changer de mot de passe' }).click();

  await expect(page.getByText('Les deux mots de passe ne correspondent pas.')).toBeVisible();
  expect(calls).toHaveLength(0);
});

test('the show/hide toggle reveals the typed password', async ({ page }) => {
  await page.goto('/dashboard/change-password');
  const input = page.locator('#change-password-new');
  await input.fill('NouveauSecret456?');
  await expect(input).toHaveAttribute('type', 'password');

  await page.locator('p-password').nth(1).locator('.p-password-toggle-mask-icon').click();
  await expect(input).toHaveAttribute('type', 'text');
});
