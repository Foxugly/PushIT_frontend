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
    devices: [],
    notifications: [],
    futureNotifications: [],
    stats: [],
    appQuietPeriods: { 10: [], 11: [] },
    deviceQuietPeriods: {},
  });
});

test('creating an application lands on its Envoi tab and reveals the one-time token', async ({
  page,
}) => {
  // Reach the create page via the list's "Ajouter" action (role/test-id, not copy
  // coupling: the button is the only icon-prefixed add control on the toolbar).
  await page.goto('/dashboard/applications');
  await page.getByRole('button', { name: /ajouter/i }).click();
  await expect(page).toHaveURL(/\/dashboard\/applications\/new$/);

  // Fill the name (first textbox in the form) and submit.
  await page.getByRole('textbox').first().fill('Nouvelle App E2E');
  await page.getByRole('button', { name: /créer/i }).click();

  // Navigates to the freshly-created app's detail page (id 11 from the mock),
  // on the Envoi tab where the one-time reveal lives...
  await expect(page).toHaveURL(/\/dashboard\/applications\/11\?tab=sending$/);
  await expect(page.getByRole('heading', { name: 'Nouvelle App E2E' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Envoi' })).toHaveAttribute('aria-selected', 'true');

  // ...and the one-time token-reveal surface shows the raw send token, with no
  // QR: the only scannable QR is the enrolment code (apk_), never apt_.
  const reveal = page.getByTestId('app-token-reveal');
  await expect(reveal).toBeVisible();
  await expect(reveal.locator('code')).toContainText('apt_');
  await expect(reveal.locator('img')).toHaveCount(0);
});

test('the old edit URL opens the Paramètres tab, which saves inline', async ({ page }) => {
  await page.goto('/dashboard/applications/10/edit');

  // Redirected to the detail page's settings tab.
  await expect(page).toHaveURL(/\/dashboard\/applications\/10\?tab=settings$/);
  await expect(page.getByRole('tab', { name: 'Paramètres' })).toHaveAttribute('aria-selected', 'true');

  const form = page.getByTestId('app-settings-form');
  const nameInput = form.getByRole('textbox').first();
  await expect(nameInput).toHaveValue('PushIT Mobile');
  await nameInput.fill('PushIT Mobile V2');
  await form.getByRole('button', { name: /enregistrer/i }).click();

  // Still on the settings tab, with the updated name reflected in the header.
  await expect(page.getByText('Application mise à jour.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'PushIT Mobile V2' })).toBeVisible();
  await expect(page).toHaveURL(/\?tab=settings$/);
});

test('switching tabs mirrors the tab in the URL', async ({ page }) => {
  await page.goto('/dashboard/applications/10');
  await expect(page.getByRole('tab', { name: 'Aperçu' })).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('tab', { name: 'Périodes blanches' }).click();
  await expect(page).toHaveURL(/\/dashboard\/applications\/10\?tab=quiet-periods$/);

  await page.getByRole('tab', { name: 'Aperçu' }).click();
  await expect(page).toHaveURL(/\/dashboard\/applications\/10$/);
});

// Regression guard for the logo cropper: after picking an image AND zooming,
// "Apply" must stay enabled and actually upload. The previous implementation
// disabled Apply on every zoom and waited for an imageCropped re-emit that
// ngx-image-cropper never sends on a transform change — so Apply was dead after
// any zoom. Icon-scoped locators keep this independent of the FR button copy.
test('the logo cropper uploads after the image is zoomed', async ({ page }) => {
  await page.goto('/dashboard/applications/10/edit');

  // The logo field of an existing app lives in the Paramètres tab (the edit URL
  // redirects there); pick the fixture image (PrimeNG's advanced fileupload
  // renders two file inputs — the first is the real one).
  await expect(page).toHaveURL(/\?tab=settings$/);
  await page.locator('input[type="file"]').first().setInputFiles('e2e/fixtures/logo.png');

  // The cropper appears and signals readiness by enabling Apply.
  const cropper = page.locator('.avatar-cropper');
  await expect(cropper).toBeVisible();
  const applyButton = cropper.locator('.avatar-cropper__actions button:has(.pi-check)');
  await expect(applyButton).toBeEnabled();

  // Zoom in twice — the core of the bug: Apply must NOT get stuck disabled.
  const zoomIn = cropper.locator('button:has(.pi-search-plus)');
  await zoomIn.click();
  await zoomIn.click();
  await expect(applyButton).toBeEnabled();

  // Applying uploads the cropped PNG (multipart POST to the logo endpoint).
  const uploadPromise = page.waitForRequest(
    (req) => /\/api\/v1\/apps\/10\/logo\/$/.test(req.url()) && req.method() === 'POST',
  );
  await applyButton.click();
  const uploadRequest = await uploadPromise;
  expect(uploadRequest.method()).toBe('POST');

  // After a successful apply the editor tears down the cropper and returns to
  // the file picker (sourceFile cleared).
  await expect(cropper).toBeHidden();
});

// Regression guard: a file the browser can't decode (unsupported format such as
// HEIC, a CMYK/progressive JPEG, or a corrupt file) used to leave a silent blank
// cropper — the user "saw no image" with no explanation. The cropper must now
// surface an error and drop back to the picker instead of hanging blank.
test('an undecodable image shows an error instead of a blank cropper', async ({ page }) => {
  await page.goto('/dashboard/applications/10/edit');

  await page.locator('input[type="file"]').first().setInputFiles('e2e/fixtures/corrupt.png');

  // No usable cropper; an explanatory error is shown in its place.
  const error = page.locator('.avatar-cropper__error');
  await expect(error).toBeVisible();
  await expect(page.locator('.avatar-cropper')).toBeHidden();
  // The file picker is still available so the user can try another file.
  await expect(page.locator('input[type="file"]').first()).toBeAttached();
});
