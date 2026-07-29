import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { finalize } from 'rxjs';

import { AdminCheck, AdminCheckStatus, AdminStatus, ApiErrorResponse } from '../../../../core/models/api.models';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { SettingsService } from '../../../../core/services/settings.service';
import { coerceApiError } from '../../../../core/utils/api-error.utils';
import { ApiErrorMessagePipe } from '../../../../core/pipes/api-error-message.pipe';
import { PageHeader } from '../../../../shared/page-header/page-header';

type CheckKey = 'database' | 'celery_broker' | 'celery_workers' | 'exchange';

interface CheckRow {
  key: CheckKey;
  label: string;
  status?: AdminCheckStatus;
  detail: string;
  severity: 'success' | 'warn' | 'danger' | 'secondary';
  statusLabel: string;
}

interface NotificationMetric {
  status: string;
  count: number;
}

@Component({
  selector: 'app-admin-status-page',
  imports: [CommonModule, RouterLink, ApiErrorMessagePipe, PageHeader, ButtonModule, TableModule, TagModule],
  templateUrl: './admin-status-page.html',
  styleUrl: './admin-status-page.scss',
})
export class AdminStatusPage implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(PushitApiService);
  private readonly consoleCopy = inject(ConsoleCopyService);
  private readonly settings = inject(SettingsService);
  readonly copy = computed(() => this.consoleCopy.current().adminStatus);

  private readonly checkOrder: CheckKey[] = ['database', 'celery_broker', 'celery_workers', 'exchange'];

  readonly status = signal<AdminStatus | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);

  readonly overallSeverity = computed<'success' | 'warn' | 'secondary'>(() => {
    switch (this.status()?.status) {
      case 'ok':
        return 'success';
      case 'degraded':
        return 'warn';
      default:
        return 'secondary';
    }
  });

  readonly overallLabel = computed(() => {
    const labels = this.copy().overallStatus;
    switch (this.status()?.status) {
      case 'ok':
        return labels.ok;
      case 'degraded':
        return labels.degraded;
      default:
        return labels.unknown;
    }
  });

  readonly checkRows = computed<CheckRow[]>(() => {
    const checks = this.status()?.checks ?? {};
    const labels = this.copy().checks;
    return this.checkOrder.map((key) => {
      const check: AdminCheck = checks[key] ?? {};
      return {
        key,
        label: labels[key],
        status: check.status,
        detail: check.detail ?? this.copy().noDetail,
        severity: this.checkSeverity(check.status),
        statusLabel: this.checkStatusLabel(check.status),
      };
    });
  });

  readonly notificationMetrics = computed<NotificationMetric[]>(() => {
    const notifications = this.status()?.metrics?.notifications ?? {};
    return Object.entries(notifications).map(([status, count]) => ({ status, count }));
  });

  readonly processingStuck = computed(() => this.status()?.metrics?.processing_stuck ?? 0);

  /**
   * The Django admin lives at the backend origin, not under the API prefix.
   * Derive it from the configured API base URL by stripping a trailing
   * `/api/v1` (and any trailing slash) → backend origin, then append `/admin/`.
   * The dev default is the relative `/api/v1`, which collapses to `/admin/`.
   */
  readonly djangoAdminUrl = computed(() => {
    const base = this.settings.apiBaseUrl().replace(/\/+$/, '');
    const origin = base.replace(/\/api\/v1$/, '');
    return `${origin}/admin/`;
  });

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getAdminStatus()
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false)))
      .subscribe({
        next: (status) => this.status.set(status),
        error: (error) => this.error.set(coerceApiError(error)),
      });
  }

  private checkSeverity(status?: AdminCheckStatus): 'success' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'ok':
        return 'success';
      case 'degraded':
        return 'warn';
      case 'error':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  private checkStatusLabel(status?: AdminCheckStatus): string {
    const labels = this.copy().checkStatus;
    switch (status) {
      case 'ok':
        return labels.ok;
      case 'degraded':
        return labels.degraded;
      case 'error':
        return labels.error;
      default:
        return labels.unknown;
    }
  }
}
