import { CATALOGS } from '../i18n/catalogs';

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

describe('copy locale parity (FR / NL / EN)', () => {
  it('NL and EN catalogs have the same keys as FR', () => {
    const fr = keyPaths(CATALOGS.fr).sort();
    const nl = keyPaths(CATALOGS.nl).sort();
    const en = keyPaths(CATALOGS.en).sort();

    expect({ missingInNl: diff(fr, nl), extraInNl: diff(nl, fr) }).toEqual({
      missingInNl: [],
      extraInNl: [],
    });
    expect({ missingInEn: diff(fr, en), extraInEn: diff(en, fr) }).toEqual({
      missingInEn: [],
      extraInEn: [],
    });
  });
});
