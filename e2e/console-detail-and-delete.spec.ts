import { expect, test } from '@playwright/test';

import { mockConsoleApi, seedAuthenticatedSession } from './support/console-helpers';

const user = {
  id: 1,
  email: 'renaud@example.com',
  userkey: 'usr_123',
  is_active: true,
  language: 'FR' as const,
};

test.beforeEach(async ({ page }) => {
  await seedAuthenticatedSession(page, user);

  await mockConsoleApi(page, {
    user,
    apps: [
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
    ],
    devices: [
      {
        id: 20,
        device_name: 'iPhone Marie',
        platform: 'ios',
        push_token_status: 'active',
        last_seen_at: '2026-03-27T18:00:00+01:00',
        created_at: '2026-03-27T10:00:00+01:00',
        application_ids: [10],
      },
      {
        id: 21,
        device_name: 'Pixel QA',
        platform: 'android',
        push_token_status: 'invalid',
        last_seen_at: null,
        created_at: '2026-03-27T09:00:00+01:00',
        application_ids: [10],
      },
    ],
    notifications: [
      {
        id: 30,
        application_id: 10,
        application_name: 'PushIT Mobile',
        device_ids: [20, 21],
        title: 'Promo flash',
        message: 'Disponible maintenant.',
        status: 'draft',
        created_at: '2026-03-27T10:00:00Z',
        scheduled_for: null,
        effective_scheduled_for: null,
        sent_at: null,
      },
    ],
    futureNotifications: [],
    stats: [{ status: 'draft', count: 1 }],
    appQuietPeriods: { 10: [] },
    deviceQuietPeriods: { 20: [], 21: [] },
  });
});

test('application detail view renders linked devices and notifications', async ({ page }) => {
  await page.goto('/dashboard/applications/10');

  await expect(page.getByRole('heading', { name: 'PushIT Mobile' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Devices' })).toBeVisible();
  await expect(page.getByText('iPhone Marie')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
  await expect(page.getByText('Promo flash')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Statut' })).toBeVisible();
});

test('the enrolment block shows the code and warns that rotating evicts nobody', async ({ page }) => {
  await page.goto('/dashboard/applications/10');

  const panel = page.getByTestId('enrolment-panel');
  await expect(panel.getByTestId('enrolment-code')).toHaveText('apk_Ab12Cd34Ef56');
  await expect(panel.getByText('Il ne retire personne', { exact: false })).toBeVisible();

  await panel.getByRole('button', { name: 'Nouveau code' }).click();
  await expect(page.getByRole('dialog', { name: 'Confirmation' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmer' }).click();

  await expect(panel.getByTestId('enrolment-code')).toHaveText('apk_rotated10');
});

test('a send token is shown once at creation, then only behind the password', async ({ page }) => {
  await page.goto('/dashboard/applications/10');

  const panel = page.getByTestId('send-tokens-panel');
  await panel.getByPlaceholder('prod, script de nuit, ...').fill('prod');
  await panel.getByRole('button', { name: 'Créer un jeton' }).click();

  // Served once by the creation itself…
  await expect(panel.getByTestId('created-send-token')).toHaveText('apt_new1rawsecret000000');
  await panel.getByRole('button', { name: "J'ai copié" }).click();
  await expect(panel.getByTestId('created-send-token')).toHaveCount(0);

  // …then only by a reveal that re-asks the password.
  await panel.getByRole('button', { name: 'Revoir le jeton' }).click();
  await panel.getByPlaceholder('Votre mot de passe').fill('hunter2');
  await panel.getByRole('button', { name: 'Afficher', exact: true }).click();

  await expect(panel.getByTestId('revealed-send-token')).toHaveText('apt_revealedrawsecret00');
});

test('the owner evicts a subscriber from the application', async ({ page }) => {
  await page.goto('/dashboard/applications/10');

  const deviceRow = page.locator('tr', { hasText: 'iPhone Marie' });
  await expect(deviceRow).toBeVisible();
  await deviceRow.getByRole('button', { name: "Retirer de l'application" }).click();

  await expect(page.getByRole('dialog', { name: 'Confirmation' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmer' }).click();

  await expect(page.getByText("Terminal retiré de l'application.")).toBeVisible();
  await expect(page.locator('tr', { hasText: 'iPhone Marie' })).toHaveCount(0);
  // Rotating the enrolment code is the companion gesture — the page says so.
  await expect(page.getByText("changez aussi le code", { exact: false })).toBeVisible();
});

test('notification detail view renders targeted devices', async ({ page }) => {
  await page.goto('/dashboard/notifications/30');

  await expect(page.getByRole('heading', { name: 'Promo flash' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Devices ciblés' })).toBeVisible();
  await expect(page.getByText('iPhone Marie')).toBeVisible();
  await expect(page.getByText('Pixel QA')).toBeVisible();
});

test('application deletion uses the shared confirmation dialog', async ({ page }) => {
  await page.goto('/dashboard/applications');

  const appRow = page.locator('tr', { hasText: 'PushIT Mobile' });
  await expect(appRow).toBeVisible();
  await appRow.locator('button').last().click();

  await expect(page.getByRole('dialog', { name: 'Confirmation' })).toBeVisible();
  await expect(page.getByText('Supprimer l\'application "PushIT Mobile" ?')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmer' }).click();

  await expect(page.getByText('Application PushIT Mobile supprimée.')).toBeVisible();
  await expect(page.locator('tr', { hasText: 'PushIT Mobile Application mobile' })).toHaveCount(0);
});
