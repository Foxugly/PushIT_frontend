import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { finalize } from 'rxjs';

import {
  ApiErrorResponse,
  DeviceRead,
  PushTokenStatus,
} from '../../../../core/models/api.models';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { coerceApiError } from '../../../../core/utils/api-error.utils';

@Component({
  selector: 'app-device-detail-page',
  imports: [CommonModule, RouterLink, DatePipe, ButtonModule, TagModule],
  templateUrl: './device-detail-page.html',
  styleUrl: './device-detail-page.scss',
})
export class DeviceDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(PushitApiService);
  readonly shell = inject(ConsoleShellService);

  readonly device = signal<DeviceRead | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly linkedApplications = computed(() => {
    const currentDevice = this.device();
    if (!currentDevice) {
      return [];
    }

    return currentDevice.application_ids
      .map((applicationId) => this.shell.apps().find((app) => app.id === applicationId) ?? null)
      .filter((application): application is NonNullable<typeof application> => Boolean(application));
  });

  ngOnInit(): void {
    const deviceId = Number(this.route.snapshot.paramMap.get('deviceId'));
    if (!Number.isFinite(deviceId) || deviceId <= 0) {
      this.error.set({
        code: 'invalid_device_id',
        detail: 'Identifiant device invalide.',
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
}
