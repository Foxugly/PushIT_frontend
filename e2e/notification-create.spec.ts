import { expect, test } from '@playwright/test';
import { mockConsoleApi, seedAuthenticatedSession } from './support/console-helpers';

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

const devices = [
  {
    id: 20,
    device_name: 'iPhone Marie',
    platform: 'ios' as const,
    push_token_status: 'active' as const,
    last_seen_at: '2026-03-27T18:00:00+01:00',
    created_at: '2026-03-27T10:00:00+01:00',
    application_ids: [10],
  },
];

test.beforeEach(async ({ page }) => {
  await seedAuthenticatedSession(page, user);
  await mockConsoleApi(page, {
    user,
    apps,
    devices,
    notifications: [],
    futureNotifications: [],
  });
});

test('user can create an immediate notification and see it in the history', async ({ page }) => {
  await page.goto('/dashboard/notifications');

  // Open the create dialog.
  await page.getByRole('button', { name: 'Ajouter' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // The application is pre-selected from the shell; pick the target device.
  await dialog.getByText('Choisir un ou plusieurs devices').click();
  await page.getByRole('option', { name: /iPhone Marie/ }).click();
  // Close the multiselect overlay.
  await page.keyboard.press('Escape');

  await dialog.getByPlaceholder('Promo weekend').fill('Lancement');
  await dialog.getByPlaceholder('Votre message push').fill('Notre nouvelle campagne est en ligne.');

  await dialog.getByRole('button', { name: 'Créer la notification' }).click();

  // Success banner + the freshly-created row in the history table.
  await expect(page.getByText('Notification envoyée.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Lancement' })).toBeVisible();
});
