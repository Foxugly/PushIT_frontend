import { expect, test } from '@playwright/test';

// Le footer Foxugly est monté une seule fois par le layout public (et console) —
// on le valide sur la home. Couvre : crédit visible, lien correct (cible/rel),
// logo décoratif (accessibilité), et année dynamique.
test.describe('Foxugly footer credit', () => {
  test('renders the credit with a correct, accessible Foxugly link', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('footer.site-footer').first();
    await expect(footer).toBeVisible();

    // Le lien est nommé par le mot « Foxugly » (le logo est décoratif, donc
    // n'ajoute rien au nom accessible).
    const link = footer.getByRole('link', { name: 'Foxugly' });
    await expect(link).toBeVisible();

    // Cible + sécurité de l'onglet externe.
    await expect(link).toHaveAttribute('href', 'https://www.foxugly.com');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('logo is decorative (alt="" + aria-hidden) and inside the link', async ({ page }) => {
    await page.goto('/');

    const link = page.locator('footer.site-footer').first().getByRole('link', { name: 'Foxugly' });
    const logo = link.locator('img.site-footer__author-logo');

    await expect(logo).toHaveCount(1); // bien à l'intérieur du lien
    await expect(logo).toHaveAttribute('alt', '');
    await expect(logo).toHaveAttribute('aria-hidden', 'true');

    // Le logo décoratif ne doit PAS exposer de rôle image dans l'arbre d'accessibilité.
    await expect(link.getByRole('img')).toHaveCount(0);
  });

  test('shows the current year dynamically and a localized rights notice', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('footer.site-footer').first();
    const year = new Date().getFullYear();

    await expect(footer).toContainText(`© ${year}`);
    await expect(footer).toContainText(/Tous droits réservés\.|Alle rechten voorbehouden\.|All rights reserved\./);
  });
});
