import { Injectable, inject } from '@angular/core';

import { UserLanguage } from '../models/api.models';
import { PushitApiService } from './pushit-api.service';
import { PublicI18nService, LanguageCode } from './public-i18n.service';
import { SessionService } from './session.service';

@Injectable({ providedIn: 'root' })
export class LanguagePreferenceService {
  private readonly i18n = inject(PublicI18nService);
  private readonly api = inject(PushitApiService);
  private readonly session = inject(SessionService);

  readonly options: Array<{ value: UserLanguage; label: string }> = [
    { value: 'FR', label: 'Francais' },
    { value: 'NL', label: 'Nederlands' },
    { value: 'EN', label: 'English' },
  ];

  currentBackendLanguage(): UserLanguage {
    return this.toBackendLanguage(this.i18n.language());
  }

  applyBackendLanguage(language: UserLanguage | null | undefined): void {
    if (!language) {
      return;
    }

    this.i18n.setLanguage(this.toFrontendLanguage(language));
  }

  updateLanguage(language: LanguageCode): void {
    const previousLanguage = this.i18n.language();
    this.i18n.setLanguage(language);

    if (!this.session.isAuthenticated() || !this.session.user()) {
      return;
    }

    this.api.updateMe({ language: this.toBackendLanguage(language) }).subscribe({
      next: (user) => {
        this.session.updateUser(user);
        this.applyBackendLanguage(user.language);
      },
      error: () => {
        this.i18n.setLanguage(previousLanguage);
      },
    });
  }

  toFrontendLanguage(language: UserLanguage): LanguageCode {
    switch (language) {
      case 'NL':
        return 'nl';
      case 'EN':
        return 'en';
      default:
        return 'fr';
    }
  }

  toBackendLanguage(language: LanguageCode): UserLanguage {
    switch (language) {
      case 'nl':
        return 'NL';
      case 'en':
        return 'EN';
      default:
        return 'FR';
    }
  }
}
