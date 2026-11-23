/**
 * Initialisation de Sentry AVANT le bootstrap Angular (importé en tête de
 * main.ts) afin de capter les erreurs survenant pendant l'init de l'app.
 *
 * Les valeurs viennent de la config runtime (globals injectés par nginx). Si le
 * DSN est vide (cas dev, ou bootstrap serveur sans SSM seedé), `Sentry.init`
 * n'est pas appelé : le SDK reste inerte, aucun appel réseau. Les options
 * (dont le nettoyage des jetons) sont dans app/core/sentry-options.ts.
 */
import * as Sentry from '@sentry/angular';

import { getRuntimeConfig } from './app/core/runtime-config';
import { buildSentryOptions } from './app/core/sentry-options';

const { sentry } = getRuntimeConfig();

if (sentry.dsn) {
  Sentry.init(buildSentryOptions(sentry));
}
