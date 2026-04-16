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

test('authenticated user can open the applications dashboard', async ({ page }) => {
  await page.goto('/dashboard/applications');

  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('PushIT Mobile')).toBeVisible();
  await expect(page.getByText('renaud')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ajouter' })).toBeVisible();
});
