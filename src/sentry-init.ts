/**
 * Initialisation de Sentry AVANT le bootstrap Angular (importé en tête de
 * main.ts) afin de capter les erreurs survenant pendant l'init de l'app.
 *
 * Les valeurs viennent de la config runtime (globals injectés par nginx). Si le
 * DSN est vide (cas dev, ou bootstrap serveur sans SSM seedé), `Sentry.init`
 * n'est pas appelé : le SDK reste inerte, aucun appel réseau.
 */
import * as Sentry from '@sentry/angular';

import { getRuntimeConfig } from './app/core/runtime-config';

const { sentry } = getRuntimeConfig();

if (sentry.dsn) {
  Sentry.init({
    dsn: sentry.dsn,
    environment: sentry.environment,
    release: sentry.release || undefined,
    integrations: [Sentry.browserTracingIntegration()],
    // 10 % des transactions tracées en prod : compromis volume/coût.
    tracesSampleRate: 0.1,
    // Propager les en-têtes de trace uniquement vers notre backend.
    tracePropagationTargets: [/^https:\/\/pushit-api\.foxugly\.com\/api/],
  });
}
