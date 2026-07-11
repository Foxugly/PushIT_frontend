import { Injectable } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { Observable, of } from 'rxjs';

import { CATALOGS } from './catalogs';

/**
 * Serves the bundled catalogs to Transloco (no HTTP). The typed façades read the
 * same CATALOGS synchronously, so the `transloco` pipe and the façades share the
 * exact same data.
 */
@Injectable({ providedIn: 'root' })
export class BundledTranslocoLoader implements TranslocoLoader {
  getTranslation(lang: string): Observable<Translation> {
    return of(((CATALOGS as Record<string, unknown>)[lang] ?? {}) as Translation);
  }
}
