import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { finalize, forkJoin } from 'rxjs';

import {
  ApiErrorResponse,
  ApplicationQuietPeriod,
  ApplicationRead,
  DeviceRead,
  NotificationRead,
  NotificationStatus,
  PushTokenStatus,
} from '../../../../core/models/api.models';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { formatDateTimeFrBe, formatTimeLabel, weekdayShortLabel } from '../../../../core/utils/date-format.utils';
import { coerceApiError } from '../../../../core/utils/api-error.utils';
import { AppAlert } from '../../../../shared/app-alert/app-alert';
import { AppAlertTone } from '../../../../shared/app-alert/app-alert';
import { ApplicationFormFields } from '../../components/application-form-fields/application-form-fields';
import { ConsoleDetailHeader } from '../../components/console-detail-header/console-detail-header';
import { ConsoleDialogActions } from '../../components/console-dialog-actions/console-dialog-actions';
import { ConsoleFactItem } from '../../components/console-facts-table/console-fact-item';
import { ConsoleFactsTable } from '../../components/console-facts-table/console-facts-table';

@Component({
  selector: 'app-application-detail-page',
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    DatePipe,
    AppAlert,
    ApplicationFormFields,
    ConsoleDetailHeader,
    ConsoleDialogActions,
    ConsoleFactsTable,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TagModule,
    TableModule,
    TextareaModule,
    TooltipModule,
  ],
  templateUrl: './application-detail-page.html',
  styleUrl: './application-detail-page.scss',
})
export class ApplicationDetailPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(PushitApiService);
  private readonly consoleCopy = inject(ConsoleCopyService);
  readonly shell = inject(ConsoleShellService);
  readonly copy = computed(() => this.consoleCopy.current().applicationDetail);

  readonly application = signal<ApplicationRead | null>(null);
  readonly devices = signal<DeviceRead[]>([]);
  readonly notifications = signal<NotificationRead[]>([]);
  readonly futureNotifications = signal<NotificationRead[]>([]);
  readonly quietPeriods = signal<ApplicationQuietPeriod[]>([]);
  readonly loading = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly banner = signal<string | null>(null);
  readonly bannerTone = signal<AppAlertTone>('success');
  readonly editError = signal<ApiErrorResponse | null>(null);
  readonly saving = signal(false);
  readonly isEditModalOpen = signal(false);

  readonly applicationFactsComputed = computed(() => {
    const app = this.application();
    if (!app) {
      return [];
    }

    return [
      { label: this.copy().facts.id, value: String(app.id) },
      { label: this.copy().facts.name, value: app.name },
      { label: this.copy().facts.tokenPrefix, value: app.app_token_prefix, severity: 'info' as const },
      {
        label: this.copy().facts.status,
        value: app.is_active ? this.copy().statusLabels.active : this.copy().statusLabels.inactive,
        severity: this.appSeverity(app),
      },
      {
        label: this.copy().facts.lastUsed,
        value: app.last_used_at ? this.formatDateTime(app.last_used_at) : this.copy().statusLabels.never,
      },
      {
        label: this.copy().facts.revokedToken,
        value: app.revoked_at ? this.formatDateTime(app.revoked_at) : this.copy().statusLabels.no,
        severity: app.revoked_at ? 'warn' as const : 'success' as const,
      },
      { label: this.copy().facts.createdAt, value: this.formatDateTime(app.created_at) },
    ] as ConsoleFactItem[];
  });

  readonly editForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: [''],
  });

  ngOnInit(): void {
    const appId = Number(this.route.snapshot.paramMap.get('appId'));
    if (!Number.isFinite(appId) || appId <= 0) {
      this.error.set({
        code: 'invalid_application_id',
        detail: this.copy().errors.invalidId,
      });
      return;
    }

    const cachedApplication = this.shell.apps().find((app) => app.id === appId) ?? null;
    this.application.set(cachedApplication);
    this.loadApplication(appId);
  }

  appSeverity(app: ApplicationRead): 'success' | 'secondary' {
    return app.is_active ? 'success' : 'secondary';
  }

  deviceSeverity(status: PushTokenStatus): 'success' | 'warn' | 'danger' {
    switch (status) {
      case 'active':
        return 'success';
      case 'invalid':
        return 'warn';
      default:
        return 'danger';
    }
  }

  notificationSeverity(status: NotificationStatus): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'sent':
        return 'success';
      case 'queued':
      case 'processing':
        return 'info';
      case 'scheduled':
        return 'warn';
      case 'failed':
      case 'partial':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  quietPeriodTypeSeverity(type: ApplicationQuietPeriod['period_type']): 'info' | 'warn' {
    return type === 'ONCE' ? 'info' : 'warn';
  }

  quietPeriodScheduleLabel(quietPeriod: ApplicationQuietPeriod): string {
    if (quietPeriod.period_type === 'ONCE') {
      return `${this.formatDateTime(quietPeriod.start_at)} -> ${this.formatDateTime(quietPeriod.end_at)}`;
    }

    const days = quietPeriod.recurrence_days.map((day) => weekdayShortLabel(day)).join(', ');

    return `${days} | ${this.formatTime(quietPeriod.start_time)} -> ${this.formatTime(quietPeriod.end_time)}`;
  }

  applicationFacts(): ConsoleFactItem[] {
    return this.applicationFactsComputed();
  }

  async copyInboundEmail(address: string): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(address);
      } else {
        this.copyWithFallback(address);
      }

      this.bannerTone.set('success');
      this.banner.set(this.copy().inboundEmailCopied);
    } catch {
      this.bannerTone.set('danger');
      this.banner.set(this.copy().inboundEmailCopyFailed);
    }
  }

  isFutureNotification(notification: NotificationRead): boolean {
    return this.futureNotifications().some((item) => item.id === notification.id);
  }

  openEditModal(): void {
    const app = this.application();
    if (!app) {
      return;
    }

    this.editError.set(null);
    this.editForm.reset({
      name: app.name,
      description: app.description,
    });
    this.isEditModalOpen.set(true);
  }

  closeEditModal(): void {
    this.isEditModalOpen.set(false);
  }

  setEditModalVisible(visible: boolean): void {
    this.isEditModalOpen.set(visible);
    if (!visible) {
      this.editError.set(null);
    }
  }

  saveApplication(): void {
    const app = this.application();
    if (!app) {
      return;
    }

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.editError.set(null);

    this.api
      .updateApp(app.id, this.editForm.getRawValue())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updatedApp) => {
          this.application.set(updatedApp);
          this.closeEditModal();
          this.shell.loadShell(updatedApp.id);
        },
        error: (error) => {
          this.editError.set(coerceApiError(error));
        },
      });
  }

  private loadApplication(appId: number): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      application: this.api.getApp(appId),
      devices: this.api.listDevices(),
      notifications: this.api.listNotifications({
        application_id: appId,
        ordering: '-effective_scheduled_for',
      }),
      futureNotifications: this.api.listFutureNotifications({
        application_id: appId,
        ordering: '-effective_scheduled_for',
      }),
      quietPeriods: this.api.listAppQuietPeriods(appId),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ application, devices, notifications, futureNotifications, quietPeriods }) => {
          this.application.set(application);
          this.devices.set(devices.filter((device) => device.application_ids.includes(appId)));
          this.notifications.set(notifications);
          this.futureNotifications.set(futureNotifications);
          this.quietPeriods.set(quietPeriods);
        },
        error: (error) => {
          this.error.set(coerceApiError(error));
        },
      });
  }

  private formatDateTime(value: string | null): string {
    return formatDateTimeFrBe(value);
  }

  private formatTime(value: string | null): string {
    return formatTimeLabel(value);
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
}
