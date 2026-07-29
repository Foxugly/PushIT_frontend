import { CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { finalize } from 'rxjs';

import { TableLazyLoadEvent } from 'primeng/table';

import {
  ApplicationRead,
  ApiErrorResponse,
  DeliveryStatus,
  DeviceNotificationRead,
  DevicePlatform,
  DeviceRead,
  PushTokenStatus,
  UnlinkSource,
} from '../../../../core/models/api.models';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { formatDateTimeFrBe } from '../../../../core/utils/date-format.utils';
import { pushTokenStatusSeverity } from '../../../../core/utils/device.utils';
import { coerceApiError } from '../../../../core/utils/api-error.utils';
import { AppAlert } from '../../../../shared/app-alert/app-alert';
import { ApiErrorMessagePipe } from '../../../../core/pipes/api-error-message.pipe';
import { PageHeader } from '../../../../shared/page-header/page-header';
import { ConsoleDialogActions } from '../../components/console-dialog-actions/console-dialog-actions';
import { DeviceEditFormFields } from '../../components/device-edit-form-fields/device-edit-form-fields';
import { ConsoleFactItem } from '../../components/console-facts-table/console-fact-item';
import { ConsoleFactsTable } from '../../components/console-facts-table/console-facts-table';

@Component({
  selector: 'app-device-detail-page',
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    AppAlert, ApiErrorMessagePipe,
    PageHeader,
    ConsoleDialogActions,
    DeviceEditFormFields,
    ConsoleFactsTable,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    TagModule,
    TableModule,
    TooltipModule,
  ],
  templateUrl: './device-detail-page.html',
  styleUrl: './device-detail-page.scss',
})
export class DeviceDetailPage implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(PushitApiService);
  private readonly consoleCopy = inject(ConsoleCopyService);
  readonly shell = inject(ConsoleShellService);
  readonly copy = computed(() => this.consoleCopy.current().deviceDetail);

  readonly device = signal<DeviceRead | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly editError = signal<ApiErrorResponse | null>(null);
  readonly saving = signal(false);
  readonly isEditModalOpen = signal(false);
  readonly linkedApplications = computed(() => {
    const currentDevice = this.device();
    if (!currentDevice) {
      return [];
    }

    return currentDevice.application_ids
      .map((applicationId) => this.shell.apps().find((app) => app.id === applicationId) ?? null)
      .filter((application): application is NonNullable<typeof application> => Boolean(application));
  });
  readonly deviceFactsComputed = computed(() => {
    const currentDevice = this.device();
    if (!currentDevice) {
      return [];
    }

    return [
      { label: this.copy().facts.id, value: String(currentDevice.id) },
      { label: this.copy().facts.name, value: currentDevice.device_name },
      { label: this.copy().facts.platform, value: currentDevice.platform, severity: 'info' as const },
      {
        label: this.copy().facts.tokenStatus,
        value: currentDevice.push_token_status,
        severity: this.statusSeverity(currentDevice.push_token_status),
      },
      {
        label: this.copy().facts.lastActivity,
        value: currentDevice.last_seen_at ? this.formatDateTime(currentDevice.last_seen_at) : this.copy().labels.never,
      },
      { label: this.copy().facts.createdAt, value: this.formatDateTime(currentDevice.created_at) },
    ] as ConsoleFactItem[];
  });
  readonly platformOptions: DevicePlatform[] = ['android', 'ios'];
  readonly statusOptions: PushTokenStatus[] = ['active', 'invalid', 'revoked'];

  // Notifications delivered to this device (paginated, owner reverse view).
  readonly deviceNotifications = signal<DeviceNotificationRead[]>([]);
  readonly notifTotal = signal(0);
  readonly notifLoading = signal(false);
  readonly notifError = signal<ApiErrorResponse | null>(null);
  readonly notifAppFilter = signal<number | null>(null);
  readonly notifRows = 50; // matches the backend PAGE_SIZE
  private notifFirst = 0;
  readonly notifAppFilterOptions = computed(() => [
    { label: this.copy().notifications.allApps, value: null as number | null },
    ...this.linkedApplications().map((app) => ({ label: app.name, value: app.id as number | null })),
  ]);

  readonly editForm = this.fb.nonNullable.group({
    device_name: ['', [Validators.required, Validators.maxLength(120)]],
    platform: ['android' as DevicePlatform, [Validators.required]],
    push_token_status: ['active' as PushTokenStatus, [Validators.required]],
  });

  ngOnInit(): void {
    const deviceId = Number(this.route.snapshot.paramMap.get('deviceId'));
    if (!Number.isFinite(deviceId) || deviceId <= 0) {
      this.error.set({
        code: 'invalid_device_id',
        detail: this.copy().errors.invalidId,
      });
      return;
    }

    this.loadDevice(deviceId);
  }

  statusSeverity(status: PushTokenStatus): 'success' | 'warn' | 'danger' | 'secondary' {
    return pushTokenStatusSeverity(status);
  }

  openEditModal(): void {
    const currentDevice = this.device();
    if (!currentDevice) {
      return;
    }

    this.editError.set(null);
    this.editForm.reset({
      device_name: currentDevice.device_name,
      platform: currentDevice.platform,
      push_token_status: currentDevice.push_token_status,
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

  saveDevice(): void {
    const currentDevice = this.device();
    if (!currentDevice) {
      return;
    }

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.editError.set(null);

    this.api
      .updateDevice(currentDevice.id, this.editForm.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updatedDevice) => {
          this.device.set(updatedDevice);
          this.closeEditModal();
          this.shell.refreshNavigationCounts();
        },
        error: (error) => {
          this.editError.set(coerceApiError(error));
        },
      });
  }

  readonly platformSelectOptions = computed(() =>
    this.platformOptions.map((platform) => ({ label: platform, value: platform })),
  );

  readonly statusSelectOptions = computed(() =>
    this.statusOptions.map((status) => ({ label: status, value: status })),
  );

  appSeverity(app: ApplicationRead): 'success' | 'secondary' {
    return app.is_active ? 'success' : 'secondary';
  }

  unlinkSourceLabel(source: UnlinkSource): string {
    const sources = this.copy().unlinkSources;
    switch (source) {
      case 'device_button':
        return sources.deviceButton;
      case 'inbox':
        return sources.inbox;
      case 'takeover':
        return sources.takeover;
      default:
        return sources.unknown;
    }
  }

  deliveryStatusSeverity(status: DeliveryStatus | null): 'success' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'sent':
        return 'success';
      case 'pending':
        return 'warn';
      case 'failed':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  loadDeviceNotifications(event?: TableLazyLoadEvent): void {
    const currentDevice = this.device();
    if (!currentDevice) {
      return;
    }
    if (event) {
      this.notifFirst = event.first ?? 0;
    }
    const page = Math.floor(this.notifFirst / this.notifRows) + 1;
    this.notifLoading.set(true);
    this.notifError.set(null);
    this.api
      .listDeviceNotifications(currentDevice.id, { page, application_id: this.notifAppFilter() })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.notifLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.deviceNotifications.set(response.results);
          this.notifTotal.set(response.count);
        },
        error: (error) => {
          this.notifError.set(coerceApiError(error));
          this.deviceNotifications.set([]);
          this.notifTotal.set(0);
        },
      });
  }

  onNotifAppFilterChange(applicationId: number | null): void {
    this.notifAppFilter.set(applicationId);
    this.notifFirst = 0; // back to the first page when the filter changes
    this.loadDeviceNotifications();
  }

  deviceFacts(): ConsoleFactItem[] {
    return this.deviceFactsComputed();
  }

  private loadDevice(deviceId: number): void {
    this.loading.set(true);
    this.error.set(null);

    this.api
      .getDevice(deviceId)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false)))
      .subscribe({
        next: (device) => {
          this.device.set(device);
        },
        error: (error) => {
          this.error.set(coerceApiError(error));
        },
      });
  }

  private formatDateTime(value: string | null): string {
    return formatDateTimeFrBe(value);
  }
}
