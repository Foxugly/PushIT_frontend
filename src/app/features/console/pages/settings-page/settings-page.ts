import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';

import { UserLanguage } from '../../../../core/models/api.models';
import { AppCopyService } from '../../../../core/services/app-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { LanguagePreferenceService } from '../../../../core/services/language-preference.service';
import { AppAlert, AppAlertTone } from '../../../../shared/app-alert/app-alert';
import { PageHeader } from '../../../../shared/page-header/page-header';
import { ChangePasswordPanel } from '../../components/change-password-panel/change-password-panel';
import { DeleteAccountPanel } from '../../components/delete-account-panel/delete-account-panel';

type BannerKey = 'languageSaved' | 'userkeyCopied' | 'copyFailed';

/**
 * « Mon compte » — one column of cards: the account (e-mail, userkey, language
 * saved on change), security (change password) and the danger zone (delete).
 * The API base URL comes from the runtime config and has no UI here.
 */
@Component({
  selector: 'app-settings-page',
  imports: [
    PageHeader,
    ReactiveFormsModule,
    AppAlert,
    ChangePasswordPanel,
    DeleteAccountPanel,
    ButtonModule,
    SelectModule,
    TooltipModule,
  ],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
})
export class SettingsPage {
  private readonly appCopy = inject(AppCopyService);
  readonly shell = inject(ConsoleShellService);
  readonly languagePreference = inject(LanguagePreferenceService);

  readonly copy = computed(() => this.appCopy.current().console.settings);
  /** Copy key rather than text: a language change re-translates the alert it raised. */
  readonly banner = signal<{ key: BannerKey; tone: AppAlertTone } | null>(null);
  readonly bannerMessage = computed(() => {
    const banner = this.banner();
    return banner ? this.copy()[banner.key] : '';
  });
  readonly language = new FormControl<UserLanguage>(this.languagePreference.currentBackendLanguage(), {
    nonNullable: true,
  });

  constructor() {
    // Follow a language changed elsewhere (top-bar switcher, backend profile).
    effect(() => {
      const language = this.languagePreference.currentBackendLanguage();
      if (this.language.value !== language) {
        this.language.setValue(language, { emitEvent: false });
      }
    });
  }

  saveLanguage(language: UserLanguage): void {
    this.languagePreference.updateLanguage(this.languagePreference.toFrontendLanguage(language));
    // No shell reload: with no app yet, the console layout swaps the router
    // outlet for its loading card, which would recreate this page and drop the alert.
    this.banner.set({ key: 'languageSaved', tone: 'success' });
  }

  async copyUserkey(): Promise<void> {
    const userkey = this.shell.user()?.userkey;
    if (!userkey) {
      return;
    }
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(userkey);
      this.banner.set({ key: 'userkeyCopied', tone: 'success' });
    } catch {
      this.banner.set({ key: 'copyFailed', tone: 'danger' });
    }
  }
}
