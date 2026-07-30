import { Component, computed, inject } from '@angular/core';

import { PublicI18nService } from '../../../core/services/public-i18n.service';
import { getPrivacyCopy } from './privacy.i18n';

@Component({
  selector: 'app-privacy-page',
  imports: [],
  templateUrl: './privacy-page.html',
  styleUrl: './privacy-page.scss',
})
export class PrivacyPage {
  private readonly i18n = inject(PublicI18nService);

  readonly copy = computed(() => getPrivacyCopy(this.i18n.language()));

  // mailto: link reused for the contact CTA — robust against locale changes.
  protected mailto(email: string): string {
    return `mailto:${email}`;
  }
}
