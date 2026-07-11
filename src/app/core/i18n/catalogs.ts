import type { LanguageCode } from '../services/public-i18n.service';

import en from './catalogs/en.json';
import es from './catalogs/es.json';
import fr from './catalogs/fr.json';
import it from './catalogs/it.json';
import nl from './catalogs/nl.json';

/**
 * Bundled i18n catalogs (Transloco format, namespaced: app / console / errors).
 * Bundled (not HTTP-loaded) so the typed copy façades (`AppCopyService`,
 * `ConsoleCopyService`) can read them synchronously at first render. The same
 * objects are served to Transloco by `BundledTranslocoLoader` so the `transloco`
 * pipe resolves the same keys. Adding a language = one JSON here + one entry
 * in AVAILABLE_LANGS.
 */
export const CATALOGS = { fr, nl, en, it, es } as const satisfies Record<LanguageCode, unknown>;

/** Shape of a single-language catalog (inferred from the FR reference). */
export type Catalog = typeof fr;
