/**
 * Déclarations de types accompagnant `jasmine-compat.ts`.
 *
 * Les specs utilisent `jasmine.SpyObj<T>` et `jasmine.Spy<T>` comme TYPES
 * (25 occurrences chacun) : ce sont des annotations, pas du runtime, donc le
 * shim d'exécution ne suffit pas — il faut aussi les déclarer ici, sinon
 * `tsc` casse sur chaque fichier.
 *
 * À supprimer en même temps que `jasmine-compat.ts`, une fois les specs
 * convertis à l'API vitest native.
 */
import type { Mock, MockInstance } from 'vitest';

/** L'API `.and` de jasmine, greffée sur les mocks par le shim. */
interface JasmineAnd<TReturn = unknown> {
  returnValue(value: TReturn): JasmineSpy<TReturn>;
  resolveTo(value: Awaited<TReturn>): JasmineSpy<TReturn>;
  rejectWith(value: unknown): JasmineSpy<TReturn>;
  callFake(impl: (...args: never[]) => TReturn): JasmineSpy<TReturn>;
  throwError(err: unknown): JasmineSpy<TReturn>;
  callThrough(): JasmineSpy<TReturn>;
  stub(): JasmineSpy<TReturn>;
}

/** `spy.calls` de jasmine — distinct de `spy.mock.calls` de vitest. */
interface JasmineCalls {
  reset(): void;
  count(): number;
  any(): boolean;
  all(): { args: unknown[] }[];
  allArgs(): unknown[][];
  argsFor(i: number): unknown[];
  first(): { args: unknown[] };
  mostRecent(): { args: unknown[] };
}

type JasmineSpy<TReturn = unknown> = Mock & {
  and: JasmineAnd<TReturn>;
  calls: JasmineCalls;
};

declare global {
  namespace jasmine {
    type Spy<T extends (...args: never[]) => unknown = (...args: never[]) => unknown> = Mock &
      Pick<MockInstance, 'mock'> & { and: JasmineAnd<ReturnType<T>>; calls: JasmineCalls };

    /** Chaque méthode de T devient un spy ; les autres membres sont conservés. */
    type SpyObj<T> = T & {
      [K in keyof T]: T[K] extends (...args: never[]) => infer R
        ? Mock & { and: JasmineAnd<R>; calls: JasmineCalls }
        : T[K];
    };

    function createSpy<T extends (...args: never[]) => unknown>(
      name?: string,
      impl?: T,
    ): Spy<T>;

    function createSpyObj<T>(name: string, methods: readonly (keyof T)[]): SpyObj<T>;
    function createSpyObj<T>(name: string, methods: Record<string, unknown>): SpyObj<T>;
    function createSpyObj(name: string, methods: readonly string[]): Record<string, JasmineSpy>;

    function objectContaining<T>(sample: Partial<T>): T;
    function any(ctor: unknown): unknown;
    function anything(): unknown;
  }

  function spyOn<T extends object, K extends keyof T>(
    obj: T,
    method: K,
  ): T[K] extends (...args: never[]) => infer R
    ? Mock & { and: JasmineAnd<R>; calls: JasmineCalls }
    : never;
}

/** Matchers jasmine ajoutés à `expect` par le shim. */
interface JasmineMatchers<R = unknown> {
  toBeTrue(): R;
  toBeFalse(): R;
  toHaveBeenCalledOnceWith(...args: unknown[]): R;
}

// vitest 3 : c'est `Assertion` qu'il faut augmenter (`Matchers` existe mais
// n'est pas le point d'extension documenté, et l'augmenter ne remonte pas
// jusqu'à `expect(...)`).
declare module 'vitest' {
  interface Assertion<T = unknown> extends JasmineMatchers<void> {}
  interface AsymmetricMatchersContaining extends JasmineMatchers<void> {}
}

export {};
