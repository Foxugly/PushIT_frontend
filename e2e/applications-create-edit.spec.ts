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

test('creating an application navigates to its detail page and reveals the one-time token', async ({
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

  // Navigates to the freshly-created app's detail page (id 11 from the mock)...
  await expect(page).toHaveURL(/\/dashboard\/applications\/11$/);
  await expect(page.getByRole('heading', { name: 'Nouvelle App E2E' })).toBeVisible();

  // ...and the one-time token-reveal surface is shown (QR rendered for the token).
  const reveal = page.getByTestId('app-token-reveal');
  await expect(reveal).toBeVisible();
  await expect(reveal.locator('img')).toBeVisible();
});

test('editing an application saves and returns to its detail page', async ({ page }) => {
  await page.goto('/dashboard/applications/10/edit');

  const nameInput = page.getByRole('textbox').first();
  await expect(nameInput).toHaveValue('PushIT Mobile');
  await nameInput.fill('PushIT Mobile V2');
  await page.getByRole('button', { name: /enregistrer/i }).click();

  // Back on the detail page, with the updated name reflected.
  await expect(page).toHaveURL(/\/dashboard\/applications\/10$/);
  await expect(page.getByRole('heading', { name: 'PushIT Mobile V2' })).toBeVisible();
});

// Regression guard for the logo cropper: after picking an image AND zooming,
// "Apply" must stay enabled and actually upload. The previous implementation
// disabled Apply on every zoom and waited for an imageCropped re-emit that
// ngx-image-cropper never sends on a transform change — so Apply was dead after
// any zoom. Icon-scoped locators keep this independent of the FR button copy.
test('the logo cropper uploads after the image is zoomed', async ({ page }) => {
  await page.goto('/dashboard/applications/10/edit');

  // The logo field only renders in edit mode; pick the fixture image (PrimeNG's
  // advanced fileupload renders two file inputs — the first is the real one).
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
