import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';

import {
  ApiErrorResponse,
  DevicePlatform,
  DeviceRead,
  PushTokenStatus,
} from '../../../../core/models/api.models';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { coerceApiError } from '../../../../core/utils/api-error.utils';
import { interpolate } from '../../../../core/utils/string.utils';
import { AppAlert } from '../../../../shared/app-alert/app-alert';
import { AppConfirmService } from '../../../../shared/app-confirm-dialog/app-confirm.service';
import { ConsoleDialogActions } from '../../components/console-dialog-actions/console-dialog-actions';
import { DeviceEditFormFields } from '../../components/device-edit-form-fields/device-edit-form-fields';

@Component({
  selector: 'app-devices-page',
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    DatePipe,
    AppAlert,
    ConsoleDialogActions,
    DeviceEditFormFields,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TagModule,
    TextareaModule,
    TooltipModule,
  ],
  templateUrl: './devices-page.html',
  styleUrl: './devices-page.scss',
})
export class DevicesPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(PushitApiService);
  private readonly consoleCopy = inject(ConsoleCopyService);
  private readonly confirm = inject(AppConfirmService);
  private readonly router = inject(Router);
  readonly shell = inject(ConsoleShellService);
  readonly copy = computed(() => this.consoleCopy.current().devices);

  readonly platformOptions: DevicePlatform[] = ['android', 'ios'];
  readonly statusOptions: PushTokenStatus[] = ['active', 'invalid', 'revoked'];

  readonly devices = signal<DeviceRead[]>([]);
  readonly selectedDeviceId = signal<number | null>(null);
  readonly modalMode = signal<'create' | 'edit' | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly linking = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly banner = signal<string | null>(null);

  readonly editForm = this.fb.nonNullable.group({
    id: [0],
    device_name: ['', [Validators.required, Validators.maxLength(120)]],
    platform: ['android' as DevicePlatform, [Validators.required]],
    push_token_status: ['active' as PushTokenStatus, [Validators.required]],
  });

  readonly appTokenForm = this.fb.nonNullable.group({
    app_token: [''],
  });

  readonly linkForm = this.fb.nonNullable.group({
    device_name: ['', [Validators.required, Validators.maxLength(120)]],
    platform: ['android' as DevicePlatform, [Validators.required]],
    push_token: ['', [Validators.required, Validators.minLength(20)]],
  });

  ngOnInit(): void {
    this.loadDevices();
  }

  loadDevices(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.listDevices().subscribe({
      next: (devices) => {
        this.loading.set(false);
        this.devices.set(devices);
        this.shell.setDevicesCount(devices.length);

        const selectedId = this.selectedDeviceId();
        if (selectedId && devices.some((device) => device.id === selectedId)) {
          const selected = devices.find((device) => device.id === selectedId)!;
          this.populateEditForm(selected);
          return;
        }

        this.selectedDeviceId.set(null);
        this.resetEditForm();
      },
      error: (error) => {
        this.loading.set(false);
        this.error.set(coerceApiError(error));
      },
    });
  }

  selectDevice(device: DeviceRead): void {
    this.selectedDeviceId.set(device.id);
    this.populateEditForm(device);
  }

  openCreateModal(): void {
    this.error.set(null);
    this.appTokenForm.reset({ app_token: this.shell.lastGeneratedToken()?.token ?? '' });
    this.linkForm.reset({
      device_name: '',
      platform: 'android',
      push_token: '',
    });
    this.modalMode.set('create');
  }

  openEditModal(device: DeviceRead): void {
    this.error.set(null);
    this.selectDevice(device);
    this.modalMode.set('edit');
  }

  closeModal(): void {
    this.modalMode.set(null);
  }

  setModalVisible(visible: boolean): void {
    if (!visible) {
      this.closeModal();
    }
  }

  saveDevice(): void {
    const deviceId = this.selectedDeviceId();
    if (!deviceId) {
      return;
    }

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.banner.set(null);

    const rawValue = this.editForm.getRawValue();
    this.api
      .updateDevice(deviceId, {
        device_name: rawValue.device_name,
        platform: rawValue.platform,
        push_token_status: rawValue.push_token_status,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.banner.set(this.copy().alerts.updated);
          this.closeModal();
          this.loadDevices();
        },
        error: (error) => {
          this.error.set(coerceApiError(error));
        },
      });
  }

  async deleteDevice(): Promise<void> {
    const deviceId = this.selectedDeviceId();
    const device = this.devices().find((item) => item.id === deviceId);
    if (!deviceId || !device) {
      return;
    }

    const shouldDelete = await this.confirm.ask({
      message: this.interpolate(this.copy().confirmDelete, { name: device.device_name }),
    });
    if (!shouldDelete) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.banner.set(null);

    this.api
      .deleteDevice(deviceId)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.banner.set(this.copy().alerts.deleted);
          this.selectedDeviceId.set(null);
          this.closeModal();
          this.shell.refreshNavigationCounts();
          this.loadDevices();
        },
        error: (error) => {
          this.error.set(coerceApiError(error));
        },
      });
  }

  linkDevice(): void {
    if (this.appTokenForm.invalid || this.linkForm.invalid) {
      this.appTokenForm.markAllAsTouched();
      this.linkForm.markAllAsTouched();
      return;
    }

    const appToken = this.appTokenForm.getRawValue().app_token.trim();
    if (!appToken) {
        this.error.set({
          code: 'missing_app_token',
          detail: this.copy().errors.missingAppToken,
        });
      return;
    }

    this.linking.set(true);
    this.error.set(null);
    this.banner.set(null);

    this.api.linkDevice(appToken, this.linkForm.getRawValue()).subscribe({
      next: (response) => {
        this.linking.set(false);
        this.linkForm.reset({
          device_name: '',
          platform: 'android',
          push_token: '',
        });
        this.banner.set(
          this.interpolate(this.copy().alerts.linked, {
            deviceId: response.device_id,
            applicationId: response.application_id,
          }),
        );
        this.closeModal();
        this.shell.refreshNavigationCounts();
        this.loadDevices();
      },
      error: (error) => {
        this.linking.set(false);
        this.error.set(coerceApiError(error));
      },
    });
  }

  useLatestToken(): void {
    const token = this.shell.lastGeneratedToken()?.token;
    if (!token) {
      return;
    }

    this.appTokenForm.patchValue({ app_token: token });
  }

  trackById(_: number, device: DeviceRead): number {
    return device.id;
  }

  readonly platformSelectOptions = computed(() =>
    this.platformOptions.map((platform) => ({ label: platform, value: platform })),
  );

  readonly statusSelectOptions = computed(() =>
    this.statusOptions.map((status) => ({ label: status, value: status })),
  );

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

  deviceApplicationNames(device: DeviceRead): string {
    if (!device.application_ids.length) {
      return this.copy().none;
    }

    const appNames = device.application_ids
      .map((applicationId) => this.shell.apps().find((app) => app.id === applicationId)?.name ?? null)
      .filter((name): name is string => Boolean(name));

    return appNames.length ? appNames.join(', ') : this.copy().none;
  }

  openDetails(device: DeviceRead): void {
    void this.router.navigate(['/dashboard/devices', device.id]);
  }

  private populateEditForm(device: DeviceRead): void {
    this.editForm.reset({
      id: device.id,
      device_name: device.device_name,
      platform: device.platform,
      push_token_status: device.push_token_status,
    });
  }

  private resetEditForm(): void {
    this.editForm.reset({
      id: 0,
      device_name: '',
      platform: 'android',
      push_token_status: 'active',
    });
  }

  private interpolate = interpolate;
}
