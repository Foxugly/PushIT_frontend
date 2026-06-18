import { expect, test } from '@playwright/test';
import { mockConsoleApi, mockLogin } from './support/console-helpers';

const user = {
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
    inbound_email_alias: 'apt_fc4471fe12345678',
    inbound_email_address: 'apt_fc4471fe12345678@pushit.com',
    is_active: true,
    revoked_at: null,
    last_used_at: null,
    created_at: '2026-03-27T12:00:00+01:00',
  },
];

test.beforeEach(async ({ page }) => {
  await mockConsoleApi(page, {
    user,
    apps,
    devices: [],
    notifications: [],
    futureNotifications: [],
  });
  // Registered AFTER the console catch-all so this more specific /auth/login/
  // route takes priority (Playwright matches the most recently added route first).
  await mockLogin(page, user);
});

test('a visitor can log in and lands on the dashboard', async ({ page }) => {
  await page.goto('/auth');

  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill('s3cret-pass');

  // Wait for the form to be valid (submit enabled) before clicking.
  const submit = page.getByRole('button', { name: /Se connecter|Sign in|Log in/ });
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page).toHaveURL(/\/dashboard$/);
});
