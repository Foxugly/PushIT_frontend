import { Injectable, signal } from '@angular/core';

const THEME_KEY = 'theme';
type Theme = 'light' | 'dark';

/**
 * Dark/light toggle (fleet standard). Adds `.dark-mode` on <html>, which drives
 * both PrimeNG (darkModeSelector: '.dark-mode') and the app's own `_tokens.scss`
 * `.dark-mode` overrides. The persisted value is applied pre-boot by the
 * anti-FOUC snippet in index.html; this service reconciles + handles the toggle.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>('light');

  init(): void {
    const stored = this.read();
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    this.apply(stored ?? (prefersDark ? 'dark' : 'light'));
  }

  toggle(): void {
    this.apply(this.theme() === 'dark' ? 'light' : 'dark');
  }

  private read(): Theme | null {
    try {
      const v = localStorage.getItem(THEME_KEY);
      return v === 'dark' || v === 'light' ? v : null;
    } catch {
      return null;
    }
  }

  private apply(theme: Theme): void {
    this.theme.set(theme);
    document.documentElement.classList.toggle('dark-mode', theme === 'dark');
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* localStorage unavailable — non-fatal */
    }
  }
}
