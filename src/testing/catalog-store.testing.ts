import { Provider } from '@angular/core';

import { Catalog, CatalogStore } from '../app/core/i18n/catalog-store';
import { LanguageCode } from '../app/core/services/public-i18n.service';
import enCatalog from '../../public/i18n/en.json';
import esCatalog from '../../public/i18n/es.json';
import frCatalog from '../../public/i18n/fr.json';
import itCatalog from '../../public/i18n/it.json';
import nlCatalog from '../../public/i18n/nl.json';

// Suffixe `Catalog` obligatoire : un `import it from ...` masquerait la fonction
// de test `it()` du runner.
const CATALOGS: Record<LanguageCode, Catalog> = {
  fr: frCatalog,
  nl: nlCatalog,
  en: enCatalog,
  it: itCatalog,
  es: esCatalog,
};

/**
 * `CatalogStore` deja rempli, pour les specs.
 *
 * En production le store est alimente par HTTP depuis `public/i18n/` et
 * `preload()` est attendu dans un APP_INITIALIZER : les lectures synchrones des
 * facades typees ne peuvent donc pas echouer. Un TestBed n'a pas de bootstrap —
 * sans ce provider, la premiere lecture leve.
 *
 * C'est un double, pas une instance reelle : le vrai store injecte `HttpClient`
 * a la construction, ce qui echouerait hors contexte d'injection.
 *
 * On importe les MEMES fichiers que ceux servis en production, pas des fixtures
 * qui pourraient deriver.
 */
export function provideTestCatalogs(): Provider {
  const store: Pick<CatalogStore, 'get' | 'preload'> = {
    get: (lang: LanguageCode) => CATALOGS[lang],
    preload: () => Promise.resolve(),
  };
  return { provide: CatalogStore, useValue: store };
}
