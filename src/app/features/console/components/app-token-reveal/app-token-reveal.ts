import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { finalize, switchMap } from 'rxjs';

import { ApplicationRead } from '../../../../core/models/api.models';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { AppAlert } from '../../../../shared/app-alert/app-alert';

/**
 * One-time app-token reveal: renders the token's QR code (for the mobile app to
 * link a device) plus the raw token, with copy/download affordances and the
 * "shown only once" warning. The raw token is a secret only available right
 * after create/regenerate, so this surface is the single place it is exposed —
 * shared by the applications list QR dialog and the application detail page so
 * a freshly-created app's token stays reachable wherever the user lands.
 */
@Component({
  selector: 'app-token-reveal',
  imports: [CommonModule, AppAlert, ButtonModule, TooltipModule],
  templateUrl: './app-token-reveal.html',
  styleUrl: './app-token-reveal.scss',
})
export class AppTokenReveal {
  private readonly api = inject(PushitApiService);
  private readonly consoleCopy = inject(ConsoleCopyService);
  private readonly destroyRef = inject(DestroyRef);

  /** The application the token belongs to. */
  readonly app = input.required<ApplicationRead>();
  /** The raw one-time token to reveal. */
  readonly token = input.required<string>();

  readonly copy = computed(() => this.consoleCopy.current().applications.qr);

  readonly qrImageUrl = signal<string | null>(null);
  readonly qrLoading = signal(false);
  readonly qrError = signal<string | null>(null);
  readonly banner = signal<string | null>(null);

  constructor() {
    // Fetch (and re-fetch) the QR image whenever the app/token inputs change.
    toObservable(computed(() => ({ appId: this.app().id, token: this.token() })))
      .pipe(
        switchMap(({ appId, token }) => {
          this.qrImageUrl.set(null);
          this.qrError.set(null);
          this.qrLoading.set(true);
          return this.api.getAppQrCode(appId, token).pipe(finalize(() => this.qrLoading.set(false)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (blob) => {
          // Read as a data: URL rather than a blob: object URL — the enforced
          // CSP allows `img-src data:` but not `blob:`, so a blob URL would be
          // silently blocked and the QR would never render.
          const reader = new FileReader();
          reader.onloadend = () => this.qrImageUrl.set(reader.result as string);
          reader.onerror = () => this.qrError.set(this.copy().error);
          reader.readAsDataURL(blob);
        },
        error: () => this.qrError.set(this.copy().error),
      });
  }

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

  /** Download the QR image as `<ts>_qrcode_token_<app>.<ext>` (ext from the
   * blob's mime). The QR is held as a data: URL, so an anchor download works
   * under the enforced CSP (no blob: needed). */
  downloadQr(): void {
    const url = this.qrImageUrl();
    if (!url) {
      return;
    }
    const mime = url.slice(5, url.indexOf(';')); // "image/png" from "data:image/png;base64,…"
    const sub = (mime.split('/')[1] ?? 'png').split('+')[0]; // svg+xml -> svg
    const ext = sub === 'jpeg' ? 'jpg' : sub;
    this.triggerDownload(url, `${this.fileStamp()}_qrcode_token_${this.appSlug(this.app().name)}.${ext}`);
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
