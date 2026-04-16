import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { finalize } from 'rxjs';

import {
  ApplicationRead,
  ApiErrorResponse,
  DevicePlatform,
  DeviceRead,
  PushTokenStatus,
} from '../../../../core/models/api.models';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { formatDateTimeFrBe } from '../../../../core/utils/date-format.utils';
import { coerceApiError } from '../../../../core/utils/api-error.utils';
import { AppAlert } from '../../../../shared/app-alert/app-alert';
import { ConsoleDetailHeader } from '../../components/console-detail-header/console-detail-header';
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
    DatePipe,
    AppAlert,
    ConsoleDetailHeader,
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
      .pipe(finalize(() => this.saving.set(false)))
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

  deviceFacts(): ConsoleFactItem[] {
    return this.deviceFactsComputed();
  }

  private loadDevice(deviceId: number): void {
    this.loading.set(true);
    this.error.set(null);

    this.api
      .getDevice(deviceId)
      .pipe(finalize(() => this.loading.set(false)))
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
