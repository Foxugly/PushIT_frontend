import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import * as Sentry from '@sentry/angular';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

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
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Sentry : capture des erreurs non gérées + instrumentation du routing.
    { provide: ErrorHandler, useValue: Sentry.createErrorHandler() },
    { provide: Sentry.TraceService, deps: [Router] },
    provideAppInitializer(() => {
      inject(Sentry.TraceService);
    }),
  ],
};
