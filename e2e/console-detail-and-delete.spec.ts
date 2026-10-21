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
        is_mine: true,
      },
      {
        id: 21,
        device_name: 'Pixel QA',
        platform: 'android',
        push_token_status: 'invalid',
        last_seen_at: null,
        created_at: '2026-03-27T09:00:00+01:00',
        application_ids: [10],
        // A subscriber's device: the app owner sees it, read-only.
        is_mine: false,
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

  // Aperçu: status facts + counters.
  await expect(page.getByRole('heading', { name: 'PushIT Mobile' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Statut' })).toBeVisible();
  await expect(page.getByTestId('counter-devices')).toContainText('2');
  await expect(page.getByTestId('counter-notifications')).toContainText('1');

  await page.getByRole('tab', { name: 'Destinataires' }).click();
  await expect(page.getByRole('heading', { name: 'Devices' })).toBeVisible();
  await expect(page.getByText('iPhone Marie')).toBeVisible();

  await page.getByRole('tab', { name: 'Notifications' }).click();
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
  await expect(page.getByText('Promo flash')).toBeVisible();
});

test('"Nouvelle notification" opens the create modal pre-selected on the app', async ({ page }) => {
  await page.goto('/dashboard/applications/10?tab=notifications');

  await page.getByRole('button', { name: 'Nouvelle notification' }).click();

  // The one-shot create/app params are consumed and dropped from the URL.
  await expect(page).toHaveURL(/\/dashboard\/notifications$/);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('PushIT Mobile')).toBeVisible();
});

test('the enrolment block shows the code and warns that rotating evicts nobody', async ({ page }) => {
  await page.goto('/dashboard/applications/10?tab=recipients');

  const panel = page.getByTestId('enrolment-panel');
  await expect(panel.getByTestId('enrolment-code')).toHaveText('apk_Ab12Cd34Ef56');
  await expect(panel.getByText('Il ne retire personne', { exact: false })).toBeVisible();

  await panel.getByRole('button', { name: 'Nouveau code' }).click();
  await expect(page.getByRole('dialog', { name: 'Confirmation' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmer' }).click();

  await expect(panel.getByTestId('enrolment-code')).toHaveText('apk_rotated10');
});

test('a send token is shown once at creation, then only behind the password', async ({ page }) => {
  await page.goto('/dashboard/applications/10?tab=sending');

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
  await page.goto('/dashboard/applications/10?tab=recipients');

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

test('the applications list offers three row actions and opens the app on row click', async ({ page }) => {
  await page.goto('/dashboard/applications');

  const appRow = page.getByTestId('app-row').filter({ hasText: 'PushIT Mobile' });
  await expect(appRow).toBeVisible();
  await expect(appRow.locator('.console-icon-actions button')).toHaveCount(3);
  await expect(appRow.getByRole('button', { name: 'QR code' })).toBeVisible();
  await expect(appRow.getByRole('button', { name: 'Désactiver' })).toBeVisible();
  await expect(appRow.getByRole('button', { name: "Ouvrir l'application" })).toBeVisible();

  // The QR action opens the enrolment dialog without navigating.
  await appRow.getByRole('button', { name: 'QR code' }).click();
  await expect(page.getByRole('dialog', { name: "QR code d'enrôlement" })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard\/applications$/);
  await page.keyboard.press('Escape');

  // Clicking the row (outside the name link and the actions) opens the app.
  await appRow.locator('td').nth(1).click();
  await expect(page).toHaveURL(/\/dashboard\/applications\/10$/);
});

test('application deletion lives in the Aperçu danger zone', async ({ page }) => {
  await page.goto('/dashboard/applications/10');

  const danger = page.getByTestId('danger-zone');
  await expect(danger.getByRole('heading', { name: 'Zone de danger' })).toBeVisible();
  await danger.getByRole('button', { name: "Supprimer l'application" }).click();

  await expect(page.getByRole('dialog', { name: 'Confirmation' })).toBeVisible();
  await expect(page.getByText('Supprimer l\'application "PushIT Mobile" ?')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmer' }).click();

  // Back on the list, without the deleted application.
  await expect(page).toHaveURL(/\/dashboard\/applications$/);
  await expect(page.getByTestId('app-row')).toHaveCount(0);
});

test("devices list offers edit/delete only on the user's own devices", async ({ page }) => {
  await page.goto('/dashboard/devices');

  const ownRow = page.locator('tr', { hasText: 'iPhone Marie' });
  await expect(ownRow.getByRole('button', { name: 'Éditer' })).toBeVisible();
  await expect(ownRow.getByRole('button', { name: 'Supprimer' })).toBeVisible();
  await expect(ownRow.getByTestId('device-read-only')).toHaveCount(0);

  const subscriberRow = page.locator('tr', { hasText: 'Pixel QA' });
  await expect(subscriberRow.getByRole('button', { name: 'Voir le détail' })).toBeVisible();
  await expect(subscriberRow.getByRole('button', { name: 'Éditer' })).toHaveCount(0);
  await expect(subscriberRow.getByRole('button', { name: 'Supprimer' })).toHaveCount(0);
  await expect(subscriberRow.getByTestId('device-read-only')).toBeVisible();
});

test("a subscriber's device detail is read-only", async ({ page }) => {
  await page.goto('/dashboard/devices/21');

  await expect(page.getByTestId('device-read-only')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Éditer le device' })).toHaveCount(0);

  await page.goto('/dashboard/devices/20');
  await expect(page.getByRole('button', { name: 'Éditer le device' })).toBeVisible();
  await expect(page.getByTestId('device-read-only')).toHaveCount(0);
});
