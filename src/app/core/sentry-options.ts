/**
 * Options passées à `Sentry.init` (sentry-init.ts). Isolées ici pour que
 * sentry-options.spec.ts les fasse tourner dans un vrai client Sentry et
 * vérifie que le nettoyage des jetons s'applique bien aux transactions.
 */
import * as Sentry from '@sentry/angular';
import type { BrowserOptions } from '@sentry/angular';

import type { RuntimeSentryConfig } from './runtime-config';
import { scrubBreadcrumb, scrubEvent, scrubSpan } from './sentry-scrub';

export function buildSentryOptions(sentry: RuntimeSentryConfig): BrowserOptions {
  return {
    dsn: sentry.dsn,
    environment: sentry.environment,
    release: sentry.release || undefined,
    integrations: [Sentry.browserTracingIntegration()],
    // 10 % des transactions tracées en prod : compromis volume/coût.
    tracesSampleRate: 0.1,
    // Propager les en-têtes de trace uniquement vers notre backend.
    tracePropagationTargets: [/^https:\/\/pushit-api\.foxugly\.com\/api/],
    // Sentry 11 a remplacé `sendDefaultPii` par `dataCollection`, plus permissif
    // par défaut : on fixe explicitement la base restrictive de la v10.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: {
        request: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
        response: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
      },
      httpBodies: [],
      urlQueryParams: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      graphQL: { document: false, variables: false },
    },
    // Sentry 11 diffuse les spans en flux par défaut et ignore alors
    // `beforeSendTransaction` : le jeton du chemin partirait dans le nom de la
    // transaction pageload/navigation. On garde le cycle « static » de la v10
    // pour que le nettoyage ci-dessous s'applique (sentry-options.spec.ts).
    traceLifecycle: 'static',
    // Jetons à usage unique (reset / confirm-email / magic-link) masqués dans
    // les URLs, noms de transaction, spans et breadcrumbs (sentry-scrub.ts).
    beforeSend: (event) => scrubEvent(event),
    beforeSendTransaction: (event) => scrubEvent(event),
    // Spans envoyés seuls (INP) : ils ne passent pas par beforeSendTransaction.
    beforeSendSpan: Sentry.withStaticSpan((span) => scrubSpan(span)),
    beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
  };
}
