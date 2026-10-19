import { CatalogStore } from '../i18n/catalog-store';
import { ApiErrorResponse } from '../models/api.models';
import { LanguageCode } from '../services/public-i18n.service';

export interface ApiErrorMessages {
  generic: string;
  offline: string;
  validation: string;
  /** Keyed by HTTP status (0 = network/offline). */
  http: Record<number, string>;
  shellLoadFailed: string;
  shellRefreshFailed: string;
  /**
   * Localized messages for backend codes whose server `detail` is not good
   * enough to show as-is (billing 402s, inactive application). Optional so a
   * catalog without it keeps the server-detail fallback.
   */
  codes?: Record<string, string>;
}

/** The two billing 402s, both of which send the user to the billing page. */
export const BILLING_REFUSAL_CODES: readonly string[] = ['subscription_required', 'quota_exceeded'];

export function isBillingRefusal(error: { code?: string } | null | undefined): boolean {
  return BILLING_REFUSAL_CODES.includes(error?.code ?? '');
}

/**
 * Inactive application refusal. The server may answer with a dedicated code or
 * with a validation error on `application_id`; the app-token flavour
 * (`app_token_inactive`) means the same thing to the user.
 */
export const APPLICATION_INACTIVE_CODES: readonly string[] = ['application_inactive', 'app_inactive', 'app_token_inactive'];

/**
 * Messages d'erreur API pour une langue, extraits du namespace `errors` du
 * catalogue.
 *
 * C'etait une constante de module bâtie a l'import depuis les catalogues
 * embarques. Ces catalogues vivent desormais dans `public/i18n/` et sont
 * charges au bootstrap (STANDARD-frontend-layout.md §5bis) : une constante
 * evaluee a l'import lirait donc un store encore vide. D'ou la fonction, qui
 * lit au moment de l'appel — les appelants sont deja dans un contexte
 * d'injection.
 *
 * Cast : les cles JSON sont des chaines, donc `http` revient avec des cles
 * string — sans consequence, la recherche coerce le statut numerique.
 */
export function apiErrorCopy(catalogs: CatalogStore, lang: LanguageCode): ApiErrorMessages {
  return catalogs.get(lang).errors as unknown as ApiErrorMessages;
}

/**
 * Localized, user-facing message for a coerced API error. Avoids leaking raw
 * technical strings (`error.message`, generic `http_<status>` codes): those map
 * to a localized message. Backend-specific codes keep their server `detail`
 * (specific, and the backend can localize it later), with a localized fallback.
 */
export function localizeApiError(error: ApiErrorResponse, messages: ApiErrorMessages): string {
  const code = error.code ?? '';

  if (code === 'validation_error') {
    return messages.validation;
  }

  if (code.startsWith('http_')) {
    const status = Number(code.slice('http_'.length));
    if (messages.http[status]) {
      return messages.http[status];
    }
    if (status >= 500) {
      return messages.http[500];
    }
    return messages.generic;
  }

  if (code === 'unexpected_error' || !code) {
    return messages.generic;
  }

  const known = messages.codes?.[code]
    ?? (APPLICATION_INACTIVE_CODES.includes(code) ? messages.codes?.['application_inactive'] : undefined);
  if (known) {
    return known;
  }

  // Backend-specific code (e.g. notification_not_found): the server detail is
  // meaningful; fall back to a localized generic message if it's missing.
  return error.detail || messages.generic;
}
