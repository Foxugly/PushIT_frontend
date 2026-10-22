import { expect, Page, Request, test } from '@playwright/test';

// Guest flows: register (Turnstile off — no site key is injected in e2e),
// forgot-password request and the reset-password confirm page. The API is
// mocked per endpoint; anything unexpected under /api/v1 answers 404 so a stray
// call fails loudly instead of hitting a real backend.

test.use({ locale: 'fr-FR' });

async function mockGuestApi(page: Page): Promise<Request[]> {
  const calls: Request[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    calls.push(request);
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (path.endsWith('/auth/register/') && method === 'POST') {
      const body = request.postDataJSON() as { email: string; password: string };
      if (body.password === 'password123') {
        // Shape of the backend's validation_error (Django password validators).
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'validation_error',
            detail: 'Invalid input.',
            errors: { password: ['Ce mot de passe est trop courant.'] },
          }),
        });
      }
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ email: body.email, detail: 'pending' }),
      });
    }
    if (path.endsWith('/auth/forgot-password/') && method === 'POST') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    if (path.endsWith('/auth/reset-password/') && method === 'POST') {
      const body = request.postDataJSON() as { token: string; password: string };
      if (body.token === 'expired-token') {
        // Same code as PushIT_server's ResetPasswordConfirmApiView.
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'reset_link_invalid', detail: 'Lien invalide ou expiré.' }),
        });
      }
      if (body.password === 'password123') {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'password_invalid', detail: 'Ce mot de passe est trop courant.' }),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ detail: `Unhandled route: ${method} ${path}` }),
    });
  });
  return calls;
}

function postTo(calls: Request[], suffix: string): Request | undefined {
  return calls.find((call) => call.method() === 'POST' && new URL(call.url()).pathname.endsWith(suffix));
}

test('a visitor can register and lands on the check-email page', async ({ page }) => {
  const calls = await mockGuestApi(page);
  await page.goto('/register');

  // Turnstile is off: no widget container, no token in the payload.
  await expect(page.locator('.register-turnstile')).toHaveCount(0);

  const email = page.locator('#register-email');
  await email.fill('new.user@example.com');
  await expect(email).toHaveValue('new.user@example.com');
  const password = page.locator('#register-password');
  await password.fill('s3cret-pass');
  await expect(password).toHaveValue('s3cret-pass');

  await page.getByRole('button', { name: 'Créer mon compte' }).click();

  await expect(page).toHaveURL(/\/auth\/check-email$/);
  await expect(page.getByRole('heading', { name: 'Vérifiez votre boîte de réception' })).toBeVisible();
  await expect(page.getByText('new.user@example.com')).toBeVisible();

  const payload = postTo(calls, '/auth/register/')?.postDataJSON() as Record<string, unknown>;
  expect(payload).toMatchObject({ email: 'new.user@example.com', password: 's3cret-pass', language: 'FR' });
  expect(payload).not.toHaveProperty('turnstile_token');
});

test('register refuses a short password without calling the API', async ({ page }) => {
  const calls = await mockGuestApi(page);
  await page.goto('/register');

  const email = page.locator('#register-email');
  await email.fill('new.user@example.com');
  await expect(email).toHaveValue('new.user@example.com');
  await page.locator('#register-password').fill('short');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();

  await expect(page.getByText('Le mot de passe doit faire au moins 8 caractères.')).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
  expect(postTo(calls, '/auth/register/')).toBeUndefined();
});

test('register shows required / format errors without calling the API', async ({ page }) => {
  const calls = await mockGuestApi(page);
  await page.goto('/register');

  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByText("L'adresse e-mail est requise.")).toBeVisible();
  await expect(page.getByText('Le mot de passe est requis.')).toBeVisible();

  const email = page.locator('#register-email');
  await email.fill('not-an-email');
  await expect(email).toHaveValue('not-an-email');
  await page.locator('#register-password').fill('s3cret-pass');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();

  await expect(page.getByText('Saisissez une adresse e-mail valide.')).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
  expect(postTo(calls, '/auth/register/')).toBeUndefined();
});

test('register lists the backend password validator messages and stays on the form', async ({ page }) => {
  const calls = await mockGuestApi(page);
  await page.goto('/register');

  const email = page.locator('#register-email');
  await email.fill('new.user@example.com');
  await expect(email).toHaveValue('new.user@example.com');
  await page.locator('#register-password').fill('password123');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();

  await expect(page.getByText('Ce mot de passe est trop courant.')).toBeVisible();
  await expect(page.getByText('Veuillez corriger les champs en erreur.')).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
  expect(postTo(calls, '/auth/register/')).toBeDefined();
});

test('a visitor can request a password reset link', async ({ page }) => {
  const calls = await mockGuestApi(page);
  await page.goto('/forgot-password');

  const email = page.locator('#forgot-email');
  await email.fill('renaud@example.com');
  await expect(email).toHaveValue('renaud@example.com');
  await page.getByRole('button', { name: 'Envoyer le lien' }).click();

  // Anti-enumeration wording: the same message whether or not the account exists.
  await expect(page.getByText(/Si un compte existe avec cette adresse e-mail/)).toBeVisible();
  expect(postTo(calls, '/auth/forgot-password/')?.postDataJSON()).toMatchObject({
    email: 'renaud@example.com',
  });
});

test('the reset-password confirm page posts uid + token and offers to log in', async ({ page }) => {
  const calls = await mockGuestApi(page);
  await page.goto('/reset-password/MQ/abc-123');

  await expect(page.getByRole('heading', { name: 'Choisir un nouveau mot de passe' })).toBeVisible();
  await page.locator('#reset-password').fill('n3w-password');
  await page.locator('#reset-confirm-password').fill('n3w-password');
  await page.getByRole('button', { name: 'Réinitialiser le mot de passe' }).click();

  await expect(page.getByText('Votre mot de passe a été réinitialisé.', { exact: false })).toBeVisible();
  expect(postTo(calls, '/auth/reset-password/')?.postDataJSON()).toEqual({
    uid: 'MQ',
    token: 'abc-123',
    password: 'n3w-password',
  });

  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/auth$/);
});

test('the reset-password page blocks mismatched passwords', async ({ page }) => {
  const calls = await mockGuestApi(page);
  await page.goto('/reset-password/MQ/abc-123');

  await page.locator('#reset-password').fill('n3w-password');
  await page.locator('#reset-confirm-password').fill('other-password');
  await page.getByRole('button', { name: 'Réinitialiser le mot de passe' }).click();

  await expect(page.getByText('Les mots de passe ne correspondent pas.')).toBeVisible();
  expect(postTo(calls, '/auth/reset-password/')).toBeUndefined();
});

test('forgot-password refuses a malformed address without calling the API', async ({ page }) => {
  const calls = await mockGuestApi(page);
  await page.goto('/forgot-password');

  const email = page.locator('#forgot-email');
  await email.fill('not-an-email');
  await expect(email).toHaveValue('not-an-email');
  await page.getByRole('button', { name: 'Envoyer le lien' }).click();

  await expect(page.getByText(/Si un compte existe avec cette adresse e-mail/)).toHaveCount(0);
  expect(postTo(calls, '/auth/forgot-password/')).toBeUndefined();
});

test('the reset-password page shows the backend password validator message', async ({ page }) => {
  await mockGuestApi(page);
  await page.goto('/reset-password/MQ/abc-123');

  await page.locator('#reset-password').fill('password123');
  await page.locator('#reset-confirm-password').fill('password123');
  await page.getByRole('button', { name: 'Réinitialiser le mot de passe' }).click();

  await expect(page.getByText('Ce mot de passe est trop courant.')).toBeVisible();
  await expect(page.getByText('Votre mot de passe a été réinitialisé.', { exact: false })).toHaveCount(0);
});

test('the reset-password page surfaces an expired link', async ({ page }) => {
  await mockGuestApi(page);
  await page.goto('/reset-password/MQ/expired-token');

  await page.locator('#reset-password').fill('n3w-password');
  await page.locator('#reset-confirm-password').fill('n3w-password');
  await page.getByRole('button', { name: 'Réinitialiser le mot de passe' }).click();

  await expect(page.getByText('Lien invalide ou expiré.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Réinitialiser le mot de passe' })).toBeVisible();
});
