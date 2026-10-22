import { expect, Page, test } from '@playwright/test';

import { ConsoleState, mockConsoleApi, seedAuthenticatedSession } from './support/console-helpers';

/**
 * Application detail page (UX review 2026-10-22): « Prochaines étapes » on the
 * Aperçu tab (enrol / one-click test notification / e-mail address), the Envoi
 * tab split into « E-mail » and « API / développeurs », and the « Ajouter une
 * période blanche » action.
 */

const user = {
  id: 1,
  email: 'renaud@example.com',
  userkey: 'usr_123',
  is_active: true,
  language: 'FR' as const,
};

function makeApp(id: number, name: string, overrides: Partial<ConsoleState['apps'][number]> = {}) {
  return {
    id,
    name,
    description: '',
    app_token_prefix: `apt_${id}2345678`,
    enrolment_code: `apk_code${id}`,
    enrolment_code_rotated_at: null,
    legacy_send_last_used_at: null,
    inbound_email_alias: `apt_alias${id}`,
    inbound_email_address: `apt_alias${id}@pushit.com`,
    is_active: true,
    revoked_at: null,
    last_used_at: null,
    created_at: '2026-03-27T12:00:00+01:00',
    ...overrides,
  };
}

const devices: ConsoleState['devices'] = [
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
    push_token_status: 'active',
    last_seen_at: null,
    created_at: '2026-03-27T09:00:00+01:00',
    application_ids: [10, 11],
    is_mine: false,
  },
  {
    id: 22,
    device_name: 'Vieux Galaxy',
    platform: 'android',
    push_token_status: 'invalid',
    last_seen_at: null,
    created_at: '2026-03-27T09:00:00+01:00',
    application_ids: [10],
    is_mine: false,
  },
];

async function setup(page: Page, overrides: Partial<ConsoleState> = {}): Promise<ConsoleState> {
  await seedAuthenticatedSession(page, user);
  return mockConsoleApi(page, {
    user,
    apps: [makeApp(10, 'PushIT Mobile'), makeApp(11, 'Backoffice'), makeApp(12, 'Sans abonné')],
    devices,
    notifications: [],
    futureNotifications: [],
    appQuietPeriods: { 10: [], 11: [], 12: [] },
    ...overrides,
  });
}

test.describe('Aperçu › Prochaines étapes', () => {
  test('replaces the facts table and token tag with the next steps', async ({ page }) => {
    await setup(page);
    await page.goto('/dashboard/applications/10');

    const steps = page.getByTestId('next-steps');
    await expect(steps.getByRole('heading', { name: 'Prochaines étapes' })).toBeVisible();
    await expect(steps.getByTestId('next-step-email')).toContainText('apt_alias10@pushit.com');
    // The token prefix now lives on the API tab only, not in the page header.
    await expect(page.locator('app-page-header')).not.toContainText('apt_102345678');
    await expect(page.getByText('Préfixe du jeton')).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Statut' })).toHaveCount(0);
    // Name/description, logo, activation and the danger zone stay on the overview.
    await expect(page.getByTestId('app-settings-form')).toBeVisible();
    await expect(page.getByTestId('danger-zone')).toBeVisible();

    // « Afficher le QR code » opens the existing enrolment panel.
    await steps.getByRole('button', { name: 'Afficher le QR code' }).click();
    await expect(page).toHaveURL(/\/dashboard\/applications\/10\?tab=recipients$/);
    await expect(page.getByTestId('enrolment-panel')).toBeVisible();
  });

  test('sends a test notification to every reachable subscribed device in one click', async ({ page }) => {
    const state = await setup(page);
    await page.goto('/dashboard/applications/10');

    const request = page.waitForRequest(
      (req) => req.url().endsWith('/api/v1/notifications/send/') && req.method() === 'POST',
    );
    await page.getByRole('button', { name: 'Envoyer une notification de test' }).click();
    const payload = (await request).postDataJSON();

    // 22 is linked but its push token is invalid: not targeted.
    expect(payload).toMatchObject({
      application_id: 10,
      device_ids: [20, 21],
      title: 'Notification de test',
    });
    expect(payload.message).toContain('PushIT Mobile');
    await expect(page.locator('.p-toast')).toContainText('Notification de test envoyée à 2 appareil(s).');
    expect(state.notifications[0]).toMatchObject({ application_id: 10, device_ids: [20, 21] });
    // The counters follow (the history reloaded).
    await expect(page.getByTestId('counter-notifications')).toContainText('1');
  });

  test('the test button is disabled, with the reason, when no device is subscribed', async ({ page }) => {
    await setup(page);
    await page.goto('/dashboard/applications/12');

    const step = page.getByTestId('next-step-test');
    await expect(step.getByRole('button', { name: 'Envoyer une notification de test' })).toBeDisabled();
    await expect(step.getByTestId('test-notification-hint')).toContainText('Aucun appareil abonné');
  });
});

test.describe('« E-mail » and « API / développeurs » tabs', () => {
  test('the e-mail tab holds the address, « E-mails reçus » then the sender policy; the API tab the tokens', async ({
    page,
  }) => {
    await setup(page);
    await page.goto('/dashboard/applications/10');

    await page.getByRole('tab', { name: 'E-mail' }).click();
    await expect(page).toHaveURL(/\/dashboard\/applications\/10\?tab=email$/);
    const emailPanel = page.getByRole('tabpanel', { name: 'E-mail' });
    await expect(emailPanel.getByText('apt_alias10@pushit.com')).toBeVisible();
    const journal = emailPanel.getByTestId('inbound-email-log');
    const policy = emailPanel.getByTestId('inbound-sender-policy');
    await expect(journal).toBeVisible();
    await expect(policy).toBeVisible();
    // « E-mails reçus » sits above the sender policy.
    const journalBox = await journal.boundingBox();
    const policyBox = await policy.boundingBox();
    expect(journalBox!.y).toBeLessThan(policyBox!.y);
    // No developer content on the e-mail tab.
    await expect(emailPanel.getByTestId('send-tokens-panel')).toHaveCount(0);
    await expect(emailPanel.getByTestId('legacy-token-block')).toHaveCount(0);

    await page.getByRole('tab', { name: 'API / développeurs' }).click();
    await expect(page).toHaveURL(/\/dashboard\/applications\/10\?tab=api$/);
    const apiPanel = page.getByRole('tabpanel', { name: 'API / développeurs' });
    await expect(apiPanel.getByTestId('send-tokens-panel')).toBeVisible();
    await expect(apiPanel.getByTestId('legacy-token-block')).toBeVisible();
    await expect(apiPanel.getByRole('heading', { name: "Exemples d'envoi" })).toBeVisible();
    await expect(apiPanel.getByTestId('inbound-sender-policy')).toHaveCount(0);
  });

  test('an old ?tab=sending link opens the E-mail tab', async ({ page }) => {
    await setup(page);
    await page.goto('/dashboard/applications/10?tab=sending');

    await expect(page.getByRole('tab', { name: 'E-mail' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('inbound-email-log')).toBeVisible();
  });
});

test('« Ajouter une période blanche » opens the create dialog on this application', async ({ page }) => {
  await setup(page);
  await page.goto('/dashboard/applications/11?tab=quiet-periods');

  await page.getByRole('button', { name: 'Ajouter une période blanche' }).click();

  // The one-shot params are consumed; the dialog targets the application we came from.
  await expect(page).toHaveURL(/\/dashboard\/quiet-periods$/);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Backoffice')).toBeVisible();
});
