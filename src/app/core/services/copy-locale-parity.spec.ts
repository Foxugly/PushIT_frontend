// Suffixe `Catalog` obligatoire : un `import it from ...` masquerait la
// fonction de test `it()` du runner, et le spec ne compilerait plus.
import enCatalog from '../../../../public/i18n/en.json';
import esCatalog from '../../../../public/i18n/es.json';
import frCatalog from '../../../../public/i18n/fr.json';
import itCatalog from '../../../../public/i18n/it.json';
import nlCatalog from '../../../../public/i18n/nl.json';

// Les catalogues vivent dans public/i18n/ (STANDARD-frontend-layout.md §5bis).
// Le spec les lit en direct : c'est un controle de structure sur les FICHIERS,
// pas sur ce que le store a charge.
const CATALOGS = { fr: frCatalog, nl: nlCatalog, en: enCatalog, it: itCatalog, es: esCatalog };

/**
 * Guards against locale drift: the FR / NL / EN Transloco catalogs must expose
 * the exact same set of keys (app + console + errors namespaces). Editing one
 * locale and forgetting another is an easy mistake in these large catalogs.
 */

/** Collect dotted key paths. Arrays are treated as leaves (we only compare
 * the object key structure, not array lengths/contents). */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

function diff(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  return a.filter((path) => !setB.has(path));
}

describe('copy locale parity (FR / NL / EN / IT / ES)', () => {
  const fr = keyPaths(CATALOGS.fr).sort();

  for (const lang of ['nl', 'en', 'it', 'es'] as const) {
    it(`${lang.toUpperCase()} catalog has the same keys as FR`, () => {
      const other = keyPaths(CATALOGS[lang]).sort();
      expect({ missing: diff(fr, other), extra: diff(other, fr) }).toEqual({
        missing: [],
        extra: [],
      });
    });
  }
});
