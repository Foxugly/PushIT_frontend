import { CommonModule, DatePipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';

import {
  ApiErrorResponse,
  DeviceRead,
  NotificationRead,
  NotificationStats,
  NotificationStatus,
} from '../../../../core/models/api.models';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { coerceApiError, errorFieldMessages } from '../../../../core/utils/api-error.utils';

@Component({
  selector: 'app-notifications-page',
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    DatePipe,
    ButtonModule,
    DialogModule,
    InputTextModule,
    MultiSelectModule,
    SelectModule,
    TableModule,
    TagModule,
    TextareaModule,
    TooltipModule,
  ],
  templateUrl: './notifications-page.html',
  styleUrl: './notifications-page.scss',
})
export class NotificationsPage {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(PushitApiService);
  private readonly router = inject(Router);
  readonly shell = inject(ConsoleShellService);

  readonly statusOptions: NotificationStatus[] = [
    'draft',
    'scheduled',
    'queued',
    'processing',
    'sent',
    'partial',
    'failed',
    'no_target',
  ];

  readonly notifications = signal<NotificationRead[]>([]);
  readonly futureNotifications = signal<NotificationRead[]>([]);
  readonly stats = signal<NotificationStats[]>([]);
  readonly devices = signal<DeviceRead[]>([]);
  readonly selectedNotificationId = signal<number | null>(null);
  readonly loading = signal(false);
  readonly pending = signal(false);
  readonly futurePending = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly futureError = signal<ApiErrorResponse | null>(null);
  readonly banner = signal<string | null>(null);
  readonly modalMode = signal<'create' | 'edit' | null>(null);
  readonly editingFutureNotificationId = signal<number | null>(null);

  readonly notificationForm = this.fb.nonNullable.group({
    application_id: ['', [Validators.required]],
    device_ids: [[] as number[], [Validators.required]],
    title: ['', [Validators.required, Validators.maxLength(255)]],
    message: ['', [Validators.required]],
    scheduled_for: [''],
  });

  readonly filtersForm = this.fb.nonNullable.group({
    application_id: [''],
    status: [''],
    effective_scheduled_from: [''],
    effective_scheduled_to: [''],
  });

  readonly futureEditForm = this.fb.nonNullable.group({
    id: [0],
    title: ['', [Validators.required, Validators.maxLength(255)]],
    message: ['', [Validators.required]],
    scheduled_for: [''],
  });

  constructor() {
    effect(() => {
      const selectedAppId = this.shell.selectedAppId();
      if (!this.notificationForm.controls.application_id.dirty) {
        this.notificationForm.patchValue(
          {
            application_id: selectedAppId ? String(selectedAppId) : '',
          },
          { emitEvent: false },
        );
      }
    });

    this.notificationForm.controls.application_id.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.syncSelectedDevices();
      });
  }

  ngOnInit(): void {
    this.refreshNotifications();
  }

  refreshNotifications(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      devices: this.api.listDevices(),
      notifications: this.api.listNotifications(this.buildNotificationFilters()),
      futureNotifications: this.api.listFutureNotifications(this.buildFutureNotificationFilters()),
      stats: this.api.listNotificationStats(),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ devices, notifications, futureNotifications, stats }) => {
          this.devices.set(devices);
          this.notifications.set(notifications);
          this.futureNotifications.set(futureNotifications);
          this.stats.set(stats);
          this.shell.setNotificationsCount(notifications.length + futureNotifications.length);
        },
        error: (error) => {
          this.error.set(coerceApiError(error));
        },
      });
  }

  openCreateModal(): void {
    this.error.set(null);
    this.notificationForm.reset({
      application_id: this.shell.selectedAppId() ? String(this.shell.selectedAppId()) : '',
      device_ids: [],
      title: '',
      message: '',
      scheduled_for: '',
    });
    this.syncSelectedDevices();
    this.modalMode.set('create');
  }

  openEditModal(notification: NotificationRead): void {
    this.selectedNotificationId.set(notification.id);
    this.futureError.set(null);
    this.editingFutureNotificationId.set(notification.id);
    this.futureEditForm.reset({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      scheduled_for: this.asDateTimeLocal(notification.scheduled_for),
    });
    this.modalMode.set('edit');
  }

  closeModal(): void {
    this.modalMode.set(null);
    this.editingFutureNotificationId.set(null);
  }

  setModalVisible(visible: boolean): void {
    if (!visible) {
      this.closeModal();
    }
  }

  createNotification(): void {
    if (this.notificationForm.invalid) {
      this.notificationForm.markAllAsTouched();
      return;
    }

    const rawValue = this.notificationForm.getRawValue();
    this.pending.set(true);
    this.error.set(null);
    this.banner.set(null);

    this.api
      .createNotification({
        application_id: Number(rawValue.application_id),
        device_ids: rawValue.device_ids,
        title: rawValue.title,
        message: rawValue.message,
        scheduled_for: this.toIsoOrNull(rawValue.scheduled_for),
      })
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: (notification) => {
          this.banner.set(
            notification.scheduled_for
              ? 'Notification planifiee creee.'
              : 'Notification immediate creee.',
          );
          this.closeModal();
          this.refreshNotifications();
        },
        error: (error) => {
          this.error.set(coerceApiError(error));
        },
      });
  }

  saveFutureNotification(): void {
    const notificationId = this.editingFutureNotificationId();
    if (!notificationId) {
      return;
    }

    if (this.futureEditForm.invalid) {
      this.futureEditForm.markAllAsTouched();
      return;
    }

    const rawValue = this.futureEditForm.getRawValue();
    this.futurePending.set(true);
    this.futureError.set(null);

    this.api
      .updateFutureNotification(notificationId, {
        title: rawValue.title,
        message: rawValue.message,
        scheduled_for: this.toIsoOrNull(rawValue.scheduled_for),
      })
      .pipe(finalize(() => this.futurePending.set(false)))
      .subscribe({
        next: () => {
          this.banner.set('Notification future mise a jour.');
          this.closeModal();
          this.refreshNotifications();
        },
        error: (error) => {
          this.futureError.set(coerceApiError(error));
        },
      });
  }

  deleteFutureNotification(notification: NotificationRead): void {
    const shouldDelete = window.confirm(`Supprimer la notification future "${notification.title}" ?`);
    if (!shouldDelete) {
      return;
    }

    this.futurePending.set(true);
    this.futureError.set(null);

    this.api
      .deleteFutureNotification(notification.id)
      .pipe(finalize(() => this.futurePending.set(false)))
      .subscribe({
        next: () => {
          this.banner.set(`Notification future "${notification.title}" supprimee.`);
          this.refreshNotifications();
        },
        error: (error) => {
          this.futureError.set(coerceApiError(error));
        },
      });
  }

  sendNotification(notification: NotificationRead): void {
    this.selectedNotificationId.set(notification.id);
    this.pending.set(true);
    this.error.set(null);
    this.banner.set(null);

    this.api
      .sendNotification(notification.id)
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: (response) => {
          this.banner.set(`Notification ${response.notification_id} placee dans la file ${response.task_id}.`);
          this.refreshNotifications();
        },
        error: (error) => {
          this.error.set(coerceApiError(error));
        },
      });
  }

  applyFilters(): void {
    this.refreshNotifications();
  }

  clearFilters(): void {
    this.filtersForm.reset({
      application_id: '',
      status: '',
      effective_scheduled_from: '',
      effective_scheduled_to: '',
    });
    this.refreshNotifications();
  }

  statusCount(status: NotificationStatus): number {
    return this.stats().find((item) => item.status === status)?.count ?? 0;
  }

  shiftedCount(): number {
    return this.notifications().filter((notification) => this.isShifted(notification)).length;
  }

  isShifted(notification: NotificationRead): boolean {
    return Boolean(
      notification.scheduled_for &&
        notification.effective_scheduled_for &&
        notification.scheduled_for !== notification.effective_scheduled_for,
    );
  }

  trackById(_: number, notification: NotificationRead): number {
    return notification.id;
  }

  appOptions() {
    return this.shell.apps().map((app) => ({ label: app.name, value: app.id }));
  }

  availableDeviceOptions() {
    return this.availableDevices().map((device) => ({
      label: `${device.device_name} (${device.platform})`,
      value: device.id,
    }));
  }

  statusOptionsSelect() {
    return this.statusOptions.map((status) => ({ label: status, value: status }));
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

  isFutureNotification(notification: NotificationRead): boolean {
    return this.futureNotifications().some((futureNotification) => futureNotification.id === notification.id);
  }

  openDetails(notification: NotificationRead): void {
    void this.router.navigate(['/dashboard/notifications', notification.id]);
  }

  fieldErrors(fieldName: string): string[] {
    return errorFieldMessages(this.error(), fieldName);
  }

  private buildNotificationFilters() {
    const rawValue = this.filtersForm.getRawValue();

    return {
      application_id: rawValue.application_id ? Number(rawValue.application_id) : null,
      status: rawValue.status ? (rawValue.status as NotificationStatus) : null,
      effective_scheduled_from: this.toIsoOrNull(rawValue.effective_scheduled_from),
      effective_scheduled_to: this.toIsoOrNull(rawValue.effective_scheduled_to),
      has_quiet_period_shift: null,
      ordering: '-effective_scheduled_for' as const,
    };
  }

  private buildFutureNotificationFilters() {
    const rawValue = this.filtersForm.getRawValue();

    return {
      effective_scheduled_from: this.toIsoOrNull(rawValue.effective_scheduled_from),
      effective_scheduled_to: this.toIsoOrNull(rawValue.effective_scheduled_to),
      has_quiet_period_shift: null,
      ordering: '-effective_scheduled_for' as const,
    };
  }

  private toIsoOrNull(value: string): string | null {
    if (!value) {
      return null;
    }

    return new Date(value).toISOString();
  }

  private asDateTimeLocal(value: string | null): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    const pad = (part: number) => String(part).padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}`;
  }

  private availableDevices(): DeviceRead[] {
    const applicationId = Number(this.notificationForm.controls.application_id.value);
    if (!applicationId) {
      return [];
    }

    return this.devices().filter(
      (device) =>
        device.push_token_status === 'active' && device.application_ids.includes(applicationId),
    );
  }

  private syncSelectedDevices(): void {
    const allowedDeviceIds = new Set(this.availableDevices().map((device) => device.id));
    const currentSelection = this.notificationForm.controls.device_ids.value;
    const nextSelection = currentSelection.filter((deviceId) => allowedDeviceIds.has(deviceId));

    if (nextSelection.length !== currentSelection.length) {
      this.notificationForm.patchValue({ device_ids: nextSelection }, { emitEvent: false });
    }
  }
}
