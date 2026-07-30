import { Component, computed, effect, inject, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

import { LanguageCode, PublicI18nService } from '../../core/services/public-i18n.service';

export type AppAlertTone = 'success' | 'info' | 'danger';

/** Localized "close" label for the dismiss button. Kept inline (single generic
 * word) rather than wired through the large copy trees; the active language is
 * the global PublicI18nService signal, and callers may override via closeLabel. */
const CLOSE_LABEL: Record<LanguageCode, string> = {
  fr: 'Fermer',
  nl: 'Sluiten',
  en: 'Close',
  it: 'Chiudi',
  es: 'Cerrar',
};

@Component({
  selector: 'app-alert',
  imports: [ButtonModule, TooltipModule],
  templateUrl: './app-alert.html',
  styleUrl: './app-alert.scss',
})
export class AppAlert {
  private readonly i18n = inject(PublicI18nService);

  readonly message = input.required<string>();
  readonly tone = input<AppAlertTone>('info');
  readonly timeoutMs = input(5000);
  /** Override the localized default close label (e.g. to use a page's copy). */
  readonly closeLabel = input<string>('');

  readonly resolvedCloseLabel = computed(() => this.closeLabel() || CLOSE_LABEL[this.i18n.language()]);

  readonly dismissed = output<void>();

  protected isVisible = true;
  protected isFadingOut = false;

  private fadeTimer: ReturnType<typeof setTimeout> | null = null;
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect((onCleanup) => {
      const message = this.message();
      const timeoutMs = this.timeoutMs();

      this.resetVisibility();

      if (!message || timeoutMs <= 0) {
        onCleanup(() => this.clearTimers());
        return;
      }

      const fadeDelay = Math.max(0, timeoutMs - 250);
      this.fadeTimer = setTimeout(() => {
        this.isFadingOut = true;
      }, fadeDelay);

      this.dismissTimer = setTimeout(() => {
        this.close();
      }, timeoutMs);

      onCleanup(() => this.clearTimers());
    });
  }

  close(): void {
    this.clearTimers();
    this.isFadingOut = true;
    this.closeTimer = setTimeout(() => {
      this.isVisible = false;
      this.dismissed.emit();
    }, 180);
  }

  private resetVisibility(): void {
    this.clearTimers();
    this.isVisible = true;
    this.isFadingOut = false;
  }

  private clearTimers(): void {
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }

    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }

    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }
}
