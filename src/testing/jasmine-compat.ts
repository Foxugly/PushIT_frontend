/**
 * Couche de compatibilité jasmine -> vitest.
 *
 * Ce dépôt est passé de karma/jasmine à vitest le 2026-07-30, pour sortir de
 * karma 6.4 : déprécié, et il tirait une chaîne glob 7 -> minimatch 3 ->
 * brace-expansion 1.x responsable de 9 alertes Dependabot « high » sans aucun
 * correctif disponible dans ces lignes majeures.
 *
 * Les 28 fichiers de specs (~4 100 lignes, ~340 appels jasmine) n'ont PAS été
 * réécrits d'un bloc : ce shim les fait tourner tels quels sous vitest. La
 * conversion vers l'API vitest native se fait fichier par fichier, sans
 * urgence. Quand plus aucun spec n'utilise `jasmine.*` / `spyOn` / les
 * matchers ci-dessous, supprimer ce fichier et son entrée `setupFiles`.
 *
 * Ce qui est couvert ici est exactement ce que les specs utilisaient, pas plus :
 *   jasmine.createSpyObj / createSpy / objectContaining / any
 *   spyOn
 *   .and.returnValue / .and.resolveTo / .and.callFake
 *   toBeTrue / toBeFalse / toHaveBeenCalledOnceWith
 *
 * Volontairement NON couverts, convertis à la main car un shim y serait plus
 * fragile que le correctif : `expect().withContext()` (-> 2e argument de
 * `expect`) et `expectAsync().toBeResolvedTo()` (-> `expect().resolves`).
 */
import { expect, vi } from 'vitest';
import type { Mock, MockInstance } from 'vitest';

type AnyFn = (...args: never[]) => unknown;

/**
 * Greffe l'API `.and` de jasmine sur un mock vitest.
 *
 * Chaque méthode renvoie le mock lui-même : jasmine autorise le chaînage
 * (`spy.and.returnValue(x).and.callFake(f)`) et certains specs s'en servent.
 */
function withAnd<T extends Mock | MockInstance>(fn: T): T {
  // `spy.calls` de jasmine — distinct de `spy.mock.calls` de vitest, donc
  // aucune collision. Lu dynamiquement : `fn.mock.calls` change à chaque appel.
  Object.defineProperty(fn, 'calls', {
    configurable: true,
    get: () => {
      const calls = fn.mock.calls as unknown[][];
      return {
        reset: () => fn.mockClear(),
        count: () => calls.length,
        any: () => calls.length > 0,
        all: () => calls.map((args) => ({ args })),
        allArgs: () => calls,
        argsFor: (i: number) => calls[i] ?? [],
        first: () => ({ args: calls[0] ?? [] }),
        mostRecent: () => ({ args: calls[calls.length - 1] ?? [] }),
      };
    },
  });
  Object.defineProperty(fn, 'and', {
    configurable: true,
    writable: true,
    value: {
      returnValue: (value: unknown) => (fn.mockReturnValue(value as never), fn),
      resolveTo: (value: unknown) => (fn.mockResolvedValue(value as never), fn),
      rejectWith: (value: unknown) => (fn.mockRejectedValue(value as never), fn),
      callFake: (impl: AnyFn) => (fn.mockImplementation(impl as never), fn),
      throwError: (err: unknown) => (
        fn.mockImplementation((() => {
          throw err instanceof Error ? err : new Error(String(err));
        }) as never),
        fn
      ),
      // jasmine restaure l'implémentation réelle ; sous vitest, `vi.spyOn`
      // la conserve déjà par défaut, donc il n'y a rien à faire.
      callThrough: () => fn,
      stub: () => (fn.mockImplementation((() => undefined) as never), fn),
    },
  });
  return fn;
}

const jasmineShim = {
  createSpy: (_name?: string, impl?: AnyFn) => withAnd(impl ? vi.fn(impl as never) : vi.fn()),

  /**
   * `createSpyObj('Name', ['a', 'b'])` ou `createSpyObj('Name', { a: 1 })`.
   * La forme objet fixe directement la valeur de retour de chaque méthode.
   */
  createSpyObj: (_name: string, methods: readonly string[] | Record<string, unknown>) => {
    const obj: Record<string, unknown> = {};
    if (Array.isArray(methods)) {
      for (const m of methods) obj[m] = withAnd(vi.fn());
    } else {
      for (const [m, ret] of Object.entries(methods as Record<string, unknown>)) {
        obj[m] = withAnd(vi.fn().mockReturnValue(ret as never));
      }
    }
    return obj;
  },

  objectContaining: (sample: Record<string, unknown>) => expect.objectContaining(sample),
  any: (ctor: unknown) => expect.any(ctor as never),
  anything: () => expect.anything(),
};

const spyOnShim = <T extends object, K extends keyof T>(obj: T, method: K) =>
  withAnd(vi.spyOn(obj, method as never));

Object.assign(globalThis, { jasmine: jasmineShim, spyOn: spyOnShim });

expect.extend({
  // jasmine distingue `toBeTrue` (=== true) de `toBeTruthy`. Garder la
  // distinction : plusieurs specs s'appuient dessus pour verrouiller un signal
  // booléen, et un `toBeTruthy` laisserait passer 1 ou 'x'.
  toBeTrue(received: unknown) {
    return {
      pass: received === true,
      message: () => `attendu exactement true, reçu ${this.utils.printReceived(received)}`,
    };
  },
  toBeFalse(received: unknown) {
    return {
      pass: received === false,
      message: () => `attendu exactement false, reçu ${this.utils.printReceived(received)}`,
    };
  },
  toHaveBeenCalledOnceWith(received: Mock, ...expected: unknown[]) {
    const calls = received?.mock?.calls ?? [];
    const pass = calls.length === 1 && this.equals(calls[0], expected);
    return {
      pass,
      message: () =>
        `attendu un appel unique avec ${this.utils.printExpected(expected)}, ` +
        `reçu ${calls.length} appel(s) : ${this.utils.printReceived(calls)}`,
    };
  },
});
