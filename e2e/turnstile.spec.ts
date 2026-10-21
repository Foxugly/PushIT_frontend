import { expect, Page, Request, test } from '@playwright/test';
import { mockConsoleApi, mockLogin, seedAuthenticatedSession } from './support/console-helpers';

// Cloudflare Turnstile ENABLED (a site key is injected, as nginx does from SSM)
// with the API script stubbed: the widget writes a fixed token into the hidden
// input Cloudflare uses. Checks the script is only pulled in by the forms that
// need it (register, forgot-password, magic-link request — the three endpoints
// PushIT_server gates on the captcha) and never runs inside the console.

test.use({ locale: 'fr-FR' });

const TURNSTILE_HOST = 'https://challenges.cloudflare.com';
const STUB_TOKEN = 'stub-turnstile-token';

const user = {
  id: 1,
  email: 'renaud@example.com',
  userkey: 'usr_123',
  is_active: true,
  language: 'FR' as const,
};

function consoleState() {
  return { user, apps: [], devices: [], notifications: [], futureNotifications: [] };
}

/** Site key + stubbed api.js. Returns the list of Turnstile script requests. */
async function enableTurnstile(page: Page): Promise<string[]> {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>)['__PUSHIT_TURNSTILE_SITE_KEY'] = '1x00000000000000000000AA';
  });
  const loads: string[] = [];
  await page.route(`${TURNSTILE_HOST}/**`, (route) => {
    loads.push(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        window.__turnstileResets = 0;
        window.turnstile = {
          render: function (container) {
            var input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'cf-turnstile-response';
            input.value = '${STUB_TOKEN}';
            container.appendChild(input);
            return 'widget-1';
          },
          reset: function () { window.__turnstileResets += 1; },
          remove: function () {},
        };
      `,
    });
  });
  return loads;
}

async function mockGuestApi(page: Page, registerStatus = 201): Promise<Request[]> {
  const calls: Request[] = [];
  await page.route('**/api/v1/**', (route) => {
    const request = route.request();
    calls.push(request);
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/auth/register/') && registerStatus !== 201) {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'captcha_failed', detail: 'Captcha verification failed.' }),
      });
    }
    if (path.endsWith('/auth/register/')) {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ email: 'new.user@example.com', detail: 'pending' }),
      });
    }
    if (path.endsWith('/auth/forgot-password/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
  return calls;
}

function postBody(calls: Request[], suffix: string): Record<string, unknown> | undefined {
  const call = calls.find((item) => item.method() === 'POST' && new URL(item.url()).pathname.endsWith(suffix));
  return call?.postDataJSON() as Record<string, unknown> | undefined;
}

async function fillRegister(page: Page): Promise<void> {
  const email = page.locator('#register-email');
  await email.fill('new.user@example.com');
  await expect(email).toHaveValue('new.user@example.com');
  await page.locator('#register-password').fill('s3cret-pass');
}

test('the home and login pages never load the Turnstile script', async ({ page }) => {
  const loads = await enableTurnstile(page);
  await mockGuestApi(page);

  await page.goto('/');
  await expect(page.locator('h1').first()).toBeVisible();
  await page.goto('/auth');
  await expect(page.locator('input[type="password"]')).toBeVisible();

  expect(loads).toEqual([]);
  expect(await page.evaluate(() => 'turnstile' in window)).toBe(false);
});

test('the console never loads the Turnstile script', async ({ page }) => {
  const loads = await enableTurnstile(page);
  await seedAuthenticatedSession(page, user);
  await mockConsoleApi(page, consoleState());

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/dashboard/settings');
  await expect(page).toHaveURL(/\/dashboard\/settings/);

  expect(loads).toEqual([]);
});

test('register loads Turnstile once and sends the solved token', async ({ page }) => {
  const loads = await enableTurnstile(page);
  const calls = await mockGuestApi(page);

  await page.goto('/register');
  await expect(page.locator('.register-turnstile input[name="cf-turnstile-response"]')).toHaveCount(1);
  await fillRegister(page);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();

  await expect(page).toHaveURL(/\/auth\/check-email$/);
  expect(loads).toHaveLength(1);
  expect(postBody(calls, '/auth/register/')).toMatchObject({ turnstile_token: STUB_TOKEN });
});

test('a rejected captcha re-arms the widget and says so', async ({ page }) => {
  await enableTurnstile(page);
  await mockGuestApi(page, 400);

  await page.goto('/register');
  await expect(page.locator('.register-turnstile input[name="cf-turnstile-response"]')).toHaveCount(1);
  await fillRegister(page);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();

  await expect(page.getByText('Échec de la vérification anti-robot. Réessayez.')).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
  expect(await page.evaluate(() => (window as unknown as { __turnstileResets: number }).__turnstileResets)).toBe(1);
});

test('forgot-password sends the solved token', async ({ page }) => {
  await enableTurnstile(page);
  const calls = await mockGuestApi(page);

  await page.goto('/forgot-password');
  await expect(page.locator('.forgot-turnstile input[name="cf-turnstile-response"]')).toHaveCount(1);
  const email = page.locator('#forgot-email');
  await email.fill('renaud@example.com');
  await expect(email).toHaveValue('renaud@example.com');
  await page.getByRole('button', { name: 'Envoyer le lien' }).click();

  await expect(page.getByText(/Si un compte existe avec cet email/)).toBeVisible();
  expect(postBody(calls, '/auth/forgot-password/')).toMatchObject({
    email: 'renaud@example.com',
    turnstile_token: STUB_TOKEN,
  });
});

test('signing in after a Turnstile form enters the console through a fresh document', async ({ page }) => {
  const loads = await enableTurnstile(page);
  await mockConsoleApi(page, consoleState());
  await mockLogin(page, user);

  await page.goto('/forgot-password');
  await expect(page.locator('.forgot-turnstile input[name="cf-turnstile-response"]')).toHaveCount(1);
  expect(loads).toHaveLength(1);

  // In-app hop to the login form: the Turnstile code is still in this document.
  await page.getByRole('link', { name: 'Retour à la connexion' }).click();
  await expect(page).toHaveURL(/\/auth$/);
  expect(await page.evaluate(() => 'turnstile' in window)).toBe(true);

  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill('s3cret-pass');
  const submit = page.getByRole('button', { name: /Se connecter/ });
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page).toHaveURL(/\/dashboard$/);
  // Full load: the session came back from the HttpOnly cookie, Turnstile did not.
  await expect.poll(() => page.evaluate(() => 'turnstile' in window)).toBe(false);
  await expect(page.getByRole('button', { name: user.email }).first()).toBeVisible();
  expect(loads).toHaveLength(1);
});
