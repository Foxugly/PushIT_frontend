import { Injectable, inject, signal } from '@angular/core';

import { UserMe } from '../models/api.models';
import { StorageService } from './storage.service';

export type LanguageCode = 'fr' | 'nl' | 'en';
const LANGUAGE_KEY = 'pushit.language';
const USER_KEY = 'pushit.user';

@Injectable({ providedIn: 'root' })
export class PublicI18nService {
  private readonly storage = inject(StorageService);
  readonly language = signal<LanguageCode>(this.readInitialLanguage());

  setLanguage(language: LanguageCode): void {
    this.language.set(language);
    this.storage.setString(LANGUAGE_KEY, language);
  }

  private readInitialLanguage(): LanguageCode {
    const storedUser = this.storage.findObject<UserMe>(USER_KEY)?.value;
    if (storedUser?.language === 'FR' || storedUser?.language === 'NL' || storedUser?.language === 'EN') {
      return storedUser.language.toLowerCase() as LanguageCode;
    }

    const storedLanguage = this.storage.getString(LANGUAGE_KEY);
    if (storedLanguage === 'fr' || storedLanguage === 'nl' || storedLanguage === 'en') {
      return storedLanguage;
    }

    return 'fr';
  }
}
