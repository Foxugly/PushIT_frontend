import { expect, test } from '@playwright/test';

const user = {
  id: 1,
  email: 'renaud@example.com',
  username: 'renaud',
  userkey: 'usr_123',
  is_active: true,
  language: 'FR',
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
    platform: 'ios',
    push_token_status: 'active',
    last_seen_at: '2026-03-27T18:00:00+01:00',
    created_at: '2026-03-27T10:00:00+01:00',
    application_ids: [10],
  },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(([storedUser]) => {
    localStorage.setItem('pushit.accessToken', 'access-token');
    localStorage.setItem('pushit.refreshToken', 'refresh-token');
    localStorage.setItem('pushit.user', JSON.stringify(storedUser));
  }, [user]);

  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    let body: unknown = null;

    if (path.endsWith('/auth/me/')) {
      body = user;
    } else if (path.endsWith('/apps/')) {
      body = apps;
    } else if (path.endsWith('/devices/')) {
      body = devices;
    } else if (path.endsWith('/notifications/')) {
      body = [];
    } else if (path.endsWith('/notifications/future/')) {
      body = [];
    } else if (path.endsWith('/notifications/stats/')) {
      body = [];
    } else if (path.endsWith('/apps/10/quiet-periods/')) {
      body = [];
    } else if (path.endsWith('/devices/20/quiet-periods/')) {
      body = [];
    } else {
      return route.fulfill({ status: 404, body: '{}' });
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
});

test('authenticated user can open the applications dashboard', async ({ page }) => {
  await page.goto('/dashboard/applications');

  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('PushIT Mobile')).toBeVisible();
  await expect(page.getByText('renaud')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ajouter' })).toBeVisible();
});
