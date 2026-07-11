import { Injectable, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import { UserMe } from '../models/api.models';
import { USER_KEY } from './session.service';
import { StorageService } from './storage.service';

export type LanguageCode = 'fr' | 'nl' | 'en' | 'it' | 'es';
/** Langues d'UI (Transloco). Le backend n'en persiste que FR/NL/EN (UserLanguage) ;
 * `it`/`es` sont donc des langues d'interface (localStorage), non synchronisées serveur. */
export const UI_LANGS: readonly LanguageCode[] = ['fr', 'nl', 'en', 'it', 'es'];
const LANGUAGE_KEY = 'pushit.language';

/**
 * Language authority for the app. Holds the reactive `language` signal that the
 * typed copy façades key off, and keeps Transloco (the i18n engine) in sync so
 * the `transloco` pipe and the façades always resolve the same language.
 */
@Injectable({ providedIn: 'root' })
export class PublicI18nService {
  private readonly storage = inject(StorageService);
  // Optional so bare unit-test TestBeds (no provideTransloco) don't need to wire
  // Transloco just to construct a service that depends on the language signal.
  private readonly transloco = inject(TranslocoService, { optional: true });
  readonly language = signal<LanguageCode>(this.readInitialLanguage());

  constructor() {
    this.transloco?.setActiveLang(this.language());
  }

  setLanguage(language: LanguageCode): void {
    this.language.set(language);
    this.transloco?.setActiveLang(language);
    this.storage.setString(LANGUAGE_KEY, language);
  }

  private readInitialLanguage(): LanguageCode {
    const storedUser = this.storage.findObject<UserMe>(USER_KEY)?.value;
    if (storedUser?.language === 'FR' || storedUser?.language === 'NL' || storedUser?.language === 'EN') {
      return storedUser.language.toLowerCase() as LanguageCode;
    }

    const storedLanguage = this.storage.getString(LANGUAGE_KEY) as LanguageCode | null;
    if (storedLanguage && UI_LANGS.includes(storedLanguage)) {
      return storedLanguage;
    }

    const nav = (navigator.language || '').slice(0, 2).toLowerCase() as LanguageCode;
    return UI_LANGS.includes(nav) ? nav : 'fr';
  }
}
