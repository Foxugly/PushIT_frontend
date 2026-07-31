import { computed, inject, Injectable } from '@angular/core';

import { CatalogStore } from '../i18n/catalog-store';
import { PublicI18nService } from './public-i18n.service';

/**
 * Typed façade over the public/app copy. The i18n engine is Transloco; the
 * catalogs live in core/i18n/catalogs (namespace `app`). `current()` reacts to
 * the active language held by PublicI18nService.
 */
@Injectable({ providedIn: 'root' })
export class AppCopyService {
  private readonly i18n = inject(PublicI18nService);
  private readonly catalogs = inject(CatalogStore);

  readonly current = computed(() => this.catalogs.get(this.i18n.language()).app);
}
