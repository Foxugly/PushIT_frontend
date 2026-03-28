import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import {
  ApiErrorResponse,
  DeviceRead,
  NotificationRead,
  NotificationStatus,
  PushTokenStatus,
} from '../../../../core/models/api.models';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { formatDateTimeFrBe } from '../../../../core/utils/date-format.utils';
import { coerceApiError } from '../../../../core/utils/api-error.utils';
import { AppAlert } from '../../../../shared/app-alert/app-alert';
import { ConsoleDetailHeader } from '../../components/console-detail-header/console-detail-header';
import { ConsoleDialogActions } from '../../components/console-dialog-actions/console-dialog-actions';
import { ConsoleFactItem } from '../../components/console-facts-table/console-fact-item';
import { ConsoleFactsTable } from '../../components/console-facts-table/console-facts-table';

@Component({
  selector: 'app-notification-detail-page',
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    DatePipe,
    AppAlert,
    ConsoleDetailHeader,
    ConsoleDialogActions,
    ConsoleFactsTable,
    ButtonModule,
    DatePickerModule,
    DialogModule,
    InputTextModule,
    TagModule,
    TableModule,
    TextareaModule,
    TooltipModule,
  ],
  templateUrl: './notification-detail-page.html',
  styleUrl: './notification-detail-page.scss',
})
export class NotificationDetailPage {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(PushitApiService);
  private readonly consoleCopy = inject(ConsoleCopyService);
  readonly copy = computed(() => this.consoleCopy.current().notificationDetail);

  readonly notification = signal<NotificationRead | null>(null);
  readonly targetedDevices = signal<DeviceRead[]>([]);
  readonly isFuture = signal(false);
  readonly loading = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly editError = signal<ApiErrorResponse | null>(null);
  readonly saving = signal(false);
  readonly isEditModalOpen = signal(false);

  readonly editForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    message: ['', [Validators.required]],
    scheduled_for: [null as Date | null],
  });

  ngOnInit(): void {
    const notificationId = Number(this.route.snapshot.paramMap.get('notificationId'));
    if (!Number.isFinite(notificationId) || notificationId <= 0) {
      this.error.set({
        code: 'invalid_notification_id',
        detail: this.copy().errors.invalidId,
      });
      return;
    }

    this.loadNotification(notificationId);
  }

  isShifted(notification: NotificationRead): boolean {
    return Boolean(
      notification.scheduled_for &&
        notification.effective_scheduled_for &&
        notification.scheduled_for !== notification.effective_scheduled_for,
    );
  }

  notificationSeverity(notification: NotificationRead): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    if (this.isShifted(notification)) {
      return 'warn';
    }

    switch (notification.status) {
      case 'sent':
        return 'success';
      case 'queued':
      case 'processing':
        return 'info';
      case 'failed':
      case 'partial':
        return 'danger';
      case 'scheduled':
        return 'warn';
      default:
        return 'secondary';
    }
  }

  statusBadgeSeverity(status: NotificationStatus): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
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
      case 'no_target':
        return 'contrast';
      default:
        return 'secondary';
    }
  }

  deviceSeverity(status: PushTokenStatus): 'success' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'active':
        return 'success';
      case 'invalid':
        return 'warn';
      case 'revoked':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  notificationFacts(notification: NotificationRead): ConsoleFactItem[] {
    return [
      { label: this.copy().facts.application, value: notification.application_name, severity: 'info' },
      {
        label: this.copy().facts.status,
        value: this.isShifted(notification)
          ? this.copy().labels.shifted
          : notification.status,
        severity: this.notificationSeverity(notification),
      },
      { label: this.copy().facts.future, value: this.isFuture() ? this.copy().labels.yes : this.copy().labels.no, severity: this.isFuture() ? 'warn' : 'secondary' },
      {
        label: this.copy().facts.sentAt,
        value: notification.sent_at ? this.formatDateTime(notification.sent_at) : this.copy().labels.notYet,
      },
      { label: this.copy().facts.createdAt, value: this.formatDateTime(notification.created_at) },
      {
        label: this.copy().facts.scheduledFor,
        value: notification.scheduled_for ? this.formatDateTime(notification.scheduled_for) : this.copy().labels.immediate,
      },
      {
        label: this.copy().facts.effective,
        value: notification.effective_scheduled_for
          ? this.formatDateTime(notification.effective_scheduled_for)
          : this.copy().labels.immediate,
      },
      {
        label: this.copy().facts.targetedDevices,
        value: String(notification.device_ids.length),
        severity: notification.device_ids.length ? 'contrast' : 'secondary',
      },
    ];
  }

  openEditModal(): void {
    const currentNotification = this.notification();
    if (!currentNotification || !this.isFuture()) {
      return;
    }

    this.editError.set(null);
    this.editForm.reset({
      title: currentNotification.title,
      message: currentNotification.message,
      scheduled_for: this.toDateValue(currentNotification.scheduled_for),
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

  saveNotification(): void {
    const currentNotification = this.notification();
    if (!currentNotification || !this.isFuture()) {
      return;
    }

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const rawValue = this.editForm.getRawValue();
    this.saving.set(true);
    this.editError.set(null);

    this.api
      .updateFutureNotification(currentNotification.id, {
        title: rawValue.title,
        message: rawValue.message,
        scheduled_for: this.toIsoOrNull(rawValue.scheduled_for),
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updatedNotification) => {
          this.notification.set(updatedNotification);
          this.closeEditModal();
        },
        error: (error) => {
          this.editError.set(coerceApiError(error));
        },
      });
  }

  private loadNotification(notificationId: number): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      notification: this.api.getNotification(notificationId),
      futureNotification: this.api.getFutureNotification(notificationId).pipe(catchError(() => of(null))),
      devices: this.api.listDevices(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ notification, futureNotification, devices }) => {
          const currentNotification = futureNotification ?? notification;
          this.notification.set(currentNotification);
          this.isFuture.set(Boolean(futureNotification));
          this.targetedDevices.set(
            devices.filter((device) => currentNotification.device_ids.includes(device.id)),
          );
        },
        error: (error) => {
          this.error.set(coerceApiError(error));
        },
      });
  }

  private toIsoOrNull(value: Date | null): string | null {
    if (!value) {
      return null;
    }

    return value.toISOString();
  }

  private toDateValue(value: string | null): Date | null {
    if (!value) {
      return null;
    }

    return new Date(value);
  }

  private formatDateTime(value: string | null): string {
    return formatDateTimeFrBe(value);
  }
}
