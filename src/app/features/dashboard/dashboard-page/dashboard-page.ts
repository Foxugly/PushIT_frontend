import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { DatePickerModule } from 'primeng/datepicker';

import {
  ApiErrorResponse,
  AppNotificationFilters,
  ApplicationQuietPeriod,
  ApplicationRead,
  DevicePlatform,
  DeviceRead,
  NotificationOrdering,
  NotificationRead,
  NotificationStatus,
  NotificationStats,
} from '../../../core/models/api.models';
import { PushitApiService } from '../../../core/services/pushit-api.service';
import { SessionService } from '../../../core/services/session.service';
import { SettingsService } from '../../../core/services/settings.service';
import { coerceApiError, errorFieldMessages } from '../../../core/utils/api-error.utils';
import { SiteFooter } from '../../../shared/site-footer/site-footer';

@Component({
  selector: 'app-dashboard-page',
  imports: [CommonModule, ReactiveFormsModule, DatePipe, DatePickerModule, SiteFooter],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  private readonly fb = inject(FormBuilder);
  readonly api = inject(PushitApiService);
  private readonly session = inject(SessionService);
  readonly settings = inject(SettingsService);

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
  readonly platformOptions: DevicePlatform[] = ['android', 'ios'];

  readonly pageLoading = signal(true);
  readonly logoutPending = signal(false);
  readonly appPending = signal(false);
  readonly quietPeriodPending = signal(false);
  readonly notificationPending = signal(false);
  readonly futurePending = signal(false);
  readonly devicePending = signal(false);
  readonly appTokenPending = signal(false);

  readonly pageError = signal<ApiErrorResponse | null>(null);
  readonly appError = signal<ApiErrorResponse | null>(null);
  readonly quietPeriodError = signal<ApiErrorResponse | null>(null);
  readonly notificationError = signal<ApiErrorResponse | null>(null);
  readonly futureError = signal<ApiErrorResponse | null>(null);
  readonly deviceError = signal<ApiErrorResponse | null>(null);
  readonly appTokenError = signal<ApiErrorResponse | null>(null);
  readonly banner = signal<{ tone: 'success' | 'danger' | 'info'; message: string } | null>(null);
  readonly lastGeneratedToken = signal<{ appId: number; token: string; prefix: string } | null>(null);

  readonly apps = signal<ApplicationRead[]>([]);
  readonly devices = signal<DeviceRead[]>([]);
  readonly notifications = signal<NotificationRead[]>([]);
  readonly futureNotifications = signal<NotificationRead[]>([]);
  readonly quietPeriods = signal<ApplicationQuietPeriod[]>([]);
  readonly stats = signal<NotificationStats[]>([]);
  readonly appNotifications = signal<NotificationRead[]>([]);

  readonly selectedAppId = signal<number | null>(null);
  readonly editingQuietPeriodId = signal<number | null>(null);
  readonly editingFutureNotificationId = signal<number | null>(null);

  readonly currentUser = computed(() => this.session.user());
  readonly selectedApp = computed(
    () => this.apps().find((app) => app.id === this.selectedAppId()) ?? null,
  );
  readonly shiftedNotificationsCount = computed(
    () =>
      this.notifications().filter(
        (notification) =>
          Boolean(
            notification.scheduled_for &&
              notification.effective_scheduled_for &&
              notification.scheduled_for !== notification.effective_scheduled_for,
          ),
      ).length,
  );

  readonly settingsForm = this.fb.nonNullable.group({
    apiBaseUrl: [this.settings.apiBaseUrl(), [Validators.required]],
  });

  readonly appForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: [''],
  });

  readonly quietPeriodForm = this.fb.nonNullable.group({
    id: [0],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    start_at: [null as Date | null, [Validators.required]],
    end_at: [null as Date | null, [Validators.required]],
    is_active: [true],
  });

  readonly notificationForm = this.fb.nonNullable.group({
    application_id: ['', [Validators.required]],
    device_ids: [[] as number[], [Validators.required]],
    title: ['', [Validators.required, Validators.maxLength(255)]],
    message: ['', [Validators.required]],
    scheduled_for: [null as Date | null],
  });

  readonly notificationFiltersForm = this.fb.nonNullable.group({
    application_id: [''],
    status: [''],
    effective_scheduled_from: [null as Date | null],
    effective_scheduled_to: [null as Date | null],
    has_quiet_period_shift: [''],
    ordering: ['-effective_scheduled_for'],
  });

  readonly futureEditForm = this.fb.nonNullable.group({
    id: [0],
    title: ['', [Validators.required, Validators.maxLength(255)]],
    message: ['', [Validators.required]],
    scheduled_for: [null as Date | null],
  });

  readonly appTokenForm = this.fb.nonNullable.group({
    app_token: ['', [Validators.required]],
  });

  readonly deviceLinkForm = this.fb.nonNullable.group({
    device_name: ['', [Validators.required, Validators.maxLength(120)]],
    platform: ['android' as DevicePlatform, [Validators.required]],
    push_token: ['', [Validators.required, Validators.minLength(20)]],
  });

  readonly appNotificationForm = this.fb.nonNullable.group({
    idempotency_key: [this.generateIdempotencyKey(), [Validators.required]],
    title: ['', [Validators.required, Validators.maxLength(255)]],
    message: ['', [Validators.required]],
    scheduled_for: [null as Date | null],
  });

  readonly appNotificationFiltersForm = this.fb.nonNullable.group({
    status: [''],
    effective_scheduled_from: [null as Date | null],
    effective_scheduled_to: [null as Date | null],
    has_quiet_period_shift: [''],
    ordering: ['-effective_scheduled_for'],
  });

  ngOnInit(): void {
    this.loadDashboard();
  }

  saveSettings(): void {
    if (this.settingsForm.invalid) {
      this.settingsForm.markAllAsTouched();
      return;
    }

    this.settings.updateApiBaseUrl(this.settingsForm.getRawValue().apiBaseUrl);
    this.banner.set({
      tone: 'info',
      message: `Backend cible mis a jour vers ${this.settings.apiBaseUrl()}.`,
    });
    this.loadDashboard();
  }

  loadDashboard(preferredAppId?: number): void {
    this.pageError.set(null);
    this.pageLoading.set(true);

    forkJoin({
      user: this.api.me(),
      apps: this.api.listApps(),
      devices: this.api.listDevices(),
      notifications: this.api.listNotifications(this.buildNotificationListFilters()),
      futureNotifications: this.api.listFutureNotifications(this.buildFutureNotificationFilters()),
      stats: this.api.listNotificationStats(),
    })
      .pipe(finalize(() => this.pageLoading.set(false)))
      .subscribe({
        next: ({ user, apps, devices, notifications, futureNotifications, stats }) => {
          this.session.updateUser(user);
          this.apps.set(apps);
          this.devices.set(devices);
          this.notifications.set(notifications);
          this.futureNotifications.set(futureNotifications);
          this.stats.set(stats);
          this.syncSelectedApp(apps, preferredAppId);
        },
        error: (error) => {
          this.pageError.set(coerceApiError(error));
        },
      });
  }

  selectApp(appId: number): void {
    this.selectedAppId.set(appId);
    this.notificationForm.patchValue({
      application_id: String(appId),
      device_ids: this.activeDeviceIdsForApplication(appId),
    });
    this.loadQuietPeriods();
  }

  createApp(): void {
    if (this.appForm.invalid) {
      this.appForm.markAllAsTouched();
      return;
    }

    this.appError.set(null);
    this.appPending.set(true);

    this.api
      .createApp(this.appForm.getRawValue())
      .pipe(finalize(() => this.appPending.set(false)))
      .subscribe({
        next: (response) => {
          this.lastGeneratedToken.set({
            appId: response.id,
            token: response.app_token,
            prefix: response.app_token_prefix,
          });
          this.appForm.reset({ name: '', description: '' });
          this.banner.set({
            tone: 'success',
            message: `Application ${response.name} creee. Le token brut n'est affiche qu'une seule fois.`,
          });
          this.loadDashboard(response.id);
        },
        error: (error) => {
          this.appError.set(coerceApiError(error));
        },
      });
  }

  toggleAppState(app: ApplicationRead): void {
    this.appError.set(null);
    this.appPending.set(true);

    const request$ = app.is_active ? this.api.deactivateApp(app.id) : this.api.activateApp(app.id);
    request$
      .pipe(finalize(() => this.appPending.set(false)))
      .subscribe({
        next: () => {
          this.banner.set({
            tone: 'success',
            message: `${app.name} est maintenant ${app.is_active ? 'desactivee' : 'activee'}.`,
          });
          this.loadDashboard(app.id);
        },
        error: (error) => {
          this.appError.set(coerceApiError(error));
        },
      });
  }

  regenerateToken(app: ApplicationRead): void {
    this.appError.set(null);
    this.appPending.set(true);

    this.api
      .regenerateAppToken(app.id)
      .pipe(finalize(() => this.appPending.set(false)))
      .subscribe({
        next: (response) => {
          this.lastGeneratedToken.set({
            appId: response.app_id,
            token: response.new_app_token,
            prefix: response.app_token_prefix,
          });
          this.banner.set({
            tone: 'success',
            message: `Nouveau token genere pour ${app.name}. Stockez-le cote serveur uniquement.`,
          });
          this.loadDashboard(app.id);
        },
        error: (error) => {
          this.appError.set(coerceApiError(error));
        },
      });
  }

  revokeToken(app: ApplicationRead): void {
    this.appError.set(null);
    this.appPending.set(true);

    this.api
      .revokeAppToken(app.id)
      .pipe(finalize(() => this.appPending.set(false)))
      .subscribe({
        next: () => {
          this.banner.set({
            tone: 'info',
            message: `Le token de ${app.name} a ete revoque.`,
          });
          this.loadDashboard(app.id);
        },
        error: (error) => {
          this.appError.set(coerceApiError(error));
        },
      });
  }

  loadQuietPeriods(): void {
    const appId = this.selectedAppId();
    if (!appId) {
      this.quietPeriods.set([]);
      return;
    }

    this.api.listAppQuietPeriods(appId).subscribe({
      next: (quietPeriods: ApplicationQuietPeriod[]) => {
        this.quietPeriods.set(quietPeriods);
      },
      error: (error: unknown) => {
        this.quietPeriodError.set(coerceApiError(error));
      },
    });
  }

  editQuietPeriod(quietPeriod: ApplicationQuietPeriod): void {
    this.editingQuietPeriodId.set(quietPeriod.id);
    this.quietPeriodForm.patchValue({
      id: quietPeriod.id,
      name: quietPeriod.name,
      start_at: this.toDateValue(quietPeriod.start_at),
      end_at: this.toDateValue(quietPeriod.end_at),
      is_active: quietPeriod.is_active,
    });
  }

  cancelQuietPeriodEdit(): void {
    this.editingQuietPeriodId.set(null);
    this.quietPeriodForm.reset({
      id: 0,
      name: '',
      start_at: null,
      end_at: null,
      is_active: true,
    });
  }

  saveQuietPeriod(): void {
    const appId = this.selectedAppId();
    if (!appId) {
      this.quietPeriodError.set({
        code: 'missing_application',
        detail: 'Selectionnez une application avant de gerer les periodes blanches.',
      });
      return;
    }

    if (this.quietPeriodForm.invalid) {
      this.quietPeriodForm.markAllAsTouched();
      return;
    }

    this.quietPeriodError.set(null);
    this.quietPeriodPending.set(true);

    const rawValue = this.quietPeriodForm.getRawValue();
    const payload = {
      name: rawValue.name,
      period_type: 'ONCE' as const,
      start_at: this.toIsoOrNull(rawValue.start_at) ?? '',
      end_at: this.toIsoOrNull(rawValue.end_at) ?? '',
      is_active: rawValue.is_active,
    };

    const request$ = this.editingQuietPeriodId()
      ? this.api.updateAppQuietPeriod(appId, this.editingQuietPeriodId()!, payload)
      : this.api.createAppQuietPeriod(appId, payload);

    request$
      .pipe(finalize(() => this.quietPeriodPending.set(false)))
      .subscribe({
        next: () => {
          this.banner.set({
            tone: 'success',
            message: `Periode blanche ${this.editingQuietPeriodId() ? 'mise a jour' : 'cree'} avec succes.`,
          });
          this.cancelQuietPeriodEdit();
          this.loadQuietPeriods();
          this.refreshNotifications();
        },
        error: (error: unknown) => {
          this.quietPeriodError.set(coerceApiError(error));
        },
      });
  }

  deleteQuietPeriod(quietPeriod: ApplicationQuietPeriod): void {
    const appId = this.selectedAppId();
    if (!appId) {
      return;
    }

    const shouldDelete = window.confirm(
      `Supprimer la periode blanche "${quietPeriod.name}" pour ${this.selectedApp()?.name} ?`,
    );
    if (!shouldDelete) {
      return;
    }

    this.api.deleteAppQuietPeriod(appId, quietPeriod.id).subscribe({
      next: () => {
        this.banner.set({
          tone: 'info',
          message: `Periode blanche "${quietPeriod.name}" supprimee.`,
        });
        this.loadQuietPeriods();
        this.refreshNotifications();
      },
      error: (error: unknown) => {
        this.quietPeriodError.set(coerceApiError(error));
      },
    });
  }

  createNotification(): void {
    if (this.notificationForm.invalid) {
      this.notificationForm.markAllAsTouched();
      return;
    }

    this.notificationError.set(null);
    this.notificationPending.set(true);

    const rawValue = this.notificationForm.getRawValue();
    this.api
      .createNotification({
        application_id: Number(rawValue.application_id),
        device_ids: rawValue.device_ids.length
          ? rawValue.device_ids
          : this.activeDeviceIdsForApplication(Number(rawValue.application_id)),
        title: rawValue.title,
        message: rawValue.message,
        scheduled_for: this.toIsoOrNull(rawValue.scheduled_for),
      })
      .pipe(finalize(() => this.notificationPending.set(false)))
      .subscribe({
        next: (notification) => {
          this.notificationForm.reset({
            application_id: rawValue.application_id,
            device_ids: this.activeDeviceIdsForApplication(Number(rawValue.application_id)),
            title: '',
            message: '',
            scheduled_for: null,
          });
          this.banner.set({
            tone: 'success',
            message: notification.scheduled_for
              ? 'Notification planifiee creee.'
              : 'Notification immediate creee. Envoyez-la ensuite manuellement.',
          });
          this.refreshNotifications();
        },
        error: (error) => {
          this.notificationError.set(coerceApiError(error));
        },
      });
  }

  refreshNotifications(): void {
    forkJoin({
      notifications: this.api.listNotifications(this.buildNotificationListFilters()),
      futureNotifications: this.api.listFutureNotifications(this.buildFutureNotificationFilters()),
      stats: this.api.listNotificationStats(),
    }).subscribe({
      next: ({ notifications, futureNotifications, stats }) => {
        this.notifications.set(notifications);
        this.futureNotifications.set(futureNotifications);
        this.stats.set(stats);
      },
      error: (error) => {
        this.notificationError.set(coerceApiError(error));
      },
    });
  }

  applyNotificationFilters(): void {
    this.refreshNotifications();
  }

  clearNotificationFilters(): void {
    this.notificationFiltersForm.reset({
      application_id: '',
      status: '',
      effective_scheduled_from: null,
      effective_scheduled_to: null,
      has_quiet_period_shift: '',
      ordering: '-effective_scheduled_for',
    });
    this.refreshNotifications();
  }

  sendNotification(notification: NotificationRead): void {
    this.notificationError.set(null);
    this.notificationPending.set(true);

    this.api
      .sendNotification(notification.id)
      .pipe(finalize(() => this.notificationPending.set(false)))
      .subscribe({
        next: (response) => {
          this.banner.set({
            tone: 'success',
            message: `Notification ${response.notification_id} mise en file avec la tache ${response.task_id}.`,
          });
          this.refreshNotifications();
        },
        error: (error) => {
          this.notificationError.set(coerceApiError(error));
        },
      });
  }

  editFutureNotification(notification: NotificationRead): void {
    this.editingFutureNotificationId.set(notification.id);
    this.futureEditForm.patchValue({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      scheduled_for: this.toDateValue(notification.scheduled_for),
    });
  }

  cancelFutureEdit(): void {
    this.editingFutureNotificationId.set(null);
    this.futureEditForm.reset({
      id: 0,
      title: '',
      message: '',
      scheduled_for: null,
    });
  }

  saveFutureNotification(): void {
    if (!this.editingFutureNotificationId()) {
      return;
    }

    if (this.futureEditForm.invalid) {
      this.futureEditForm.markAllAsTouched();
      return;
    }

    this.futureError.set(null);
    this.futurePending.set(true);

    const rawValue = this.futureEditForm.getRawValue();
    this.api
      .updateFutureNotification(this.editingFutureNotificationId()!, {
        title: rawValue.title,
        message: rawValue.message,
        scheduled_for: this.toIsoOrNull(rawValue.scheduled_for),
      })
      .pipe(finalize(() => this.futurePending.set(false)))
      .subscribe({
        next: () => {
          this.banner.set({
            tone: 'success',
            message: 'Notification future mise a jour.',
          });
          this.cancelFutureEdit();
          this.refreshNotifications();
        },
        error: (error) => {
          this.futureError.set(coerceApiError(error));
        },
      });
  }

  deleteFutureNotification(notification: NotificationRead): void {
    const shouldDelete = window.confirm(
      `Supprimer la notification future "${notification.title}" ?`,
    );
    if (!shouldDelete) {
      return;
    }

    this.api.deleteFutureNotification(notification.id).subscribe({
      next: () => {
        this.banner.set({
          tone: 'info',
          message: `Notification future "${notification.title}" supprimee.`,
        });
        this.refreshNotifications();
      },
      error: (error) => {
        this.futureError.set(coerceApiError(error));
      },
    });
  }

  linkDeviceWithToken(): void {
    if (this.appTokenForm.invalid || this.deviceLinkForm.invalid) {
      this.appTokenForm.markAllAsTouched();
      this.deviceLinkForm.markAllAsTouched();
      return;
    }

    this.deviceError.set(null);
    this.devicePending.set(true);

    const token = this.appTokenForm.getRawValue().app_token.trim();
    this.api
      .linkDevice(token, this.deviceLinkForm.getRawValue())
      .pipe(finalize(() => this.devicePending.set(false)))
      .subscribe({
        next: (response) => {
          this.deviceLinkForm.reset({
            device_name: '',
            platform: 'android',
            push_token: '',
          });
          this.banner.set({
            tone: 'success',
            message: `Device ${response.device_id} lie a l'application ${response.application_id}.`,
          });
          this.loadDevices();
        },
        error: (error) => {
          this.deviceError.set(coerceApiError(error));
        },
      });
  }

  loadDevices(): void {
    this.api.listDevices().subscribe({
      next: (devices) => {
        this.devices.set(devices);
      },
      error: (error) => {
        this.deviceError.set(coerceApiError(error));
      },
    });
  }

  loadAppNotifications(): void {
    if (this.appTokenForm.invalid) {
      this.appTokenForm.markAllAsTouched();
      return;
    }

    this.appTokenError.set(null);
    this.appTokenPending.set(true);

    const token = this.appTokenForm.getRawValue().app_token.trim();
    this.api
      .listAppNotifications(token, this.buildAppNotificationFilters())
      .pipe(finalize(() => this.appTokenPending.set(false)))
      .subscribe({
        next: (notifications) => {
          this.appNotifications.set(notifications);
        },
        error: (error) => {
          this.appTokenError.set(coerceApiError(error));
        },
      });
  }

  createAppNotification(): void {
    if (this.appTokenForm.invalid || this.appNotificationForm.invalid) {
      this.appTokenForm.markAllAsTouched();
      this.appNotificationForm.markAllAsTouched();
      return;
    }

    this.appTokenError.set(null);
    this.appTokenPending.set(true);

    const token = this.appTokenForm.getRawValue().app_token.trim();
    const rawValue = this.appNotificationForm.getRawValue();
    this.api
      .createAppNotification(token, rawValue.idempotency_key, {
        title: rawValue.title,
        message: rawValue.message,
        scheduled_for: this.toIsoOrNull(rawValue.scheduled_for),
      })
      .pipe(finalize(() => this.appTokenPending.set(false)))
      .subscribe({
        next: () => {
          this.banner.set({
            tone: 'success',
            message: 'Notification applicative creee avec succes.',
          });
          this.appNotificationForm.reset({
            idempotency_key: this.generateIdempotencyKey(),
            title: '',
            message: '',
            scheduled_for: null,
          });
          this.loadAppNotifications();
          this.refreshNotifications();
        },
        error: (error) => {
          this.appTokenError.set(coerceApiError(error));
        },
      });
  }

  clearAppNotificationFilters(): void {
    this.appNotificationFiltersForm.reset({
      status: '',
      effective_scheduled_from: null,
      effective_scheduled_to: null,
      has_quiet_period_shift: '',
      ordering: '-effective_scheduled_for',
    });
    this.loadAppNotifications();
  }

  copyLatestToken(): void {
    const token = this.lastGeneratedToken()?.token;
    if (!token) {
      return;
    }

    navigator.clipboard
      .writeText(token)
      .then(() => {
        this.banner.set({
          tone: 'info',
          message: 'Token copie dans le presse-papiers.',
        });
      })
      .catch(() => {
        this.banner.set({
          tone: 'danger',
          message: 'Impossible de copier le token automatiquement.',
        });
      });
  }

  logout(): void {
    const refreshToken = this.session.refreshToken();
    if (!refreshToken) {
      this.session.clear(true);
      return;
    }

    this.logoutPending.set(true);
    this.api
      .logout(refreshToken)
      .pipe(finalize(() => this.logoutPending.set(false)))
      .subscribe({
        next: () => {
          this.session.clear(true);
        },
        error: () => {
          this.session.clear(true);
        },
      });
  }

  fieldErrors(error: ApiErrorResponse | null, fieldName: string): string[] {
    return errorFieldMessages(error, fieldName);
  }

  isShifted(notification: NotificationRead): boolean {
    return Boolean(
      notification.scheduled_for &&
        notification.effective_scheduled_for &&
        notification.scheduled_for !== notification.effective_scheduled_for,
    );
  }

  trackById(_: number, item: { id: number }): number {
    return item.id;
  }

  statusCount(status: NotificationStatus): number {
    return this.stats().find((item) => item.status === status)?.count ?? 0;
  }

  private syncSelectedApp(apps: ApplicationRead[], preferredAppId?: number): void {
    const currentAppId = this.selectedAppId();
    const nextAppId =
      preferredAppId ??
      (apps.some((app) => app.id === currentAppId) ? currentAppId : apps[0]?.id ?? null);

    this.selectedAppId.set(nextAppId ?? null);
    this.notificationForm.patchValue({
      application_id: nextAppId ? String(nextAppId) : '',
      device_ids: nextAppId ? this.activeDeviceIdsForApplication(nextAppId) : [],
    });

    if (nextAppId) {
      this.loadQuietPeriods();
    } else {
      this.quietPeriods.set([]);
    }
  }

  private buildNotificationListFilters() {
    const rawValue = this.notificationFiltersForm.getRawValue();

    return {
      application_id: rawValue.application_id ? Number(rawValue.application_id) : null,
      status: rawValue.status ? (rawValue.status as NotificationStatus) : null,
      effective_scheduled_from: this.toIsoOrNull(rawValue.effective_scheduled_from),
      effective_scheduled_to: this.toIsoOrNull(rawValue.effective_scheduled_to),
      has_quiet_period_shift: this.parseBoolean(rawValue.has_quiet_period_shift),
      ordering: this.parseOrdering(rawValue.ordering),
    };
  }

  private buildFutureNotificationFilters() {
    const rawValue = this.notificationFiltersForm.getRawValue();

    return {
      effective_scheduled_from: this.toIsoOrNull(rawValue.effective_scheduled_from),
      effective_scheduled_to: this.toIsoOrNull(rawValue.effective_scheduled_to),
      has_quiet_period_shift: this.parseBoolean(rawValue.has_quiet_period_shift),
      ordering: this.parseOrdering(rawValue.ordering),
    };
  }

  private buildAppNotificationFilters(): AppNotificationFilters {
    const rawValue = this.appNotificationFiltersForm.getRawValue();

    return {
      status: rawValue.status ? (rawValue.status as NotificationStatus) : null,
      effective_scheduled_from: this.toIsoOrNull(rawValue.effective_scheduled_from),
      effective_scheduled_to: this.toIsoOrNull(rawValue.effective_scheduled_to),
      has_quiet_period_shift: this.parseBoolean(rawValue.has_quiet_period_shift),
      ordering: this.parseOrdering(rawValue.ordering),
    };
  }

  private parseBoolean(value: string): boolean | null {
    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    return null;
  }

  private parseOrdering(value: string): NotificationOrdering | null {
    if (value === 'effective_scheduled_for' || value === '-effective_scheduled_for') {
      return value;
    }

    return null;
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

  private activeDeviceIdsForApplication(applicationId: number): number[] {
    return this.devices()
      .filter(
        (device) =>
          device.push_token_status === 'active' && device.application_ids.includes(applicationId),
      )
      .map((device) => device.id);
  }

  private generateIdempotencyKey(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `idem-${Date.now()}`;
  }
}
