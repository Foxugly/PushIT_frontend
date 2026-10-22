import { expect, Page, test } from '@playwright/test';
import { ConsoleState, mockConsoleApi, seedAuthenticatedSession } from './support/console-helpers';

/**
 * Phone layout (390 px): no console page may scroll sideways — wide tables
 * scroll inside their own container — and the console menu lives in the
 * topbar hamburger drawer instead of stacking on top of every page.
 */
const user = {
  id: 1,
  email: 'renaud@example.com',
  userkey: 'usr_123',
  is_active: true,
  language: 'FR' as const,
};

const baseApp = {
  description: 'Alertes du système de surveillance de la maison',
  enrolment_code_rotated_at: null,
  legacy_send_last_used_at: null,
  is_active: true,
  revoked_at: null,
  last_used_at: '2026-10-20T09:00:00+02:00',
  created_at: '2026-03-27T12:00:00+01:00',
};

const notification = (id: number, title: string, status: string) => ({
  id,
  application_id: 10,
  application_name: 'Alarme maison',
  device_ids: [20],
  title,
  message: 'Mouvement détecté dans le salon',
  status,
  created_at: '2026-10-21T08:00:00+02:00',
  scheduled_for: null,
  effective_scheduled_for: null,
  sent_at: status === 'sent' ? '2026-10-21T08:00:01+02:00' : null,
});

const state = (): ConsoleState => ({
  user,
  apps: [
    {
      ...baseApp,
      id: 10,
      name: 'Alarme maison',
      app_token_prefix: 'apt_12345678',
      enrolment_code: 'apk_Ab12Cd34Ef56',
      inbound_email_alias: 'apt_fc4471fe12345678',
      inbound_email_address: 'apt_fc4471fe12345678@pushit.foxugly.com',
    },
  ],
  devices: [
    {
      id: 20,
      device_name: 'iPhone de Marie-Christine',
      platform: 'ios',
      push_token_status: 'active',
      last_seen_at: '2026-10-21T18:00:00+02:00',
      created_at: '2026-03-27T10:00:00+01:00',
      application_ids: [10],
      is_mine: true,
    },
  ],
  notifications: [notification(1, 'Intrusion salon', 'sent'), notification(2, 'Batterie faible', 'failed')],
  futureNotifications: [],
  stats: [
    { status: 'sent', count: 42 },
    { status: 'failed', count: 3 },
  ],
  sendTokens: {
    10: [
      {
        id: 1,
        name: 'Script Raspberry',
        prefix: 'apt_k3y',
        created_at: '2026-04-01T10:00:00+02:00',
        last_used_at: '2026-10-21T08:00:00+02:00',
        revoked_at: null,
        is_active: true,
      },
    ],
  },
  inboundEmailLogs: {
    10: [
      {
        id: 1,
        processed_at: '2026-10-21T08:00:00+02:00',
        status: 'created',
        sender: 'une.adresse.vraiment.longue@exemple-de-domaine.com',
        subject: 'Intrusion salon',
        error_message: '',
        notification_id: 1,
      },
    ],
  },
});

const CONSOLE_PAGES = [
  '/dashboard',
  '/dashboard/applications',
  '/dashboard/applications/new',
  '/dashboard/applications/10',
  '/dashboard/applications/10?tab=recipients',
  '/dashboard/applications/10?tab=email',
  '/dashboard/applications/10?tab=api',
  '/dashboard/applications/10?tab=notifications',
  '/dashboard/applications/10?tab=quiet-periods',
  '/dashboard/notifications',
  '/dashboard/notifications/1',
  '/dashboard/devices',
  '/dashboard/devices/20',
  '/dashboard/quiet-periods',
  '/dashboard/billing',
  '/dashboard/settings',
];

async function horizontalOverflow(page: Page): Promise<{ scrollWidth: number; clientWidth: number }> {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

test.describe('phone layout (390 px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedSession(page, user);
    await mockConsoleApi(page, state());
  });

  for (const url of CONSOLE_PAGES) {
    test(`${url} fits the screen width`, async ({ page }) => {
      await page.goto(url);
      await expect(page.locator('.console-shell__main').locator('h1, h2').first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      // Polled: late renders (counters, lists filled after networkidle) may still widen the page.
      await expect
        .poll(async () => {
          const { scrollWidth, clientWidth } = await horizontalOverflow(page);
          return scrollWidth - clientWidth;
        })
        .toBeLessThanOrEqual(0);
    });
  }

  test('the console menu is in the hamburger drawer, not on top of the page', async ({ page }) => {
    await page.goto('/dashboard/applications');
    await expect(page.getByText('Alarme maison').first()).toBeVisible();

    // The sidebar card is gone below 1024 px, and the drawer is closed.
    await expect(page.locator('.console-shell__sidebar')).toBeHidden();
    const drawerNav = page.getByTestId('console-drawer-nav');
    await expect(drawerNav).toBeHidden();

    await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
    await expect(drawerNav).toBeVisible();
    const devicesLink = drawerNav.getByRole('link', { name: /Devices|Appareils/ });
    await expect(drawerNav.getByRole('link', { name: /Mon compte/ })).toBeVisible();

    // Tap targets stay >= 44 px.
    const box = await devicesLink.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    await devicesLink.click();
    await expect(page).toHaveURL(/\/dashboard\/devices$/);
    // The drawer closes once the navigation is done.
    await expect(drawerNav).toBeHidden();
  });
});

test.describe('desktop layout', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedSession(page, user);
    await mockConsoleApi(page, state());
  });

  test('« Mon compte » keeps the console side menu like every console page', async ({ page }) => {
    await page.goto('/dashboard/settings');
    const sidebar = page.locator('.console-shell__sidebar');
    await expect(sidebar).toBeVisible();
    const account = sidebar.getByRole('link', { name: /Mon compte/ });
    await expect(account).toHaveClass(/is-active/);
    // The drawer copy of the menu is never shown on desktop.
    await expect(page.getByTestId('console-drawer-nav')).toBeHidden();
  });
});
