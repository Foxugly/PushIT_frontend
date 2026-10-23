import { expect, test } from '@playwright/test';

test('public pages render the shared shell and features sections', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('link', { name: /Accueil|Home/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Fonctionnalités|Functies|Features/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Foxugly' })).toBeVisible();

  await page.getByRole('link', { name: /Fonctionnalités|Functies|Features/ }).click();

  await expect(page.getByRole('heading', { name: /fonctionnalités générales|algemene functionaliteiten|general capabilities/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /fonctionnalités des applications|applicatiefunctionaliteiten|application capabilities/i })).toBeVisible();
});

test('the pricing page lists both plans and sends a visitor to registration', async ({ page }) => {
  await page.goto('/');
  await page.locator('.topbar__nav').getByRole('link', { name: /Tarifs|Prijzen|Pricing/ }).click();

  await expect(page).toHaveURL(/\/pricing$/);
  const perApp = page.locator('[data-plan="app"]');
  const unlimited = page.locator('[data-plan="unlimited"]');
  await expect(perApp).toContainText('2 €');
  await expect(unlimited).toContainText('200 €');

  await perApp.locator('a.pricing-plan__cta').click();
  await expect(page).toHaveURL(/\/register$/);
});

test.describe('pricing page on a small phone (360 px)', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('stacks the plans without horizontal scroll', async ({ page }) => {
    await page.goto('/pricing');
    const perApp = page.locator('[data-plan="app"]');
    const unlimited = page.locator('[data-plan="unlimited"]');
    await expect(unlimited).toBeVisible();

    const a = (await perApp.boundingBox())!;
    const b = (await unlimited.boundingBox())!;
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.height);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
