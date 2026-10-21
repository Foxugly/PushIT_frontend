import { expect, test } from '@playwright/test';

import { ConsoleState, mockConsoleApi, seedAuthenticatedSession } from './support/console-helpers';

const user = {
  id: 1,
  email: 'renaud@example.com',
  userkey: 'usr_123',
  is_active: true,
  language: 'FR' as const,
};

let state: ConsoleState;

test.beforeEach(async ({ page }) => {
  await seedAuthenticatedSession(page, user);
  state = await mockConsoleApi(page, {
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
    devices: [],
    notifications: [],
    futureNotifications: [],
  });
});

test('the owner sets who may send by e-mail and how refusals are reported', async ({ page }) => {
  await page.goto('/dashboard/applications/10?tab=sending');

  const panel = page.getByTestId('inbound-sender-policy');
  await expect(panel.getByRole('heading', { name: 'Qui peut envoyer par e-mail' })).toBeVisible();
  // Defaults: owner only, e-mail notice on, no reply to the sender.
  await expect(panel.getByLabel(/Propriétaire seulement/)).toBeChecked();
  await expect(panel.getByLabel('Me prévenir par e-mail')).toBeChecked();
  await expect(panel.getByLabel(/Répondre à l'expéditeur/)).not.toBeChecked();
  await expect(panel.getByTestId('sender-reply-warning')).toContainText('backscatter');

  // Allowlist (owner mode only) + blocklist, normalized by the server.
  const allowlist = panel.getByRole('textbox', { name: 'Expéditeurs autorisés' });
  await allowlist.fill('Ally@Partner.io\n@corp.io');
  await expect(allowlist).toHaveValue('Ally@Partner.io\n@corp.io');
  await panel.getByRole('textbox', { name: 'Expéditeurs bloqués' }).fill('spam@corp.io');
  await panel.getByLabel('Me prévenir par notification push').click();
  await panel.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(panel.getByText('Règles de réception par e-mail enregistrées.')).toBeVisible();
  await expect(allowlist).toHaveValue('ally@partner.io\n@corp.io');
  expect(state.apps[0]).toMatchObject({
    inbound_sender_mode: 'owner',
    inbound_sender_allowlist: ['ally@partner.io', '@corp.io'],
    inbound_sender_blocklist: ['spam@corp.io'],
    inbound_rejection_notify_email: true,
    inbound_rejection_notify_push: true,
    inbound_rejection_reply_to_sender: false,
  });
});

test('« Tout le monde » hides the allowlist and invalid entries block the save', async ({ page }) => {
  await page.goto('/dashboard/applications/10?tab=sending');
  const panel = page.getByTestId('inbound-sender-policy');

  await panel.getByLabel(/Tout le monde/).click();
  await expect(panel.getByRole('textbox', { name: 'Expéditeurs autorisés' })).toHaveCount(0);

  await panel.getByRole('textbox', { name: 'Expéditeurs bloqués' }).fill('not-an-address');
  await expect(panel.getByText('Entrées invalides : not-an-address')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();

  await panel.getByRole('textbox', { name: 'Expéditeurs bloqués' }).fill('@spam.io');
  await panel.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(panel.getByText('Règles de réception par e-mail enregistrées.')).toBeVisible();
  expect(state.apps[0]).toMatchObject({ inbound_sender_mode: 'anyone', inbound_sender_blocklist: ['@spam.io'] });
});

test('unsaved policy edits survive an overview save and a tab switch, and leaving asks first', async ({ page }) => {
  await page.goto('/dashboard/applications/10?tab=sending');
  const panel = page.getByTestId('inbound-sender-policy');
  const blocklist = panel.getByRole('textbox', { name: 'Expéditeurs bloqués' });
  await blocklist.fill('spam@corp.io');
  await expect(blocklist).toHaveValue('spam@corp.io');
  await expect(panel.getByTestId('sender-policy-unsaved')).toHaveText('Modifications non enregistrées');

  // Save something else on the page: the application reloads, the policy draft stays.
  await page.getByRole('tab', { name: 'Aperçu' }).click();
  const form = page.getByTestId('app-settings-form');
  await form.getByRole('textbox').first().fill('PushIT Mobile V2');
  await expect(form.getByTestId('app-settings-unsaved')).toBeVisible();
  await form.getByRole('button', { name: /enregistrer/i }).click();
  await expect(page.getByText('Application mise à jour.')).toBeVisible();
  await expect(form.getByTestId('app-settings-unsaved')).toHaveCount(0);

  await page.getByRole('tab', { name: 'Envoi' }).click();
  await expect(blocklist).toHaveValue('spam@corp.io');
  expect(state.apps[0].inbound_sender_blocklist ?? []).toEqual([]);

  // Leaving the page: the app's own confirm dialog; « Rester » keeps everything.
  await page.getByRole('link', { name: 'Retour aux applications' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Vous avez des modifications non enregistrées. Quitter sans enregistrer ?');
  await dialog.getByRole('button', { name: 'Rester' }).click();
  await expect(page).toHaveURL(/\/dashboard\/applications\/10\?tab=sending$/);
  await expect(blocklist).toHaveValue('spam@corp.io');

  await page.getByRole('link', { name: 'Retour aux applications' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Quitter sans enregistrer' }).click();
  await expect(page).toHaveURL(/\/dashboard\/applications$/);
});

test('@*.domain entries are accepted and the formats are explained on the info icon', async ({ page }) => {
  await page.goto('/dashboard/applications/10?tab=sending');
  const panel = page.getByTestId('inbound-sender-policy');

  const help = panel.getByTestId('sender-allowlist-help');
  await help.focus();
  await expect(page.locator('.p-tooltip')).toContainText('@*.exemple.com : le domaine et tous ses sous-domaines');
  await expect(help).toHaveAttribute('aria-label', /@exemple\.com : tout le domaine exemple\.com \(sans les sous-domaines\)/);

  const allowlist = panel.getByRole('textbox', { name: 'Expéditeurs autorisés' });
  await allowlist.fill('@*.Partner.io\n@*bad.io');
  await expect(panel.getByText('Entrées invalides : @*bad.io')).toBeVisible();
  await allowlist.fill('@*.Partner.io');
  await expect(allowlist).toHaveValue('@*.Partner.io');
  await panel.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(panel.getByText('Règles de réception par e-mail enregistrées.')).toBeVisible();
  expect(state.apps[0].inbound_sender_allowlist).toEqual(['@*.partner.io']);
});

test('« Mails reçus » lists what each inbound mail became, loaded with the Envoi tab', async ({ page }) => {
  let calls = 0;
  page.on('request', (request) => {
    if (request.url().includes('/inbound-email-logs/')) {
      calls += 1;
    }
  });
  state.inboundEmailLogs = {
    10: [
      {
        id: 3,
        processed_at: '2026-10-21T09:30:00Z',
        status: 'rejected',
        sender: 'mallory@evil.io',
        subject: 'Promo',
        error_message: 'dmarc_failed: spf=fail dkim=none',
        notification_id: null,
      },
      {
        id: 2,
        processed_at: '2026-10-21T08:00:00Z',
        status: 'created',
        sender: 'renaud@example.com',
        subject: 'Coupure réseau',
        error_message: '',
        notification_id: 77,
      },
    ],
  };

  await page.goto('/dashboard/applications/10');
  await expect(page.getByRole('tab', { name: 'Aperçu' })).toHaveAttribute('aria-selected', 'true');
  expect(calls).toBe(0);

  await page.getByRole('tab', { name: 'Envoi' }).click();
  const journal = page.getByTestId('inbound-email-log');
  await expect(journal.getByRole('heading', { name: 'Mails reçus' })).toBeVisible();

  const refused = journal.getByTestId('inbound-log-row-3');
  await expect(refused).toContainText('mallory@evil.io');
  await expect(refused).toContainText('Refusé');
  await expect(refused).toContainText('Échec du contrôle anti-usurpation (DMARC)');

  const created = journal.getByTestId('inbound-log-row-2');
  await expect(created).toContainText('Notification créée');
  await expect(created.getByRole('link')).toHaveAttribute('href', '/dashboard/notifications/77');

  // « Actualiser » reloads; an empty journal says so.
  state.inboundEmailLogs = { 10: [] };
  await journal.getByRole('button', { name: 'Actualiser' }).click();
  await expect(journal.getByTestId('inbound-log-empty')).toHaveText("Aucun mail reçu pour l'instant");
  expect(calls).toBe(2);
});
