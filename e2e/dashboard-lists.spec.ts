import { expect, test } from '@playwright/test';
import { ConsoleState, mockConsoleApi, seedAuthenticatedSession } from './support/console-helpers';

const user = {
  id: 1,
  email: 'renaud@example.com',
  userkey: 'usr_123',
  is_active: true,
  language: 'FR' as const,
};

const app = {
  id: 10,
  name: 'Alarme maison',
  description: '',
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
};

const device = {
  id: 20,
  device_name: 'iPhone Marie',
  platform: 'ios' as const,
  push_token_status: 'active' as const,
  last_seen_at: '2026-03-27T18:00:00+01:00',
  created_at: '2026-03-27T10:00:00+01:00',
  application_ids: [10],
  is_mine: true,
};

function notification(id: number, title: string, status: string) {
  return {
    id,
    application_id: 10,
    application_name: 'Alarme maison',
    device_ids: [20],
    title,
    message: 'Mouvement détecté dans le salon',
    status,
    created_at: '2026-03-27T10:00:00Z',
    scheduled_for: null,
    effective_scheduled_for: null,
    sent_at: status === 'sent' ? '2026-03-27T10:00:05Z' : null,
  };
}

const emptyAccount: ConsoleState = {
  user,
  apps: [],
  devices: [],
  notifications: [],
  futureNotifications: [],
};

const filledAccount: ConsoleState = {
  user,
  apps: [app],
  devices: [device],
  notifications: [
    notification(3, 'Intrusion salon', 'sent'),
    notification(2, 'Batterie faible', 'failed'),
    notification(1, 'Porte ouverte', 'sent'),
  ],
  futureNotifications: [],
  stats: [
    { status: 'sent', count: 2 },
    { status: 'failed', count: 1 },
  ],
};

test.describe('new account', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedSession(page, user);
    await mockConsoleApi(page, emptyAccount);
  });

  test('the dashboard shows the « Pour commencer » checklist', async ({ page }) => {
    await page.goto('/dashboard');

    const checklist = page.getByTestId('getting-started');
    await expect(checklist).toBeVisible();
    await expect(checklist).toContainText('0 sur 3 terminées');
    await expect(checklist.getByTestId('step-app')).toHaveAttribute('data-done', 'false');
    await expect(checklist.getByTestId('step-device')).toHaveAttribute('data-done', 'false');
    await expect(checklist.getByTestId('step-notification')).toHaveAttribute('data-done', 'false');
    // Nothing to list yet: no empty « Dernières notifications » block.
    await expect(page.getByTestId('dashboard-recent')).toHaveCount(0);

    await checklist.getByRole('link', { name: 'Créer une application' }).click();
    await expect(page).toHaveURL(/\/dashboard\/applications\/new$/);
  });

  test('every list shows an empty state with a call-to-action', async ({ page }) => {
    await page.goto('/dashboard/applications');
    await expect(page.getByText("Aucune application pour l'instant")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Créer ma première application' })).toBeVisible();

    await page.goto('/dashboard/devices');
    await expect(page.getByText("Aucun appareil pour l'instant")).toBeVisible();
    await expect(page.locator('app-empty-state').getByRole('link', { name: 'Créer une application' })).toBeVisible();

    await page.goto('/dashboard/notifications');
    await expect(page.getByText('Aucune notification envoyée')).toBeVisible();
    // No filter bar / status chips on an empty list.
    await expect(page.locator('.notifications-filters')).toHaveCount(0);
    await page.locator('app-empty-state').getByRole('link', { name: 'Créer une application' }).click();
    await expect(page).toHaveURL(/\/dashboard\/applications\/new$/);
  });
});

test.describe('account with data', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedSession(page, user);
    await mockConsoleApi(page, filledAccount);
  });

  test('the dashboard links its counters, lists recent sends and failures, and hides the checklist', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    await expect(page.getByTestId('dashboard-recent')).toContainText('Intrusion salon');
    await expect(page.getByTestId('getting-started')).toHaveCount(0);

    const failures = page.getByTestId('dashboard-failures');
    await expect(failures).toContainText('Batterie faible');
    await expect(failures).not.toContainText('Intrusion salon');

    await expect(page.getByTestId('metric-devices')).toHaveAttribute('href', '/dashboard/devices');
    const quickActions = page.getByTestId('dashboard-quick-actions');
    await expect(quickActions.getByRole('link', { name: 'Nouvelle application' })).toBeVisible();

    // « Voir les échecs » lands on the notifications list filtered on failures.
    await failures.getByRole('link', { name: /Voir les échecs/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/notifications\?status=failed$/);
    await expect(page.getByTestId('status-chip-failed')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('link', { name: 'Batterie faible' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Intrusion salon' })).toHaveCount(0);
  });

  test('« Nouvelle notification » opens the create dialog', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByTestId('dashboard-quick-actions').getByRole('link', { name: 'Nouvelle notification' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/notifications$/);
  });

  test('status chips filter live, the URL keeps the state across a reload', async ({ page }) => {
    await page.goto('/dashboard/notifications');

    await expect(page.getByTestId('status-chip-all')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('link', { name: 'Batterie faible' })).toBeVisible();

    await page.getByTestId('status-chip-sent').click();
    await expect(page).toHaveURL(/status=sent/);
    await expect(page.getByRole('link', { name: 'Batterie faible' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Intrusion salon' })).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('status-chip-sent')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('link', { name: 'Batterie faible' })).toHaveCount(0);

    // Clicking the active chip clears the filter.
    await page.getByTestId('status-chip-sent').click();
    await expect(page).not.toHaveURL(/status=/);
    await expect(page.getByRole('link', { name: 'Batterie faible' })).toBeVisible();
  });

  test('the application filter applies without an « Appliquer » button', async ({ page }) => {
    await page.goto('/dashboard/notifications');
    await expect(page.getByRole('button', { name: 'Appliquer' })).toHaveCount(0);

    await page.locator('.notifications-filters p-select').first().click();
    await page.getByRole('option', { name: 'Alarme maison' }).click();

    await expect(page).toHaveURL(/application=10/);
    await expect(page.getByRole('button', { name: 'Réinitialiser' })).toBeVisible();
  });

  test('the filter bar never overlaps at desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard/notifications?status=sent');

    const fields = page.locator('.notifications-filters > *');
    await expect(page.getByRole('button', { name: 'Réinitialiser' })).toBeVisible();
    const boxes = await fields.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      }),
    );
    expect(boxes.length).toBe(5);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const overlap = a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
        expect(overlap, `filter items ${i} and ${j} overlap`).toBe(false);
      }
    }
  });
});
