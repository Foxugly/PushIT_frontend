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
}

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

  // Backend-specific code (e.g. notification_not_found): the server detail is
  // meaningful; fall back to a localized generic message if it's missing.
  return error.detail || messages.generic;
}
