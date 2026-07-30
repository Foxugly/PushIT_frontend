/**
 * Environnement de test — ce que karma fournissait et que vitest/jsdom ne
 * fournit pas.
 *
 * Chargé avant `jasmine-compat.ts` (voir l'ordre de `setupFiles` dans
 * angular.json). Contrairement au shim jasmine, ce fichier n'est PAS
 * temporaire : il reste nécessaire après la conversion des specs.
 */

// karma déclarait `polyfills: ["zone.js", "zone.js/testing"]`. Le builder
// unit-test hérite des polyfills de la cible de build, qui ne contient que
// `zone.js` — sans le complément `testing`, `fakeAsync`/`tick` échouent sur
// « Expected to be running in 'ProxyZone', but it was not found ».
import 'zone.js/testing';

// jsdom n'implémente pas ResizeObserver, et PrimeNG l'appelle sans garde dans
// `<p-tabs>` (TabList.bindResizeObserver) : sans ce stub, tout spec montant un
// composant à onglets casse en ngAfterViewInit. Un no-op suffit — les specs
// n'assertent rien sur le redimensionnement.
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: ResizeObserverStub,
  });
}

// La suite a ete ecrite sous karma/Chrome, dont la locale etait `fr`.
// PublicI18nService lit `navigator.language` pour choisir la langue par defaut,
// et jsdom rapporte `en-US` : sans ce pin, les specs qui assertent une chaine
// francaise echouent. La dependance a la locale ambiante existait deja, karma
// la masquait — on la rend explicite plutot que de la subir.
Object.defineProperty(navigator, 'language', { configurable: true, value: 'fr-FR' });
Object.defineProperty(navigator, 'languages', { configurable: true, value: ['fr-FR', 'fr'] });

// jsdom n'implemente pas execCommand. Deux specs le remplacent par un spy pour
// tester le repli de copie quand l'API clipboard est absente ; `spyOn` exige que
// la propriete existe. Le stub n'est jamais appele tel quel.
if (typeof document.execCommand !== 'function') {
  Object.defineProperty(document, 'execCommand', {
    writable: true,
    configurable: true,
    value: () => false,
  });
}

// Idem : jsdom ne fournit pas createObjectURL/revokeObjectURL, utilises pour les
// apercus d'image (logo d'application).
if (typeof URL.createObjectURL !== 'function') {
  Object.defineProperty(URL, 'createObjectURL', {
    writable: true,
    configurable: true,
    value: () => 'blob:stub',
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    writable: true,
    configurable: true,
    value: () => {},
  });
}
