import { expect, test } from '@playwright/test';

import { mockConsoleApi, seedAuthenticatedSession } from './support/console-helpers';

const user = {
  id: 1,
  email: 'renaud@example.com',
  username: 'renaud',
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

test('notification detail view renders targeted devices', async ({ page }) => {
  await page.goto('/dashboard/notifications/30');

  await expect(page.getByRole('heading', { name: 'Promo flash' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Devices cibles' })).toBeVisible();
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

  await expect(page.getByText('Application PushIT Mobile supprimee.')).toBeVisible();
  await expect(page.locator('tr', { hasText: 'PushIT Mobile Application mobile' })).toHaveCount(0);
});
