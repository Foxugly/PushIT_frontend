import { computed, inject, Injectable } from '@angular/core';

import { CATALOGS } from '../i18n/catalogs';
import { PublicI18nService } from './public-i18n.service';

/**
 * Typed façade over the public/app copy. The i18n engine is Transloco; the
 * catalogs live in core/i18n/catalogs (namespace `app`). `current()` reacts to
 * the active language held by PublicI18nService.
 */
@Injectable({ providedIn: 'root' })
export class AppCopyService {
  private readonly i18n = inject(PublicI18nService);

  readonly current = computed(() => CATALOGS[this.i18n.language()].app);
}
