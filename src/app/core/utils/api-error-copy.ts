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

export const API_ERROR_COPY: Record<LanguageCode, ApiErrorMessages> = {
  fr: {
    generic: "Une erreur est survenue. Réessayez.",
    offline: 'Impossible de joindre le serveur. Vérifiez votre connexion.',
    validation: 'Veuillez corriger les champs en erreur.',
    http: {
      0: 'Impossible de joindre le serveur. Vérifiez votre connexion.',
      400: 'Requête invalide.',
      401: 'Session expirée, reconnectez-vous.',
      403: "Vous n'avez pas accès à cette ressource.",
      404: 'Ressource introuvable.',
      409: 'Conflit : cette action entre en conflit avec l’état actuel.',
      413: 'Fichier trop volumineux.',
      429: 'Trop de requêtes, réessayez dans un instant.',
      500: 'Erreur serveur, réessayez plus tard.',
      502: 'Erreur serveur, réessayez plus tard.',
      503: 'Service indisponible, réessayez plus tard.',
      504: 'Le serveur a mis trop de temps à répondre.',
    },
    shellLoadFailed: "Impossible de charger l'espace console.",
    shellRefreshFailed: 'Impossible de rafraîchir les compteurs de navigation.',
  },
  nl: {
    generic: 'Er is een fout opgetreden. Probeer opnieuw.',
    offline: 'Kan de server niet bereiken. Controleer je verbinding.',
    validation: 'Corrigeer de gemarkeerde velden.',
    http: {
      0: 'Kan de server niet bereiken. Controleer je verbinding.',
      400: 'Ongeldige aanvraag.',
      401: 'Sessie verlopen, log opnieuw in.',
      403: 'Je hebt geen toegang tot deze bron.',
      404: 'Bron niet gevonden.',
      409: 'Conflict met de huidige status.',
      413: 'Bestand te groot.',
      429: 'Te veel aanvragen, probeer zo opnieuw.',
      500: 'Serverfout, probeer het later opnieuw.',
      502: 'Serverfout, probeer het later opnieuw.',
      503: 'Service niet beschikbaar, probeer het later opnieuw.',
      504: 'De server reageerde te traag.',
    },
    shellLoadFailed: 'Kan de console niet laden.',
    shellRefreshFailed: 'Kan de navigatietellers niet vernieuwen.',
  },
  en: {
    generic: 'Something went wrong. Please try again.',
    offline: 'Could not reach the server. Check your connection.',
    validation: 'Please fix the highlighted fields.',
    http: {
      0: 'Could not reach the server. Check your connection.',
      400: 'Invalid request.',
      401: 'Session expired, please sign in again.',
      403: "You don't have access to this resource.",
      404: 'Resource not found.',
      409: 'Conflict with the current state.',
      413: 'File too large.',
      429: 'Too many requests, try again shortly.',
      500: 'Server error, please try again later.',
      502: 'Server error, please try again later.',
      503: 'Service unavailable, please try again later.',
      504: 'The server took too long to respond.',
    },
    shellLoadFailed: 'Could not load the console.',
    shellRefreshFailed: 'Could not refresh the navigation counts.',
  },
};

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
