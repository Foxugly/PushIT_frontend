/**
 * Origines vers lesquelles la page de facturation accepte de quitter l'app.
 *
 * Le backend relaie l'URL renvoyée par le service de facturation central
 * (Stripe Checkout / Customer Portal). Il est de confiance, mais une URL
 * détournée ferait sortir l'utilisateur vers n'importe quel site au moment
 * précis où il s'apprête à payer : défense en profondeur, on n'assigne
 * `window.location` qu'à une origine attendue, en HTTPS.
 */
export const BILLING_REDIRECT_ORIGINS: readonly string[] = [
  'https://checkout.stripe.com',
  'https://billing.stripe.com',
  // Service de facturation central (frontend + API) — cf. PushIT_server billing/.
  'https://billing.foxugly.com',
  'https://billing-api.foxugly.com',
];

/** L'URL absolue si son origine est autorisée, sinon `null`. */
export function allowedBillingRedirect(url: unknown): string | null {
  if (typeof url !== 'string' || !url) {
    return null;
  }
  let parsed: URL;
  try {
    // Pas de base : une URL relative ou « //host » est refusée.
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.username || parsed.password) {
    return null;
  }
  return BILLING_REDIRECT_ORIGINS.includes(parsed.origin) ? parsed.href : null;
}
