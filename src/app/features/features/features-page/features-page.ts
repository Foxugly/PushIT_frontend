import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { PublicI18nService } from '../../../core/services/public-i18n.service';
import { SettingsService } from '../../../core/services/settings.service';
import { SiteFooter } from '../../../shared/site-footer/site-footer';
import { SiteHeader } from '../../../shared/site-header/site-header';

const COPY = {
  fr: {
    badge: 'Features',
    title: 'Tout ce que le frontend couvre deja.',
    description:
      'La page regroupe les workflows exposes par le backend ainsi que la configuration de la cible API.',
    backendTitle: 'Configuration backend',
    backendDescription:
      "Definissez ici l'URL de base de l'API utilisee par tout le frontend Angular.",
    submit: 'Enregistrer',
    saved: 'Enregistre',
    cards: [
      {
        title: 'Authentification',
        description:
          'JWT, refresh token automatique, session persistante ou session navigateur selon "se souvenir de moi".',
      },
      {
        title: 'Applications et quiet periods',
        description:
          'Creation, activation, rotation des tokens, periodes blanches et suivi des impacts sur les envois.',
      },
      {
        title: 'Notifications et devices',
        description:
          'Notifications utilisateur, notifications via app token, devices relies et filtres de listing.',
      },
    ],
  },
  nl: {
    badge: 'Features',
    title: 'Alles wat de frontend al ondersteunt.',
    description:
      'Deze pagina groepeert de backend-workflows en de configuratie van de API-doelomgeving.',
    backendTitle: 'Backendconfiguratie',
    backendDescription:
      'Definieer hier de basis-URL van de API die door de Angular-frontend wordt gebruikt.',
    submit: 'Opslaan',
    saved: 'Opgeslagen',
    cards: [
      {
        title: 'Authenticatie',
        description:
          'JWT, automatische refresh token, persistente sessie of browsersessie via "onthoud mij".',
      },
      {
        title: 'Applicaties en quiet periods',
        description:
          'Aanmaken, activeren, tokenrotatie, stille periodes en opvolging van het effect op verzending.',
      },
      {
        title: 'Notificaties en devices',
        description:
          'Gebruikersnotificaties, notificaties via app-token, gekoppelde devices en listingfilters.',
      },
    ],
  },
  en: {
    badge: 'Features',
    title: 'Everything the frontend already covers.',
    description:
      'This page gathers the backend workflows already exposed in the UI along with API target configuration.',
    backendTitle: 'Backend configuration',
    backendDescription:
      'Set here the API base URL used across the Angular frontend.',
    submit: 'Save',
    saved: 'Saved',
    cards: [
      {
        title: 'Authentication',
        description:
          'JWT, automatic refresh token, persistent session or browser-only session via "remember me".',
      },
      {
        title: 'Applications and quiet periods',
        description:
          'Creation, activation, token rotation, quiet periods and visibility on effective scheduling.',
      },
      {
        title: 'Notifications and devices',
        description:
          'User notifications, app-token notifications, linked devices and filtering workflows.',
      },
    ],
  },
} as const;

@Component({
  selector: 'app-features-page',
  imports: [CommonModule, ReactiveFormsModule, SiteHeader, SiteFooter],
  templateUrl: './features-page.html',
  styleUrl: './features-page.scss',
})
export class FeaturesPage {
  private readonly i18n = inject(PublicI18nService);
  private readonly settings = inject(SettingsService);
  private readonly fb = inject(FormBuilder);

  readonly saved = signal(false);
  readonly copy = computed(() => COPY[this.i18n.language()]);
  readonly form = this.fb.nonNullable.group({
    apiBaseUrl: [this.settings.apiBaseUrl(), [Validators.required]],
  });

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.settings.updateApiBaseUrl(this.form.getRawValue().apiBaseUrl);
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }
}
