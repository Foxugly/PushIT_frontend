import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { finalize } from 'rxjs';

import { ApiErrorResponse, ApplicationRead } from '../../../../core/models/api.models';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { coerceApiError } from '../../../../core/utils/api-error.utils';
import { interpolate } from '../../../../core/utils/string.utils';
import { AppAlert } from '../../../../shared/app-alert/app-alert';
import { ApiErrorMessagePipe } from '../../../../core/pipes/api-error-message.pipe';
import { AppConfirmService } from '../../../../shared/app-confirm-dialog/app-confirm.service';

@Component({
  selector: 'app-applications-page',
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
    AppAlert,
    ApiErrorMessagePipe,
    ButtonModule,
    DialogModule,
    TableModule,
    TagModule,
    TooltipModule,
  ],
  templateUrl: './applications-page.html',
  styleUrl: './applications-page.scss',
})
export class ApplicationsPage implements OnDestroy {
  private readonly api = inject(PushitApiService);
  private readonly consoleCopy = inject(ConsoleCopyService);
  private readonly confirm = inject(AppConfirmService);
  private readonly router = inject(Router);
  readonly shell = inject(ConsoleShellService);
  readonly copy = computed(() => this.consoleCopy.current().applications);

  readonly pending = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly banner = signal<string | null>(null);
  readonly activeAppsCount = computed(() => this.shell.apps().filter((app) => app.is_active).length);

  // QR dialog: shows the app token as a scannable QR (for the mobile app to
  // link a device). The raw token is only available right after create/
  // regenerate (it's stored hashed), so the dialog falls back to a regenerate
  // affordance when we don't hold it.
  readonly qrApp = signal<ApplicationRead | null>(null);
  readonly qrImageUrl = signal<string | null>(null);
  readonly qrLoading = signal(false);
  readonly qrError = signal<string | null>(null);
  /** Raw token for the dialog's app, iff it was just (re)generated this session. */
  readonly qrToken = computed(() => {
    const app = this.qrApp();
    const last = this.shell.lastGeneratedToken();
    return app && last && last.appId === app.id ? last.token : null;
  });

  openCreate(): void {
    void this.router.navigate(['/dashboard/applications/new']);
  }

  openEdit(app: ApplicationRead): void {
    void this.router.navigate(['/dashboard/applications', app.id, 'edit']);
  }

  toggleState(app: ApplicationRead): void {
    this.pending.set(true);
    this.error.set(null);
    this.banner.set(null);

    this.shell.toggleAppState(
      app,
      () => {
        this.pending.set(false);
        this.banner.set(!app.is_active ? this.copy().alerts.deactivated : this.copy().alerts.activated);
      },
      () => {
        this.pending.set(false);
        this.error.set({
          code: 'application_toggle_failed',
          detail: this.copy().errors.toggle,
        });
      },
    );
  }

  async regenerateToken(app: ApplicationRead): Promise<void> {
    const confirmed = await this.confirm.ask({
      message: this.interpolate(this.copy().confirmRegenerate, { name: app.name }),
    });
    if (!confirmed) {
      return;
    }

    this.pending.set(true);
    this.error.set(null);
    this.banner.set(null);

    this.shell.regenerateToken(
      app,
      () => {
        this.pending.set(false);
        this.banner.set(this.copy().alerts.regenerated);
      },
      () => {
        this.pending.set(false);
        this.error.set({
          code: 'application_token_failed',
          detail: this.copy().errors.regenerate,
        });
      },
    );
  }

  async copyToken(token: string): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(token);
      } else {
        this.copyWithFallback(token);
      }
      this.banner.set(this.copy().qr.copied);
    } catch {
      this.error.set({ code: 'clipboard_failed', detail: this.copy().qr.copyFailed });
    }
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

  /** Download the QR image as `<ts>_qrcode_token_<app>.<ext>` (ext from the
   * blob's mime). The QR is held as a data: URL, so an anchor download works
   * under the enforced CSP (no blob: needed). */
  downloadQr(): void {
    const url = this.qrImageUrl();
    const app = this.qrApp();
    if (!url || !app) {
      return;
    }
    const mime = url.slice(5, url.indexOf(';')); // "image/png" from "data:image/png;base64,…"
    const sub = (mime.split('/')[1] ?? 'png').split('+')[0]; // svg+xml -> svg
    const ext = sub === 'jpeg' ? 'jpg' : sub;
    this.triggerDownload(url, `${this.fileStamp()}_qrcode_token_${this.appSlug(app.name)}.${ext}`);
  }

  /** Download the raw token as `<ts>_token_<app>.txt` via a text data: URL. */
  downloadToken(token: string): void {
    const app = this.qrApp();
    if (!token || !app) {
      return;
    }
    const url = `data:text/plain;charset=utf-8,${encodeURIComponent(token)}`;
    this.triggerDownload(url, `${this.fileStamp()}_token_${this.appSlug(app.name)}.txt`);
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

  openQr(app: ApplicationRead): void {
    this.qrApp.set(app);
    this.qrError.set(null);
    this.clearQrImage();
    const token = this.qrToken();
    if (token) {
      this.loadQr(app.id, token);
    }
  }

  setQrVisible(visible: boolean): void {
    if (!visible) {
      this.closeQr();
    }
  }

  closeQr(): void {
    this.clearQrImage();
    this.qrApp.set(null);
    this.qrError.set(null);
    this.qrLoading.set(false);
  }

  /** Regenerate the token (rotating it) so we hold the raw value, then show its QR. */
  regenerateForQr(app: ApplicationRead): void {
    this.qrError.set(null);
    this.qrLoading.set(true);
    this.shell.regenerateToken(
      app,
      () => {
        const token = this.qrToken();
        if (token) {
          this.loadQr(app.id, token);
        } else {
          this.qrLoading.set(false);
          this.qrError.set(this.copy().qr.error);
        }
      },
      () => {
        this.qrLoading.set(false);
        this.qrError.set(this.copy().errors.regenerate);
      },
    );
  }

  private loadQr(appId: number, token: string): void {
    this.qrLoading.set(true);
    this.qrError.set(null);
    this.api
      .getAppQrCode(appId, token)
      .pipe(finalize(() => this.qrLoading.set(false)))
      .subscribe({
        next: (blob) => {
          // Read as a data: URL rather than a blob: object URL — the enforced
          // CSP allows `img-src data:` but not `blob:`, so a blob URL would be
          // silently blocked and the QR would never render.
          const reader = new FileReader();
          reader.onloadend = () => this.qrImageUrl.set(reader.result as string);
          reader.onerror = () => this.qrError.set(this.copy().qr.error);
          reader.readAsDataURL(blob);
        },
        error: () => this.qrError.set(this.copy().qr.error),
      });
  }

  ngOnDestroy(): void {
    // Don't leave the QR data-URL (encoding a token) lingering in memory after
    // navigating away; the raw token in the shell auto-clears on its own.
    this.clearQrImage();
  }

  private clearQrImage(): void {
    this.qrImageUrl.set(null);
  }

  async revokeToken(app: ApplicationRead): Promise<void> {
    const confirmed = await this.confirm.ask({
      message: this.interpolate(this.copy().confirmRevoke, { name: app.name }),
    });
    if (!confirmed) {
      return;
    }

    this.pending.set(true);
    this.error.set(null);
    this.banner.set(null);

    this.shell.revokeToken(
      app,
      () => {
        this.pending.set(false);
        this.banner.set(this.copy().alerts.revoked);
      },
      () => {
        this.pending.set(false);
        this.error.set({
          code: 'application_revoke_failed',
          detail: this.copy().errors.revoke,
        });
      },
    );
  }

  async deleteApp(app: ApplicationRead): Promise<void> {
    const shouldDelete = await this.confirm.ask({
      message: this.interpolate(this.copy().confirmDelete, { name: app.name }),
    });
    if (!shouldDelete) {
      return;
    }

    this.pending.set(true);
    this.error.set(null);
    this.banner.set(null);

    this.api
      .deleteApp(app.id)
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: () => {
          this.banner.set(this.interpolate(this.copy().alerts.deleted, { name: app.name }));
          this.shell.loadShell();
        },
        error: (error) => {
          this.error.set(coerceApiError(error));
        },
      });
  }

  trackById(_: number, app: ApplicationRead): number {
    return app.id;
  }

  appSeverity(app: ApplicationRead): 'success' | 'secondary' {
    return app.is_active ? 'success' : 'secondary';
  }

  appStatusLabel(app: ApplicationRead): string {
    return app.is_active ? this.copy().statuses.active : this.copy().statuses.inactive;
  }

  refreshApplications(): void {
    this.error.set(null);
    this.banner.set(null);
    this.shell.loadShell(this.shell.selectedAppId() ?? undefined);
  }

  openDetails(app: ApplicationRead): void {
    void this.router.navigate(['/dashboard/applications', app.id]);
  }

  private interpolate = interpolate;
}
