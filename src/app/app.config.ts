import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, Router, TitleStrategy, withInMemoryScrolling } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { MessageService } from 'primeng/api';
import { StaleChunkService } from './core/app-update/stale-chunk.service';
import * as Sentry from '@sentry/angular';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

import { routes } from './app.routes';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';
import { CatalogStore } from './core/i18n/catalog-store';
import { PageTitleStrategy } from './core/services/page-title.strategy';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { SessionService } from './core/services/session.service';

// Fleet look: Aura preset with Emerald as primary (same as QuizOnline/TM). The
// `{emerald.*}` tokens shift the whole primary scale (buttons, tags, focus rings)
// + the `green`/success severity to the brand emerald, replacing Aura's blue.
const AuraEmerald = definePreset(Aura, {
  primitive: {
    green: {
      50: '{emerald.50}', 100: '{emerald.100}', 200: '{emerald.200}', 300: '{emerald.300}',
      400: '{emerald.400}', 500: '{emerald.500}', 600: '{emerald.600}', 700: '{emerald.700}',
      800: '{emerald.800}', 900: '{emerald.900}', 950: '{emerald.950}',
    },
  },
  semantic: {
    primary: {
      50: '{emerald.50}', 100: '{emerald.100}', 200: '{emerald.200}', 300: '{emerald.300}',
      400: '{emerald.400}', 500: '{emerald.500}', 600: '{emerald.600}', 700: '{emerald.700}',
      800: '{emerald.800}', 900: '{emerald.900}', 950: '{emerald.950}',
    },
    // Aura's dark scheme defaults to a *zinc* (neutral grey) surface scale, which
    // clashed with the app's slate tokens (_tokens.scss): tables, tabs, dialogs and
    // secondary buttons rendered grey-black on blue-slate cards. Light already uses
    // slate; align dark on it too. Dark cards/panels = surface.900 (#0f172a), the
    // same value as --surface / --card-bg in dark mode.
    colorScheme: {
      dark: {
        surface: {
          0: '#ffffff', 50: '{slate.50}', 100: '{slate.100}', 200: '{slate.200}', 300: '{slate.300}',
          400: '{slate.400}', 500: '{slate.500}', 600: '{slate.600}', 700: '{slate.700}',
          800: '{slate.800}', 900: '{slate.900}', 950: '{slate.950}',
        },
      },
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAnimationsAsync(),
    providePrimeNG({
      ripple: true,
      inputVariant: 'filled',
      theme: {
        preset: AuraEmerald,
        options: {
          darkModeSelector: '.dark-mode',
        },
      },
    }),
    // anchorScrolling : « Changer de mot de passe » mène à /dashboard/settings#security.
    provideRouter(routes, withInMemoryScrolling({ anchorScrolling: 'enabled' })),
    // Titre d'onglet « {page} — PushIT » (data.titleKey des routes), suivi de la langue.
    { provide: TitleStrategy, useExisting: PageTitleStrategy },
    provideHttpClient(withInterceptors([authInterceptor])),
    // Toast global : un seul <p-toast/> monté à la racine des layouts de shell,
    // alimenté par ce MessageService partagé (standard flotte).
    MessageService,
    // i18n : Transloco est le moteur ; les catalogues vivent dans public/i18n/
    // Les façades typées (AppCopyService/ConsoleCopyService) lisent les mêmes
    // catalogues ; PublicI18nService reste l'autorité de langue, synchronisée ici.
    provideTransloco({
      config: {
        availableLangs: ['fr', 'nl', 'en', 'it', 'es'],
        defaultLang: 'fr',
        fallbackLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    // Sentry : capture des erreurs non gérées + instrumentation du routing.
    { provide: ErrorHandler, useValue: Sentry.createErrorHandler() },
    { provide: Sentry.TraceService, deps: [Router] },
    provideAppInitializer(() => {
      inject(Sentry.TraceService);
      // Precharge les 5 catalogues AVANT le premier rendu. Les facades typees
      // (AppCopyService / ConsoleCopyService) et setLanguage() lisent le
      // catalogue de facon synchrone : sans cette attente, le premier rendu
      // trouverait un store vide.
      // Rattrape les onglets ouverts avant un deploiement, dont les chunks
      // differes n'existent plus cote serveur.
      inject(StaleChunkService).init();
      // Silent restore: the access token lives in memory only, so a fresh load
      // re-obtains it from the HttpOnly refresh cookie before the first route
      // guard runs. Never rejects (bounded by a timeout).
      return Promise.all([inject(CatalogStore).preload(), inject(SessionService).restore()]);
    }),
  ],
};
