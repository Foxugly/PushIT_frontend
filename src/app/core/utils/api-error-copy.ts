import { CATALOGS } from '../i18n/catalogs';
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

// Sourced from the Transloco catalogs (namespace `errors`). Cast because JSON
// object keys are strings, so `http` comes back with string keys — harmless, the
// lookup coerces the numeric status to a string key at runtime.
export const API_ERROR_COPY = {
  fr: CATALOGS.fr.errors,
  nl: CATALOGS.nl.errors,
  en: CATALOGS.en.errors,
} as unknown as Record<LanguageCode, ApiErrorMessages>;

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
