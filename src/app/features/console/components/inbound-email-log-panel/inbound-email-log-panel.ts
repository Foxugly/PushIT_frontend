import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { finalize } from 'rxjs';

import {
  ApiErrorResponse,
  InboundEmailLog,
  InboundEmailLogStatus,
} from '../../../../core/models/api.models';
import { ApiErrorMessagePipe } from '../../../../core/pipes/api-error-message.pipe';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { StatusLabelService } from '../../../../core/i18n/status-labels';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { coerceApiError } from '../../../../core/utils/api-error.utils';
import { formatDateTimeFrBe } from '../../../../core/utils/date-format.utils';
import { AppAlert } from '../../../../shared/app-alert/app-alert';

type TagSeverity = 'success' | 'secondary' | 'danger' | 'warn' | 'info';

const STATUS_SEVERITY: Record<InboundEmailLogStatus, TagSeverity> = {
  created: 'success',
  existing: 'secondary',
  rejected: 'danger',
  conflict: 'warn',
  error: 'danger',
};

/** `"<code>: <text>"` — the stable reason code the server puts first on a refusal. */
const REASON_CODE_RE = /^([a-z_]+):\s*/;

/**
 * Readable reason for a journal row: a known refusal code (`sender_not_allowed`,
 * `sender_blocked`, `dmarc_failed`) maps to `reasons[code]`; anything else is
 * shown as the server wrote it. Empty for an accepted mail.
 */
export function inboundLogReason(errorMessage: string, reasons: Record<string, string>): string {
  const message = (errorMessage ?? '').trim();
  const code = REASON_CODE_RE.exec(message)?.[1];
  if (code && Object.prototype.hasOwnProperty.call(reasons, code)) {
    return reasons[code];
  }
  return message;
}

/**
 * « Mails reçus » — the application's inbound e-mail journal (last 50, newest
 * first): what each mail sent to the alias became, and why a refused one was
 * refused. Loaded the first time `active` turns true (the Envoi tab is shown),
 * then only on « Actualiser ».
 */
@Component({
  selector: 'app-inbound-email-log-panel',
  imports: [AppAlert, ApiErrorMessagePipe, ButtonModule, RouterLink, TableModule, TagModule],
  templateUrl: './inbound-email-log-panel.html',
  styleUrl: './inbound-email-log-panel.scss',
})
export class InboundEmailLogPanel {
  private readonly api = inject(PushitApiService);
  private readonly consoleCopy = inject(ConsoleCopyService);
  private readonly statusLabels = inject(StatusLabelService);
  private readonly destroyRef = inject(DestroyRef);

  readonly appId = input.required<number>();
  /** True while the hosting tab is visible: the first true triggers the load. */
  readonly active = input(true);

  readonly copy = computed(() => this.consoleCopy.current().inboundEmailLog);

  readonly logs = signal<InboundEmailLog[]>([]);
  readonly loading = signal(false);
  /** Set once a load succeeded, to tell « empty » from « not loaded yet ». */
  readonly loaded = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  private requested = false;

  constructor() {
    effect(() => {
      if (this.active() && !this.requested) {
        untracked(() => this.load());
      }
    });
  }

  load(): void {
    this.requested = true;
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getInboundEmailLogs(this.appId())
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false)))
      .subscribe({
        next: (logs) => {
          this.logs.set(logs);
          this.loaded.set(true);
        },
        error: (err) => this.error.set(coerceApiError(err)),
      });
  }

  statusLabel(status: InboundEmailLogStatus): string {
    return this.statusLabels.label('inboundEmail', status);
  }

  statusSeverity(status: InboundEmailLogStatus): TagSeverity {
    return STATUS_SEVERITY[status] ?? 'info';
  }

  reason(log: InboundEmailLog): string {
    return inboundLogReason(log.error_message, this.copy().reasons);
  }

  formatDateTime(value: string): string {
    return formatDateTimeFrBe(value);
  }
}
