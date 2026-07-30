import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { finalize, switchMap } from 'rxjs';

import { ApplicationRead } from '../../../../core/models/api.models';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { AppAlert } from '../../../../shared/app-alert/app-alert';
import { AppConfirmService } from '../../../../shared/app-confirm-dialog/app-confirm.service';
import { interpolate } from '../../../../core/utils/string.utils';

/**
 * The enrolment block: the code an application hands out, its QR, and the
 * rotation.
 *
 * The code is shown permanently and in clear — that is the point. It is not a
 * secret: it goes to every recipient. Hiding it behind a reveal would teach the
 * opposite, and the whole split exists because one string used to be both the
 * thing you distribute and the thing that authorises sending.
 *
 * Rotating closes the door to newcomers and **evicts nobody** — the warning
 * says so, because the moment you rotate is usually the moment you want
 * somebody out.
 */
@Component({
  selector: 'app-enrolment-panel',
  imports: [AppAlert, ButtonModule, TooltipModule],
  templateUrl: './enrolment-panel.html',
  styleUrl: './enrolment-panel.scss',
})
export class EnrolmentPanel {
  private readonly api = inject(PushitApiService);
  private readonly consoleCopy = inject(ConsoleCopyService);
  private readonly confirm = inject(AppConfirmService);
  private readonly destroyRef = inject(DestroyRef);

  readonly app = input.required<ApplicationRead>();
  /** Emits the new code after a rotation so the page can refresh its state. */
  readonly rotated = output<string>();

  readonly copy = computed(() => this.consoleCopy.current().enrolment);

  readonly code = signal<string | null>(null);
  readonly rotating = signal(false);
  readonly qrImageUrl = signal<string | null>(null);
  readonly qrLoading = signal(false);
  readonly qrError = signal<string | null>(null);
  readonly banner = signal<string | null>(null);

  /** The code currently displayed: the rotated one if we just drew it. */
  readonly currentCode = computed(() => this.code() ?? this.app().enrolment_code);

  constructor() {
    // (Re)fetch the QR whenever the application — or its code — changes.
    toObservable(computed(() => ({ appId: this.app().id, code: this.currentCode() })))
      .pipe(
        switchMap(({ appId }) => {
          this.qrImageUrl.set(null);
          this.qrError.set(null);
          this.qrLoading.set(true);
          return this.api.getEnrolmentQrCode(appId).pipe(finalize(() => this.qrLoading.set(false)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (blob) => {
          // data: URL rather than blob: — the enforced CSP allows `img-src data:`
          // but not `blob:`, which would be silently blocked.
          const reader = new FileReader();
          reader.onloadend = () => this.qrImageUrl.set(reader.result as string);
          reader.onerror = () => this.qrError.set(this.copy().qrError);
          reader.readAsDataURL(blob);
        },
        error: () => this.qrError.set(this.copy().qrError),
      });
  }

  async copyCode(): Promise<void> {
    const code = this.currentCode();
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        this.copyWithFallback(code);
      }
      this.banner.set(this.copy().copied);
    } catch {
      this.banner.set(this.copy().copyFailed);
    }
  }

  async rotate(): Promise<void> {
    const app = this.app();
    const confirmed = await this.confirm.ask({
      message: interpolate(this.copy().rotateConfirm, { name: app.name }),
    });
    if (!confirmed) {
      return;
    }

    this.rotating.set(true);
    this.api
      .rotateEnrolmentCode(app.id)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.rotating.set(false)))
      .subscribe({
        next: (result) => {
          this.code.set(result.enrolment_code);
          this.banner.set(this.copy().rotated);
          this.rotated.emit(result.enrolment_code);
        },
        error: () => this.banner.set(this.copy().rotateError),
      });
  }

  /** Download the QR as `<ts>_qrcode_<app>.png`. */
  downloadQr(): void {
    const url = this.qrImageUrl();
    if (!url) {
      return;
    }
    this.triggerDownload(url, `${this.fileStamp()}_qrcode_${this.appSlug(this.app().name)}.png`);
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

  private appSlug(name: string): string {
    return name.trim().replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '') || 'app';
  }
}
