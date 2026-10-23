import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { debounceTime, finalize, forkJoin, startWith } from 'rxjs';
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
import { StatusLabelService } from '../../../../core/i18n/status-labels';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { PageHeader } from '../../../../shared/page-header/page-header';
import { coerceApiError, errorFieldMessages } from '../../../../core/utils/api-error.utils';
import { isBillingRefusal } from '../../../../core/utils/api-error-copy';
import { interpolate } from '../../../../core/utils/string.utils';
import { AppAlert } from '../../../../shared/app-alert/app-alert';
import { ApiErrorMessagePipe } from '../../../../core/pipes/api-error-message.pipe';
import { AppConfirmService } from '../../../../shared/app-confirm-dialog/app-confirm.service';
import { EmojiPickerPopover } from '../../../../shared/emoji-picker-popover/emoji-picker-popover';
import { ConsoleDialogActions } from '../../components/console-dialog-actions/console-dialog-actions';
import { EmptyState } from '../../../../shared/empty-state/empty-state';

/** The list filters, as held by `filtersForm` (ids are strings, like the select options). */
export interface NotificationListFilters {
  application_id: string;
  device_id: string;
  status: NotificationStatus | '';
  effective_scheduled_from: Date | null;
  effective_scheduled_to: Date | null;
}

const NO_FILTERS: NotificationListFilters = {
  application_id: '',
  device_id: '',
  status: '',
  effective_scheduled_from: null,
  effective_scheduled_to: null,
};

/** Debounce of the live filters (selects / date pickers); status chips apply at once. */
export const FILTER_DEBOUNCE_MS = 300;

const STATUSES: readonly NotificationStatus[] = [
  'draft',
  'scheduled',
  'queued',
  'processing',
  'sent',
  'partial',
  'failed',
  'no_target',
];

/**
 * Query params carrying the filters (`?application=&device=&status=&from=&to=`),
 * so a filtered list can be linked to (the dashboard's « Échecs récents ») and
 * survives a reload. `app`/`create` stay reserved for the create deep link.
 */
export function filtersToQueryParams(filters: NotificationListFilters): Record<string, string | null> {
  return {
    application: filters.application_id || null,
    device: filters.device_id || null,
    status: filters.status || null,
    from: filters.effective_scheduled_from?.toISOString() ?? null,
    to: filters.effective_scheduled_to?.toISOString() ?? null,
  };
}

/** Inverse of filtersToQueryParams; anything malformed is ignored, not trusted. */
export function filtersFromQueryParams(params: ParamMap): NotificationListFilters {
  const id = (value: string | null) => (value && /^\d+$/.test(value) ? value : '');
  const date = (value: string | null) => {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };
  const status = params.get('status');
  return {
    application_id: id(params.get('application')),
    device_id: id(params.get('device')),
    status: STATUSES.includes(status as NotificationStatus) ? (status as NotificationStatus) : '',
    effective_scheduled_from: date(params.get('from')),
    effective_scheduled_to: date(params.get('to')),
  };
}

function filtersKey(filters: NotificationListFilters): string {
  return JSON.stringify(filtersToQueryParams(filters));
}

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
    EmptyState,
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
    TooltipModule,
  ],
  templateUrl: './notifications-page.html',
  styleUrl: './notifications-page.scss',
})
export class NotificationsPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(PushitApiService);
  private readonly consoleCopy = inject(ConsoleCopyService);
  private readonly statusLabels = inject(StatusLabelService);
  private readonly confirm = inject(AppConfirmService);
  private readonly messages = inject(MessageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly shell = inject(ConsoleShellService);
  readonly copy = computed(() => this.consoleCopy.current().notifications);

  readonly statusOptions: readonly NotificationStatus[] = STATUSES;

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
  /** False until the first history page answered: no empty state before that. */
  readonly historyLoaded = signal(false);
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
    status: ['' as NotificationStatus | ''],
    effective_scheduled_from: [null as Date | null],
    effective_scheduled_to: [null as Date | null],
  });

  /** The filters the lists currently reflect (the form may be ahead while debouncing). */
  readonly appliedFilters = signal<NotificationListFilters>(NO_FILTERS);
  readonly hasActiveFilters = computed(() => filtersKey(this.appliedFilters()) !== filtersKey(NO_FILTERS));

  // String values, like application_id: the id comes back from the URL as text.
  readonly deviceFilterOptions = computed(() =>
    this.devices().map((device) => ({
      label: `${device.device_name} (${this.statusLabels.label('platform', device.platform)})`,
      value: String(device.id),
    })),
  );

  /**
   * The future list is bounded and its endpoint only filters on dates, so the
   * application / device / status filters are applied here.
   */
  readonly visibleFutureNotifications = computed(() => {
    const filters = this.appliedFilters();
    return this.futureNotifications().filter(
      (notification) =>
        (!filters.application_id || notification.application_id === Number(filters.application_id)) &&
        (!filters.device_id || notification.device_ids.includes(Number(filters.device_id))) &&
        (!filters.status || notification.status === filters.status),
    );
  });

  /** Nothing to show at all (once loaded): the page renders an empty state instead of tables. */
  readonly isEmpty = computed(
    () =>
      this.historyLoaded() &&
      !this.historyLoading() &&
      !this.loading() &&
      this.notificationsTotal() === 0 &&
      this.visibleFutureNotifications().length === 0,
  );

  /** One chip per status that has notifications (plus the active one), each a filter toggle. */
  readonly statusChips = computed(() => {
    const active = this.appliedFilters().status;
    return this.statusOptions
      .map((status) => ({ status, label: this.statusLabels.label('notification', status), count: this.statusCount(status) }))
      .filter((chip) => chip.count > 0 || chip.status === active);
  });

  readonly statsTotal = computed(() => this.stats().reduce((total, item) => total + item.count, 0));

  // Mirror the create-form's selected application as a signal so device options
  // can be a memoized computed (matching deviceFilterOptions / appOptions) rather
  // than a method re-evaluated every change-detection cycle.
  private readonly createFormApplicationId = toSignal(
    this.notificationForm.controls.application_id.valueChanges.pipe(
      startWith(this.notificationForm.controls.application_id.value),
    ),
    { initialValue: this.notificationForm.controls.application_id.value },
  );

  // The server refuses (400) a notification on a deactivated application: say so
  // up front instead of letting the user fill the form for nothing.
  readonly selectedAppInactive = computed(() => {
    const applicationId = Number(this.createFormApplicationId());
    if (!applicationId) {
      return false;
    }
    const app = this.shell.apps().find((candidate) => candidate.id === applicationId);
    return app ? !app.is_active : false;
  });

  /** A billing 402 (no subscription / quota reached): offer the billing page. */
  readonly billingRefused = computed(() => isBillingRefusal(this.error()));

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
        label: `${device.device_name} (${this.statusLabels.label('platform', device.platform)})`,
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
        // Untouched selection: follow the app (all its devices); a selection
        // the user edited is only pruned of devices the new app cannot reach.
        if (this.notificationForm.controls.device_ids.dirty) {
          this.syncSelectedDevices();
        } else {
          this.preselectAllDevices();
        }

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
    // The URL holds the filters: the first emission (synchronous) sets them and
    // loads the lists. The component is also reused when a link changes only the
    // query (e.g. the dashboard's « Échecs récents » while this page is open), so
    // later emissions are followed too. Our own URL writes carry the applied
    // filters: they compare equal and are no-ops.
    let initial = true;
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const next = filtersFromQueryParams(params);
      if (!initial && filtersKey(next) === filtersKey(this.appliedFilters())) {
        return;
      }
      initial = false;
      this.filtersForm.setValue(next, { emitEvent: false });
      this.appliedFilters.set(next);
      this.refreshNotifications();
    });
    this.openCreateFromQuery();

    // Live filters: selects and date pickers apply on their own, debounced.
    this.filtersForm.valueChanges
      .pipe(debounceTime(FILTER_DEBOUNCE_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (filtersKey(this.currentFormFilters()) !== filtersKey(this.appliedFilters())) {
          this.applyFilters();
        }
      });
  }

  /**
   * `?create=1&app=<id>` (the application detail page's "Nouvelle notification")
   * opens the create modal pre-selected on that app. The params are then dropped
   * from the URL (replaceUrl) so a reload does not reopen the modal.
   */
  private openCreateFromQuery(): void {
    const params = this.route.snapshot.queryParamMap;
    if (params.get('create') !== '1') {
      return;
    }
    const appId = Number(params.get('app'));
    this.openCreateModal(Number.isInteger(appId) && appId > 0 ? appId : null);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { create: null, app: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
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
          // The create modal may have opened before the devices arrived.
          if (this.modalMode() === 'create' && !this.notificationForm.controls.device_ids.dirty) {
            this.preselectAllDevices();
          }
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
          this.historyLoaded.set(true);
        },
        error: (error) => {
          this.error.set(coerceApiError(error));
        },
      });
  }

  /** `preselectedAppId` wins over the shell selection (deep link from an app). */
  openCreateModal(preselectedAppId: number | null = null): void {
    this.error.set(null);
    const appId = preselectedAppId ?? this.shell.selectedAppId();
    this.notificationForm.reset({
      application_id: appId ? String(appId) : '',
      device_ids: [],
      title: '',
      message: '',
      scheduled_for: null,
    });
    if (preselectedAppId !== null) {
      // An explicit choice: keep the shell-selection sync from overwriting it.
      this.notificationForm.controls.application_id.markAsDirty();
    }
    this.preselectAllDevices();
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

    if (this.selectedAppInactive()) {
      this.error.set({ code: 'application_inactive', detail: this.copy().alerts.inactiveApp, errors: {} });
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

  // History rows only: the backend refuses (409) to hide a notification that is
  // still pending; a future one keeps its own (hard) delete.
  canDelete(notification: NotificationRead): boolean {
    return (
      !this.futureNotificationIds().has(notification.id) &&
      !['scheduled', 'queued', 'processing'].includes(notification.status)
    );
  }

  async deleteNotification(notification: NotificationRead): Promise<void> {
    const shouldDelete = await this.confirm.ask({
      message: this.interpolate(this.copy().confirmHide, { title: notification.title }),
    });
    if (!shouldDelete) {
      return;
    }

    this.error.set(null);
    this.api.deleteNotification(notification.id).subscribe({
      next: () => {
        this.banner.set(this.interpolate(this.copy().alerts.hidden, { title: notification.title }));
        this.refreshNotifications();
      },
      error: (error) => {
        this.error.set(coerceApiError(error));
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

  /** Apply the form's filters now: lists reload and the URL follows (replaceUrl). */
  applyFilters(): void {
    const filters = this.currentFormFilters();
    this.appliedFilters.set(filters);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: filtersToQueryParams(filters),
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.refreshNotifications();
  }

  /** A status chip toggles its status filter (clicking the active one clears it). */
  toggleStatusFilter(status: NotificationStatus | ''): void {
    const next = this.appliedFilters().status === status ? '' : status;
    this.filtersForm.controls.status.setValue(next, { emitEvent: false });
    this.applyFilters();
  }

  clearFilters(): void {
    this.filtersForm.reset(NO_FILTERS, { emitEvent: false });
    this.applyFilters();
  }

  statusCount(status: NotificationStatus): number {
    return this.stats().find((item) => item.status === status)?.count ?? 0;
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

  // String values, like the forms' application_id controls: with numeric values
  // p-select never matched the pre-selected app and showed the placeholder.
  readonly appOptions = computed(() =>
    this.shell.apps().map((app) => ({ label: app.name, value: String(app.id) })),
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
    return this.statusLabels.label('notification', this.isShifted(notification) ? 'shifted' : notification.status);
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

  private currentFormFilters(): NotificationListFilters {
    return this.filtersForm.getRawValue();
  }

  private buildNotificationFilters() {
    const rawValue = this.appliedFilters();

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
    const rawValue = this.appliedFilters();
    return {
      application_id: rawValue.application_id ? Number(rawValue.application_id) : null,
    };
  }

  private buildFutureNotificationFilters() {
    const rawValue = this.appliedFilters();

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

  /**
   * Target every reachable device of the selected app: sending to all the
   * app's subscribers is the common case, the field stays editable.
   */
  private preselectAllDevices(): void {
    this.notificationForm.patchValue(
      { device_ids: this.availableDevices().map((device) => device.id) },
      { emitEvent: false },
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
