import { expect, test } from '@playwright/test';

test('public pages render the shared shell and features sections', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Fonctionnalites|Functies|Features/ })).toBeVisible();
  await expect(page.getByText('Copyright Foxugly 2026')).toBeVisible();

  await page.getByRole('link', { name: /Fonctionnalites|Functies|Features/ }).click();

  await expect(page.getByRole('heading', { name: /fonctionnalites generales|algemene functionaliteiten|general capabilities/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /fonctionnalites des applications|applicatiefunctionaliteiten|application capabilities/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /configuration backend|backendconfiguratie|backend configuration/i })).toBeVisible();
});
