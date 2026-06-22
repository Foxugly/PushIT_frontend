import { expect, test } from '@playwright/test';

// The /privacy page is public (no auth) — it's the privacy-policy URL for the
// Play Store listing. We assert the heading renders and that the public footer
// links to it. Selectors are locale-tolerant (FR default + NL/EN).
test.describe('Public privacy policy page', () => {
  test('renders the policy heading when navigated directly (unauthenticated)', async ({ page }) => {
    await page.goto('/privacy');

    await expect(
      page.getByRole('heading', { name: /Politique de confidentialité|Privacybeleid|Privacy policy/i }),
    ).toBeVisible();

    // The contact email is exposed as a mailto: link.
    await expect(page.getByRole('link', { name: 'rvilain@foxugly.com' })).toHaveAttribute(
      'href',
      'mailto:rvilain@foxugly.com',
    );
  });

  test('is reachable from the public footer link', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('footer.site-footer').first();
    const privacyLink = footer.getByRole('link', {
      name: /Politique de confidentialité|Privacybeleid|Privacy policy/i,
    });
    await expect(privacyLink).toBeVisible();

    await privacyLink.click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(
      page.getByRole('heading', { name: /Politique de confidentialité|Privacybeleid|Privacy policy/i }),
    ).toBeVisible();
  });
});
