import { Component, computed, inject, input, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

import { ApplicationRead } from '../../../../core/models/api.models';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { AppAlert } from '../../../../shared/app-alert/app-alert';

/**
 * One-time send-token reveal: the raw `apt_` token, with copy/download
 * affordances and the "shown only once" warning. No QR code any more
 * (2026-10-21): the only QR a phone should scan is the enrolment code
 * (`apk_`, <app-enrolment-panel>); a send-token QR next to it got scanned by
 * mistake, and the app refuses send tokens. The raw token is a secret only available right
 * after create/regenerate, so this surface is the single place it is exposed —
 * shared by the applications list QR dialog and the application detail page so
 * a freshly-created app's token stays reachable wherever the user lands.
 */
@Component({
  selector: 'app-token-reveal',
  imports: [AppAlert, ButtonModule, TooltipModule],
  templateUrl: './app-token-reveal.html',
  styleUrl: './app-token-reveal.scss',
})
export class AppTokenReveal {
  private readonly consoleCopy = inject(ConsoleCopyService);

  /** The application the token belongs to. */
  readonly app = input.required<ApplicationRead>();
  /** The raw one-time token to reveal. */
  readonly token = input.required<string>();

  readonly copy = computed(() => this.consoleCopy.current().applications.qr);

  readonly banner = signal<string | null>(null);

  async copyToken(): Promise<void> {
    const token = this.token();
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(token);
      } else {
        this.copyWithFallback(token);
      }
      this.banner.set(this.copy().copied);
    } catch {
      this.banner.set(this.copy().copyFailed);
    }
  }

  /** Download the raw token as `<ts>_token_<app>.txt` via a text data: URL. */
  downloadToken(): void {
    const token = this.token();
    if (!token) {
      return;
    }
    const url = `data:text/plain;charset=utf-8,${encodeURIComponent(token)}`;
    this.triggerDownload(url, `${this.fileStamp()}_token_${this.appSlug(this.app().name)}.txt`);
  }

  private triggerDownload(href: string, filename: string): void {
    if (typeof document === 'undefined') {
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  private copyWithFallback(value: string): void {
    if (typeof document === 'undefined') {
      throw new Error('Clipboard unavailable');
    }
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (!copied) {
      throw new Error('Copy failed');
    }
  }

  /** `YYYYMMDDHHmmSS` timestamp for filenames. */
  private fileStamp(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }

  /** Filename-safe app name: keep word chars, collapse the rest to single `_`. */
  private appSlug(name: string): string {
    return name.trim().replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '') || 'app';
  }
}
