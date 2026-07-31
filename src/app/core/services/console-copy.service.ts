import { computed, inject, Injectable } from '@angular/core';

import { CatalogStore } from '../i18n/catalog-store';
import { PublicI18nService } from './public-i18n.service';

/**
 * Typed façade over the console copy. The i18n engine is Transloco; the catalogs
 * live in core/i18n/catalogs (namespace `console`). `current()` reacts to the
 * active language held by PublicI18nService.
 */
@Injectable({ providedIn: 'root' })
export class ConsoleCopyService {
  private readonly i18n = inject(PublicI18nService);
  private readonly catalogs = inject(CatalogStore);

  readonly current = computed(() => this.catalogs.get(this.i18n.language()).console);
}
