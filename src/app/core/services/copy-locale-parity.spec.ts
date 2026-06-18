import { APP_COPY } from './app-copy.service';
import { CONSOLE_COPY } from './console-copy.service';
import { API_ERROR_COPY } from '../utils/api-error-copy';

/**
 * Guards against locale drift: the FR / NL / EN copy trees must expose the
 * exact same set of keys. Editing one locale and forgetting another is an easy
 * mistake in these large hand-maintained objects.
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
  for (const [name, copy] of [
    ['CONSOLE_COPY', CONSOLE_COPY],
    ['APP_COPY', APP_COPY],
    // API_ERROR_COPY is keyed fr/nl/en like the copy trees; its `http` map's
    // numeric status keys must also stay in parity across locales.
    ['API_ERROR_COPY', API_ERROR_COPY],
  ] as const) {
    it(`${name}: NL and EN have the same keys as FR`, () => {
      const fr = keyPaths(copy.fr).sort();
      const nl = keyPaths(copy.nl).sort();
      const en = keyPaths(copy.en).sort();

      expect({ missingInNl: diff(fr, nl), extraInNl: diff(nl, fr) }).toEqual({
        missingInNl: [],
        extraInNl: [],
      });
      expect({ missingInEn: diff(fr, en), extraInEn: diff(en, fr) }).toEqual({
        missingInEn: [],
        extraInEn: [],
      });
    });
  }
});
