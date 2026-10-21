import { expect, test } from '@playwright/test';

test.use({ locale: 'fr-FR' });

// Home hero: exactly three actions for a visitor (login, register, contact),
// no embedded register form, and the register CTA reaches the register page.
test('the home hero offers login, register and contact', async ({ page }) => {
  await page.goto('/');

  const actions = page.locator('.hero__actions');
  await expect(actions.getByRole('button')).toHaveCount(3);
  await expect(actions.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  await expect(actions.getByRole('button', { name: 'Me contacter' })).toBeVisible();
  await expect(page.locator('app-register-panel')).toHaveCount(0);

  await actions.getByRole('button', { name: 'Créer un compte' }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.locator('#register-email')).toBeVisible();
});
