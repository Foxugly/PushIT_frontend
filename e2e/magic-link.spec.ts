import { expect, test } from '@playwright/test';
import { mockConsoleApi } from './support/console-helpers';

const user = {
  id: 1,
  email: 'renaud@example.com',
  userkey: 'usr_123',
  is_active: true,
  language: 'FR' as const,
};

const json = (status: number, body: unknown) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

test.beforeEach(async ({ page }) => {
  // The magic-link verify page is a pre-auth visitor screen, so the mocked
  // user's FR language isn't applied there — pin the UI language explicitly so
  // the French copy assertions below match what renders.
  await page.addInitScript(() => localStorage.setItem('pushit.language', 'fr'));
  await mockConsoleApi(page, {
    user,
    apps: [],
    devices: [],
    notifications: [],
    futureNotifications: [],
  });
});

test('a visitor can switch to magic-link mode and request a sign-in link', async ({ page }) => {
  // Registered AFTER the console catch-all so this specific route wins.
  await page.route('**/api/v1/auth/magic-link/', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill(json(200, { code: 'ok', detail: 'sent' }));
  });

  await page.goto('/auth');

  // Switch into inline magic mode via the "ou" divider button (language-tolerant,
  // like login.spec — the e2e browser locale isn't pinned to FR).
  await page.getByRole('button', { name: /Recevoir un lien de connexion|Get a sign-in link/ }).click();

  await page.locator('input[type="email"]').fill(user.email);
  const send = page.getByRole('button', { name: /Envoyer le lien|Send the link/ });
  await expect(send).toBeEnabled();
  await send.click();

  // Anti-leak success confirmation.
  await expect(
    page.getByText(/lien de connexion vient d’être envoyé|sign-in link has just been sent/),
  ).toBeVisible();
});

test('opening the emailed magic link signs the visitor in and lands on the dashboard', async ({
  page,
}) => {
  await page.route('**/api/v1/auth/magic-link/verify/', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill(json(200, { access: 'access-token', refresh: 'refresh-token', user }));
  });

  await page.goto('/auth/magic-link/a-valid-token');

  await expect(page).toHaveURL(/\/dashboard$/);
});

test('an invalid or expired magic link shows the failed state', async ({ page }) => {
  await page.route('**/api/v1/auth/magic-link/verify/', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill(
      json(400, { code: 'magic_link_invalid', detail: 'invalid' }),
    );
  });

  await page.goto('/auth/magic-link/bad-token');

  await expect(
    page.getByText(/Ce lien de connexion est invalide, expiré ou déjà utilisé\./),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Retour à la connexion/ })).toBeVisible();
});
