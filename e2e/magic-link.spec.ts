import { expect, test } from '@playwright/test';
import { mockConsoleApi } from './support/console-helpers';

const user = {
  id: 1,
  email: 'renaud@example.com',
  userkey: 'usr_123',
  is_active: true,
  language: 'FR' as const,
};

const json = (status: number, body: unknown) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

test.beforeEach(async ({ page }) => {
  // The magic-link verify page is a pre-auth visitor screen, so the mocked
  // user's FR language isn't applied there — pin the UI language explicitly so
  // the French copy assertions below match what renders.
  await page.addInitScript(() => localStorage.setItem('pushit.language', 'fr'));
  await mockConsoleApi(page, {
    user,
    apps: [],
    devices: [],
    notifications: [],
    futureNotifications: [],
  });
});

test('a visitor can switch to magic-link mode and request a sign-in link', async ({ page }) => {
  // Registered AFTER the console catch-all so this specific route wins.
  await page.route('**/api/v1/auth/magic-link/', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill(json(200, { code: 'ok', detail: 'sent' }));
  });

  await page.goto('/auth');

  // Switch into inline magic mode via the "ou" divider button (language-tolerant,
  // like login.spec — the e2e browser locale isn't pinned to FR).
  await page.getByRole('button', { name: /Recevoir un lien de connexion|Get a sign-in link/ }).click();

  // Attendre que le formulaire magic ait REMPLACE celui de login avant de saisir.
  // auth-page.html rend `@if (!magicMode())` / `@else`, et les deux blocs
  // contiennent un input[type="email"]. Sans cette attente, `fill()` resout
  // parfois l'input du formulaire de login, encore dans le DOM juste apres le
  // clic : la saisie part dans un champ qui disparait, le formulaire magic
  // reste vide, et comme le bouton d'envoi est `[disabled]="magicPending()"`
  // (et non gate sur la validite), le clic appelle submitMagic() qui sort
  // immediatement sur `magicForm.invalid`. Aucun POST, aucun message, timeout.
  // Le bouton d'envoi n'existe que dans le bloc magic : sa visibilite prouve
  // que le swap est fait.
  const send = page.getByRole('button', { name: /Envoyer le lien|Send the link/ });
  await expect(send).toBeVisible();

  const email = page.locator('input[type="email"]');
  await email.fill(user.email);
  // Verrouille la saisie : si une course subsiste, l'echec tombe ICI, sur la
  // vraie cause, au lieu de se manifester 5 s plus tard en « message absent ».
  await expect(email).toHaveValue(user.email);

  await expect(send).toBeEnabled();
  await send.click();

  // Anti-leak success confirmation.
  await expect(
    page.getByText(/lien de connexion vient d’être envoyé|sign-in link has just been sent/),
  ).toBeVisible();
});

test('opening the emailed magic link signs the visitor in and lands on the dashboard', async ({
  page,
}) => {
  await page.route('**/api/v1/auth/magic-link/verify/', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill(json(200, { access: 'access-token', refresh: 'refresh-token', user }));
  });

  await page.goto('/auth/magic-link/a-valid-token');

  await expect(page).toHaveURL(/\/dashboard$/);
});

test('an invalid or expired magic link shows the failed state', async ({ page }) => {
  await page.route('**/api/v1/auth/magic-link/verify/', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill(
      json(400, { code: 'magic_link_invalid', detail: 'invalid' }),
    );
  });

  await page.goto('/auth/magic-link/bad-token');

  await expect(
    page.getByText(/Ce lien de connexion est invalide, expiré ou déjà utilisé\./),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Retour à la connexion/ })).toBeVisible();
});
