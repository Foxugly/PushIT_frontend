/**
 * Retire des événements Sentry les jetons à usage unique portés par l'URL.
 *
 * Les routes `reset-password/:uid/:token`, `auth/confirm-email/:uid/:token` et
 * `auth/magic-link/:token` mettent le secret dans le CHEMIN ; sans filtre il
 * partirait chez Sentry dans `request.url`, le nom de transaction (pageload /
 * navigation = pathname), les spans et les breadcrumbs de navigation. On masque
 * tout ce qui suit ces préfixes, ainsi que les paramètres de requête
 * `uid` / `token` / `code` où qu'ils apparaissent.
 */
import type { Breadcrumb, Event } from '@sentry/angular';

export const FILTERED = '[Filtered]';

const SENSITIVE_PATH = /(\/(?:reset-password|confirm-email|magic-link)\/)[^?#\s"']+/gi;
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
    if (event.request.headers?.['Referer']) {
      event.request.headers['Referer'] = scrubUrl(event.request.headers['Referer']);
    }
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
