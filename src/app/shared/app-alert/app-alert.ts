import { CommonModule } from '@angular/common';
import { Component, effect, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

export type AppAlertTone = 'success' | 'info' | 'danger';

@Component({
  selector: 'app-alert',
  imports: [CommonModule, ButtonModule, TooltipModule],
  templateUrl: './app-alert.html',
  styleUrl: './app-alert.scss',
})
export class AppAlert {
  readonly message = input.required<string>();
  readonly tone = input<AppAlertTone>('info');
  readonly timeoutMs = input(5000);

  readonly dismissed = output<void>();

  protected isVisible = true;
  protected isFadingOut = false;

  private fadeTimer: ReturnType<typeof setTimeout> | null = null;
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;

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
    setTimeout(() => {
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
  }
}
