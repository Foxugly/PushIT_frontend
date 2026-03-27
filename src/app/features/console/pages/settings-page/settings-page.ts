import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';

import { LanguagePreferenceService } from '../../../../core/services/language-preference.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { SettingsService } from '../../../../core/services/settings.service';

@Component({
  selector: 'app-settings-page',
  imports: [CommonModule, ReactiveFormsModule, ButtonModule, InputTextModule, SelectModule],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
})
export class SettingsPage {
  private readonly fb = inject(FormBuilder);
  readonly shell = inject(ConsoleShellService);
  readonly settings = inject(SettingsService);
  readonly languagePreference = inject(LanguagePreferenceService);

  readonly banner = signal<string | null>(null);
  readonly form = this.fb.nonNullable.group({
    apiBaseUrl: [this.settings.apiBaseUrl(), [Validators.required]],
    language: [this.languagePreference.currentBackendLanguage(), [Validators.required]],
  });

  constructor() {
    effect(() => {
      const language = this.languagePreference.currentBackendLanguage();
      if (!this.form.controls.language.dirty) {
        this.form.patchValue({ language }, { emitEvent: false });
      }
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { apiBaseUrl, language } = this.form.getRawValue();
    this.settings.updateApiBaseUrl(apiBaseUrl);
    this.languagePreference.updateLanguage(this.languagePreference.toFrontendLanguage(language));
    this.banner.set('Preferences enregistrees.');
    this.shell.loadShell(this.shell.selectedAppId() ?? undefined);
  }
}
