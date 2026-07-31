import { Injectable, inject } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { Observable, of } from 'rxjs';

import { CatalogStore } from './catalog-store';
import { LanguageCode } from '../services/public-i18n.service';

/**
 * Sert a Transloco les catalogues deja charges par `CatalogStore` depuis
 * `public/i18n/<lang>.json` (STANDARD-frontend-layout.md §5bis).
 *
 * Le fetch HTTP a lieu une seule fois, dans le store, au bootstrap : le pipe
 * `transloco` et les facades typees lisent donc rigoureusement les memes objets,
 * sans double telechargement.
 */
@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private readonly store = inject(CatalogStore);

  getTranslation(lang: string): Observable<Translation> {
    return of(this.store.get(lang as LanguageCode) as unknown as Translation);
  }
}
