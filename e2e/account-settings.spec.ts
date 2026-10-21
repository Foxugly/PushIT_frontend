import { expect, Request, test } from '@playwright/test';

import { mockConsoleApi, seedAuthenticatedSession } from './support/console-helpers';

// « Mon compte » (/dashboard/settings): account, security and danger zone, one
// column, no API URL editor.

test.use({ locale: 'fr-FR' });

const user = {
  id: 1,
  email: 'renaud@example.com',
  userkey: 'usr_123',
  is_active: true,
  language: 'FR' as const,
};

test.beforeEach(async ({ page }) => {
  await seedAuthenticatedSession(page, user);
  await mockConsoleApi(page, { user, apps: [], devices: [], notifications: [], futureNotifications: [] });
});

test('shows the three blocks without the API URL nor the session card', async ({ page }) => {
  await page.goto('/dashboard/settings');

  await expect(page.getByRole('heading', { level: 1, name: 'Mon compte' })).toBeVisible();
  for (const name of ['Compte', 'Sécurité', 'Zone de danger']) {
    await expect(page.getByRole('heading', { level: 3, name, exact: true })).toBeVisible();
  }
  await expect(page.getByTestId('account-email')).toHaveText('renaud@example.com');
  await expect(page.getByTestId('account-userkey')).toHaveText('usr_123');

  await expect(page.getByText('URL API')).toHaveCount(0);
  await expect(page.getByText('Préfixe actif')).toHaveCount(0);
  await expect(page.getByText('Compte connecté')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toHaveCount(0);
});

test('copies the userkey to the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/dashboard/settings');

  await page.getByRole('button', { name: 'Copier la clé utilisateur' }).click();

  await expect(page.getByText('Clé utilisateur copiée.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('usr_123');
});

test('saves the language as soon as it is picked', async ({ page }) => {
  const patches: Request[] = [];
  page.on('request', (request) => {
    if (request.method() === 'PATCH' && request.url().endsWith('/auth/me/')) {
      patches.push(request);
    }
  });

  await page.goto('/dashboard/settings');
  await page.locator('#account-language').click();
  await page.getByRole('option', { name: 'English' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'My account' })).toBeVisible();
  await expect(page.getByText('Account language saved.')).toBeVisible();
  expect(patches).toHaveLength(1);
  expect(patches[0].postDataJSON()).toEqual({ language: 'EN' });
});
