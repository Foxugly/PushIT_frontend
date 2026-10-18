/**
 * Identité du build, figée à la compilation.
 *
 * `PUSHIT_BUILD_SHA` est remplacé par esbuild quand la CI passe
 * `ng build --define PUSHIT_BUILD_SHA="'<sha>'"` (cf. deploy.yml). Hors CI (dev,
 * tests unitaires, e2e), le symbole n'est pas défini : le `typeof` évite la
 * ReferenceError et on retombe sur une chaîne vide.
 */
declare const PUSHIT_BUILD_SHA: string | undefined;

export const BUILD_SHA: string =
  typeof PUSHIT_BUILD_SHA === 'string' ? PUSHIT_BUILD_SHA.trim() : '';

/** Nom de release Sentry ; doit rester identique à celui de l'upload des source maps (deploy.yml). */
export function sentryReleaseFor(sha: string): string {
  return `pushit-frontend@${sha}`;
}
