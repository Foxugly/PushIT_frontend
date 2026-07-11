import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, forkJoin, startWith } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import {
  ApiErrorResponse,
  DeviceRead,
  NotificationRead,
  NotificationStats,
  NotificationStatus,
} from '../../../../core/models/api.models';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { PageHeader } from '../../../../shared/page-header/page-header';
import { coerceApiError, errorFieldMessages } from '../../../../core/utils/api-error.utils';
import { interpolate } from '../../../../core/utils/string.utils';
import { AppAlert } from '../../../../shared/app-alert/app-alert';
import { ApiErrorMessagePipe } from '../../../../core/pipes/api-error-message.pipe';
import { AppConfirmService } from '../../../../shared/app-confirm-dialog/app-confirm.service';
import { EmojiPickerPopover } from '../../../../shared/emoji-picker-popover/emoji-picker-popover';
import { ConsoleDialogActions } from '../../components/console-dialog-actions/console-dialog-actions';

@Component({
  selector: 'app-notifications-page',
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    DatePipe,
    AppAlert, ApiErrorMessagePipe,
    ConsoleDialogActions,
    EmojiPickerPopover,
    ButtonModule,
    PageHeader,
    DatePickerModule,
    DialogModule,
    InputTextModule,
    MultiSelectModule,
    SelectModule,
    TableModule,
    TagModule,
    TextareaModule,
    ToastModule,
    TooltipModule,
  ],
  providers: [MessageService],
  templateUrl: './notifications-page.html',
  styleUrl: './notifications-page.scss',
})
export class NotificationsPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(PushitApiService);
  private readonly consoleCopy = inject(ConsoleCopyService);
  private readonly confirm = inject(AppConfirmService);
  private readonly messages = inject(MessageService);
  private readonly router = inject(Router);
  readonly shell = inject(ConsoleShellService);
  readonly copy = computed(() => this.consoleCopy.current().notifications);

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

  // notifications() holds the CURRENT history page (server-paginated); future
  // notifications are bounded so they stay fully loaded.
  readonly notifications = signal<NotificationRead[]>([]);
  readonly notificationsTotal = signal(0);
  readonly futureNotifications = signal<NotificationRead[]>([]);
  readonly stats = signal<NotificationStats[]>([]);
  readonly devices = signal<DeviceRead[]>([]);
  readonly selectedNotificationId = signal<number | null>(null);
  readonly loading = signal(false);
  readonly historyLoading = signal(false);
  readonly notifRows = 25;
  readonly notifFirst = signal(0);
  readonly pending = signal(false);
  readonly futurePending = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly futureError = signal<ApiErrorResponse | null>(null);
  readonly banner = signal<string | null>(null);
  readonly modalMode = signal<'create' | 'edit' | null>(null);
  readonly editingFutureNotificationId = signal<number | null>(null);
  readonly compactDatepickerPanelStyle = { minWidth: '20rem', width: '20rem' };

  readonly notificationForm = this.fb.nonNullable.group({
    application_id: ['', [Validators.required]],
    device_ids: [[] as number[], [Validators.required]],
    title: ['', [Validators.required, Validators.maxLength(255)]],
    message: ['', [Validators.required]],
    scheduled_for: [null as Date | null],
  });

  readonly filtersForm = this.fb.nonNullable.group({
    application_id: [''],
    device_id: [''],
    status: [''],
    effective_scheduled_from: [null as Date | null],
    effective_scheduled_to: [null as Date | null],
  });

  readonly deviceFilterOptions = computed(() =>
    this.devices().map((device) => ({ label: `${device.device_name} (${device.platform})`, value: device.id })),
  );

  // Mirror the create-form's selected application as a signal so device options
  // can be a memoized computed (matching deviceFilterOptions / appOptions) rather
  // than a method re-evaluated every change-detection cycle.
  private readonly createFormApplicationId = toSignal(
    this.notificationForm.controls.application_id.valueChanges.pipe(
      startWith(this.notificationForm.controls.application_id.value),
    ),
    { initialValue: this.notificationForm.controls.application_id.value },
  );

  // Active devices linked to the currently selected create-form application.
  readonly availableDeviceOptions = computed(() => {
    const applicationId = Number(this.createFormApplicationId());
    if (!applicationId) {
      return [];
    }
    return this.devices()
      .filter(
        (device) =>
          device.push_token_status === 'active' &&
          device.application_ids.includes(applicationId),
      )
      .map((device) => ({
        label: `${device.device_name} (${device.platform})`,
        value: device.id,
      }));
  });

  // O(1) future-notification membership test for the row template: a single
  // Set rebuilt only when the future list changes, instead of an O(F) scan per
  // row per change-detection cycle.
  readonly futureNotificationIds = computed(
    () => new Set(this.futureNotifications().map((notification) => notification.id)),
  );

  readonly futureEditForm = this.fb.nonNullable.group({
    id: [0],
    title: ['', [Validators.required, Validators.maxLength(255)]],
    message: ['', [Validators.required]],
    scheduled_for: [null as Date | null],
  });

  constructor() {
    // Keep the nav count in sync regardless of which load (history page / future
    // list) resolves first.
    effect(() => {
      this.shell.setNotificationsCount(this.notificationsTotal() + this.futureNotifications().length);
    });

    // Sync the create-form's application to the shell selection — an explicit
    // subscription (toObservable) rather than an effect, so the side-effect on
    // the form is easy to follow.
    toObservable(this.shell.selectedAppId)
      .pipe(takeUntilDestroyed())
      .subscribe((selectedAppId) => {
        if (!this.notificationForm.controls.application_id.dirty) {
          this.notificationForm.patchValue(
            { application_id: selectedAppId ? String(selectedAppId) : '' },
            { emitEvent: false },
          );
        }
      });

    this.notificationForm.controls.application_id.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((applicationId) => {
        this.syncSelectedDevices();

        const deviceIdsControl = this.notificationForm.controls.device_ids;
        if (applicationId) {
          if (deviceIdsControl.disabled) {
            deviceIdsControl.enable({ emitEvent: false });
          }
        } else {
          if (deviceIdsControl.enabled) {
            deviceIdsControl.disable({ emitEvent: false });
          }
        }
      });
  }

  ngOnInit(): void {
    this.refreshNotifications();
  }

  /**
   * Reloads the page-level data: devices, the (bounded) future list and stats.
   * The history list is server-paginated and loaded separately by the lazy
   * table via [loadHistory]; hiding the table while this runs remounts it, so
   * onLazyLoad re-fires and refreshes the history page too.
   */
  refreshNotifications(): void {
    this.loadAux();
    this.reloadHistory();
  }

  /** Page-level data that isn't server-paginated: devices, the bounded future
   * list, and per-status stats. */
  private loadAux(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      devices: this.api.listDevices(),
      futureNotifications: this.api.listFutureNotifications(this.buildFutureNotificationFilters()),
      stats: this.api.listNotificationStats(this.buildStatsFilters()),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ devices, futureNotifications, stats }) => {
          this.devices.set(devices);
          this.futureNotifications.set(futureNotifications);
          this.stats.set(stats);
        },
        error: (error) => {
          this.error.set(coerceApiError(error));
        },
      });
  }

  /** Reset the history table to its first page and reload (filter/refresh). */
  reloadHistory(): void {
    this.notifFirst.set(0);
    this.loadHistory();
  }

  /** Load one page of history from the server (the unbounded list). Driven by
   * reloadHistory() on init/filter and by the table's onLazyLoad on paging. */
  loadHistory(event?: TableLazyLoadEvent): void {
    const rows = event?.rows ?? this.notifRows;
    if (event && event.first != null) {
      this.notifFirst.set(event.first);
    }
    const page = Math.floor(this.notifFirst() / rows) + 1;
    this.historyLoading.set(true);
    this.api
      .listNotificationsPage(this.buildNotificationFilters(), page, rows)
      .pipe(finalize(() => this.historyLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.notifications.set(response.results);
          this.notificationsTotal.set(response.count);
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
      scheduled_for: null,
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
      scheduled_for: this.toDateValue(notification.scheduled_for),
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

  /** Toast shown when a submit is blocked by missing/invalid required fields. */
  private warnInvalidForm(): void {
    this.messages.add({
      severity: 'warn',
      summary: this.copy().validation.title,
      detail: this.copy().validation.detail,
    });
  }

  createNotification(): void {
    if (this.notificationForm.invalid) {
      this.notificationForm.markAllAsTouched();
      this.warnInvalidForm();
      return;
    }

    const rawValue = this.notificationForm.getRawValue();
    const scheduledFor = this.toIsoOrNull(rawValue.scheduled_for);
    const base = {
      application_id: Number(rawValue.application_id),
      device_ids: rawValue.device_ids,
      title: rawValue.title,
      message: rawValue.message,
    };
    this.pending.set(true);
    this.error.set(null);
    this.banner.set(null);

    // Immediate → one call that creates AND sends; scheduled → create (the
    // scheduler dispatches at the due date, and it stays editable as a future).
    const request$ = scheduledFor
      ? this.api.createNotification({ ...base, scheduled_for: scheduledFor })
      : this.api.sendNotificationNow(base);

    request$.pipe(finalize(() => this.pending.set(false))).subscribe({
      next: () => {
        this.banner.set(
          scheduledFor ? this.copy().alerts.createdScheduled : this.copy().alerts.sentImmediate,
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
      this.warnInvalidForm();
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
          this.banner.set(this.copy().alerts.updated);
          this.closeModal();
          this.refreshNotifications();
        },
        error: (error) => {
          this.futureError.set(coerceApiError(error));
        },
      });
  }

  async deleteFutureNotification(notification: NotificationRead): Promise<void> {
    const shouldDelete = await this.confirm.ask({
      message: this.interpolate(this.copy().confirmDelete, { title: notification.title }),
    });
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
          this.banner.set(this.interpolate(this.copy().alerts.deleted, { title: notification.title }));
          this.refreshNotifications();
        },
        error: (error) => {
          this.futureError.set(coerceApiError(error));
        },
      });
  }

  // A draft can be sent; a failed/partial one can be re-sent (the backend only
  // re-dispatches the deliveries that didn't succeed — no double-notification).
  canSend(notification: NotificationRead): boolean {
    return (
      (notification.status === 'draft' && !notification.scheduled_for) ||
      this.isResend(notification)
    );
  }

  isResend(notification: NotificationRead): boolean {
    return notification.status === 'failed' || notification.status === 'partial';
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
          this.banner.set(this.interpolate(this.copy().alerts.queued, { notificationId: response.notification_id, taskId: response.task_id }));
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
      device_id: '',
      status: '',
      effective_scheduled_from: null,
      effective_scheduled_to: null,
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

  readonly appOptions = computed(() =>
    this.shell.apps().map((app) => ({ label: app.name, value: app.id })),
  );

  readonly statusOptionsSelect = computed(() =>
    this.statusOptions.map((status) => ({ label: this.copy().statusLabels[status], value: status })),
  );

  notificationSeverity(
    notification: NotificationRead,
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
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

  statusBadgeSeverity(
    status: NotificationStatus,
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
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
    return this.futureNotificationIds().has(notification.id);
  }

  openDetails(notification: NotificationRead): void {
    void this.router.navigate(['/dashboard/notifications', notification.id]);
  }

  notificationStatusLabel(notification: NotificationRead): string {
    return this.isShifted(notification)
      ? this.copy().statusLabels.shifted
      : this.copy().statusLabels[notification.status];
  }

  notificationTypeLabel(notification: NotificationRead): string {
    return this.isFutureNotification(notification)
      ? this.copy().typeLabels.future
      : this.copy().typeLabels.history;
  }

  appendEmojiToCreateMessage(emoji: string): void {
    const control = this.notificationForm.controls.message;
    control.setValue(this.appendEmoji(control.value, emoji));
    control.markAsDirty();
    control.markAsTouched();
  }

  appendEmojiToFutureMessage(emoji: string): void {
    const control = this.futureEditForm.controls.message;
    control.setValue(this.appendEmoji(control.value, emoji));
    control.markAsDirty();
    control.markAsTouched();
  }

  fieldErrors(fieldName: string): string[] {
    return errorFieldMessages(this.error(), fieldName);
  }

  private buildNotificationFilters() {
    const rawValue = this.filtersForm.getRawValue();

    return {
      application_id: rawValue.application_id ? Number(rawValue.application_id) : null,
      device_id: rawValue.device_id ? Number(rawValue.device_id) : null,
      status: rawValue.status ? (rawValue.status as NotificationStatus) : null,
      effective_scheduled_from: this.toIsoOrNull(rawValue.effective_scheduled_from),
      effective_scheduled_to: this.toIsoOrNull(rawValue.effective_scheduled_to),
      has_quiet_period_shift: null,
      ordering: '-effective_scheduled_for' as const,
    };
  }

  private buildStatsFilters() {
    const rawValue = this.filtersForm.getRawValue();
    return {
      application_id: rawValue.application_id ? Number(rawValue.application_id) : null,
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

  private availableDevices(): DeviceRead[] {
    const applicationId = Number(this.notificationForm.controls.application_id.value);
    if (!applicationId) {
      return [];
    }

    return this.devices().filter(
      (device) =>
        device.push_token_status === 'active' &&
        device.application_ids.includes(applicationId),
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

  private appendEmoji(currentValue: string, emoji: string): string {
    if (!currentValue.trim()) {
      return emoji;
    }

    return `${currentValue} ${emoji}`;
  }

  private interpolate = interpolate;
}
