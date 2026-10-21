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
