import { expect, test } from '@playwright/test';

test('public pages render the shared shell and features sections', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('link', { name: /Accueil|Home/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Fonctionnalités|Functies|Features/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Foxugly' })).toBeVisible();

  await page.getByRole('link', { name: /Fonctionnalités|Functies|Features/ }).click();

  await expect(page.getByRole('heading', { name: /fonctionnalités générales|algemene functionaliteiten|general capabilities/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /fonctionnalités des applications|applicatiefunctionaliteiten|application capabilities/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /configuration backend|backendconfiguratie|backend configuration/i })).toBeVisible();
});
