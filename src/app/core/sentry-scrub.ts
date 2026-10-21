/**
 * Retire des événements Sentry les jetons à usage unique portés par l'URL.
 *
 * Les routes `reset-password/:uid/:token`, `auth/confirm-email/:uid/:token` et
 * `auth/magic-link/:token` mettent le secret dans le CHEMIN ; sans filtre il
 * partirait chez Sentry dans `request.url`, le nom de transaction (pageload /
 * navigation = pathname), les spans et les breadcrumbs de navigation. On masque
 * tout ce qui suit ces préfixes, ainsi que les paramètres de requête
 * `uid` / `token` / `code` où qu'ils apparaissent — y compris dans le texte des
 * erreurs (message du routeur « URL Segment: 'reset-password/…' », message
 * d'une HttpErrorResponse) et sans `/` initial. Les endpoints d'API
 * `magic-link/request|verify/` (jeton dans le corps, pas dans l'URL) restent
 * lisibles.
 */
import type { Breadcrumb, Event } from '@sentry/angular';

export const FILTERED = '[Filtered]';

const SENSITIVE_PATH =
  /(\b(?:reset-password|confirm-email|magic-link)\/)(?!(?:request|verify)\/(?:[?#\s"']|$))[^?#\s"']+/gi;
const SENSITIVE_QUERY = /([?&](?:uid|token|code)=)[^&#\s"']*/gi;

/** Masque les segments/paramètres sensibles d'une chaîne contenant une URL. */
export function scrubUrl(value: string): string;
export function scrubUrl(value: string | undefined): string | undefined;
export function scrubUrl(value: string | undefined): string | undefined {
  if (!value) {
    return value;
  }
  return value
    .replace(SENSITIVE_PATH, (_match, prefix: string) => `${prefix}${FILTERED}`)
    .replace(SENSITIVE_QUERY, (_match, prefix: string) => `${prefix}${FILTERED}`);
}

function scrubRecordUrls(data: Record<string, unknown> | undefined): void {
  if (!data) {
    return;
  }
  for (const key of ['url', 'from', 'to', 'http.url', 'http.query']) {
    const value = data[key];
    if (typeof value === 'string') {
      data[key] = scrubUrl(value);
    }
  }
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  scrubRecordUrls(breadcrumb.data);
  if (breadcrumb.message) {
    breadcrumb.message = scrubUrl(breadcrumb.message);
  }
  return breadcrumb;
}

/** Nettoie les champs communs aux erreurs et aux transactions. */
export function scrubEvent<T extends Event>(event: T): T {
  if (event.request) {
    event.request.url = scrubUrl(event.request.url);
    if (typeof event.request.query_string === 'string') {
      event.request.query_string = scrubUrl(`?${event.request.query_string}`).slice(1);
    }
    const headers = event.request.headers;
    for (const name of ['Referer', 'referer']) {
      if (headers?.[name]) {
        headers[name] = scrubUrl(headers[name]);
      }
    }
  }
  // Texte des erreurs : message capturé, logentry, valeur des exceptions.
  if (event.message) {
    event.message = scrubUrl(event.message);
  }
  if (event.logentry?.message) {
    event.logentry.message = scrubUrl(event.logentry.message);
  }
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) {
      exception.value = scrubUrl(exception.value);
    }
  }
  if (typeof event.tags?.['url'] === 'string') {
    event.tags['url'] = scrubUrl(event.tags['url']);
  }
  if (event.transaction) {
    event.transaction = scrubUrl(event.transaction);
  }
  event.breadcrumbs?.forEach(scrubBreadcrumb);
  for (const span of event.spans ?? []) {
    if (span.description) {
      span.description = scrubUrl(span.description);
    }
    scrubRecordUrls(span.data as Record<string, unknown> | undefined);
  }
  const traceData = event.contexts?.trace?.data as Record<string, unknown> | undefined;
  scrubRecordUrls(traceData);
  return event;
}
