import { expect, test } from '@playwright/test';

import { mockConsoleApi, seedAuthenticatedSession } from './support/console-helpers';

const user = {
  id: 1,
  email: 'renaud@example.com',
  userkey: 'usr_123',
  is_active: true,
  language: 'FR' as const,
};

test.describe('Console: delete my account', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedSession(page, user);
    await mockConsoleApi(page, {
      user,
      apps: [],
      devices: [],
      notifications: [],
      futureNotifications: [],
    });
  });

  test('a wrong password keeps the dialog open, the right one erases and signs out', async ({ page }) => {
    const bodies: unknown[] = [];
    // Registered after mockConsoleApi so it wins over the catch-all.
    await page.route('**/api/v1/auth/me/', async (route) => {
      const request = route.request();
      if (request.method() !== 'DELETE') {
        return route.fallback();
      }
      const body = request.postDataJSON() as { current_password?: string };
      bodies.push(body);
      if (body.current_password !== 'hunter2') {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'current_password_invalid', detail: 'Current password is incorrect.' }),
        });
      }
      return route.fulfill({ status: 204, body: '' });
    });

    await page.goto('/dashboard/settings');
    const panel = page.getByTestId('delete-account-panel');
    await panel.getByRole('button', { name: 'Supprimer mon compte' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Supprimer définitivement votre compte ?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('supprimées pour tout le monde', { exact: false })).toBeVisible();

    const password = dialog.getByLabel('Mot de passe actuel');
    await password.fill('wrong');
    await expect(password).toHaveValue('wrong');
    await dialog.getByRole('button', { name: 'Supprimer définitivement' }).click();

    await expect(dialog.getByTestId('delete-account-error')).toHaveText('Mot de passe actuel incorrect.');
    await expect(dialog).toBeVisible();

    await password.fill('hunter2');
    await expect(password).toHaveValue('hunter2');
    await dialog.getByRole('button', { name: 'Supprimer définitivement' }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Votre compte a été supprimé.')).toBeVisible();
    expect(bodies).toEqual([{ current_password: 'wrong' }, { current_password: 'hunter2' }]);

    expect(await page.evaluate(() => localStorage.getItem('pushit.session'))).toBeNull();
  });

  test('cancel closes the dialog without calling the API', async ({ page }) => {
    let called = false;
    await page.route('**/api/v1/auth/me/', async (route) => {
      if (route.request().method() === 'DELETE') {
        called = true;
        return route.fulfill({ status: 204, body: '' });
      }
      return route.fallback();
    });

    await page.goto('/dashboard/settings');
    await page.getByTestId('delete-account-panel').getByRole('button', { name: 'Supprimer mon compte' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Supprimer définitivement votre compte ?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Annuler' }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/dashboard\/settings$/);
    expect(called).toBe(false);
  });
});

test.describe('Public account-deletion page', () => {
  // Anonymous visitors get the browser language; pin it so the copy is French.
  test.use({ locale: 'fr-FR' });

  test('explains the steps without being signed in', async ({ page }) => {
    await page.goto('/account-deletion');

    await expect(page.getByRole('heading', { level: 1, name: 'Supprimer votre compte PushIT' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Données supprimées' })).toBeVisible();
    await expect(page.getByText('rvilain@foxugly.com', { exact: false })).toBeVisible();
  });

  test('is linked from the privacy policy', async ({ page }) => {
    await page.goto('/privacy');

    await page.getByRole('link', { name: 'Comment supprimer votre compte' }).click();
    await expect(page).toHaveURL(/\/account-deletion$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Supprimer votre compte PushIT' })).toBeVisible();
  });
});
