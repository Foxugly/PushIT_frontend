import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin, Observable, of } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import {
  ApiErrorResponse,
  ApplicationQuietPeriod,
  DeviceQuietPeriod,
  DeviceRead,
  QuietPeriodType,
  QuietPeriodWrite,
  Weekday,
} from '../../../../core/models/api.models';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { coerceApiError, errorFieldMessages } from '../../../../core/utils/api-error.utils';
import { AppAlert } from '../../../../shared/app-alert/app-alert';
import { AppConfirmService } from '../../../../shared/app-confirm-dialog/app-confirm.service';
import { ConsoleDialogActions } from '../../components/console-dialog-actions/console-dialog-actions';

type QuietPeriodScope = 'application' | 'device';
type QuietPeriodView = ApplicationQuietPeriod | DeviceQuietPeriod;
type QuietPeriodContext = { scope: QuietPeriodScope; parentId: number };

@Component({
  selector: 'app-quiet-periods-page',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    AppAlert,
    ConsoleDialogActions,
    ButtonModule,
    CheckboxModule,
    DatePickerModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TagModule,
    TooltipModule,
  ],
  templateUrl: './quiet-periods-page.html',
  styleUrl: './quiet-periods-page.scss',
})
export class QuietPeriodsPage {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(PushitApiService);
  private readonly consoleCopy = inject(ConsoleCopyService);
  private readonly confirm = inject(AppConfirmService);
  readonly shell = inject(ConsoleShellService);
  readonly copy = computed(() => this.consoleCopy.current().quietPeriods);

  readonly scopeOptions = computed(() => [
    { label: this.copy().scopeLabels.application, value: 'application' as QuietPeriodScope },
    { label: this.copy().scopeLabels.device, value: 'device' as QuietPeriodScope },
  ]);
  readonly periodTypeOptions = computed(() => [
    { label: this.copy().typeLabels.once, value: 'ONCE' as QuietPeriodType },
    { label: this.copy().typeLabels.recurring, value: 'RECURRING' as QuietPeriodType },
  ]);
  readonly weekdayOptions = computed<Array<{ label: string; value: Weekday }>>(() =>
    this.copy().weekdays.map((label, index) => ({ label, value: index as Weekday })),
  );

  readonly quietPeriods = signal<QuietPeriodView[]>([]);
  readonly devices = signal<DeviceRead[]>([]);
  readonly selectedQuietPeriodId = signal<number | null>(null);
  readonly editingQuietPeriodId = signal<number | null>(null);
  readonly modalContext = signal<QuietPeriodContext | null>(null);
  readonly modalScope = signal<QuietPeriodScope>('application');
  readonly modalApplicationId = signal<number | null>(null);
  readonly modalDeviceId = signal<number | null>(null);
  readonly isModalOpen = signal(false);
  readonly loading = signal(false);
  readonly loadingDevices = signal(false);
  readonly pending = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly banner = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    id: [0],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    period_type: ['ONCE' as QuietPeriodType, [Validators.required]],
    start_at: [null as Date | null],
    end_at: [null as Date | null],
    recurrence_days: [[] as Weekday[]],
    start_time: [null as Date | null],
    end_time: [null as Date | null],
    is_active: [true],
  });

  readonly applicationOptions = computed(() =>
    this.shell.apps().map((app) => ({
      label: app.name,
      value: app.id,
    })),
  );

  readonly deviceOptions = computed(() =>
    this.devices().map((device) => ({
      label: `${device.device_name} (${device.platform})`,
      value: device.id,
    })),
  );

  readonly modalTargetLabel = computed(() => {
    const context = this.modalContext();
    if (context) {
      return this.targetLabelForContext(context);
    }

    const createContext = this.buildCreateContext();
    return createContext ? this.targetLabelForContext(createContext) : 'Aucune cible';
  });

  constructor() {
    effect(() => {
      this.shell.apps();
      this.devices();
      this.loadQuietPeriods();
    });

    this.form.controls.period_type.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((periodType) => {
        if (periodType === 'RECURRING') {
          this.form.patchValue(
            {
              start_at: null,
              end_at: null,
            },
            { emitEvent: false },
          );
          return;
        }

        this.form.patchValue(
          {
            recurrence_days: [],
            start_time: null,
            end_time: null,
          },
          { emitEvent: false },
        );
      });
  }

  ngOnInit(): void {
    this.loadDevices();
  }

  loadDevices(): void {
    this.loadingDevices.set(true);

    this.api
      .listDevices()
      .pipe(finalize(() => this.loadingDevices.set(false)))
      .subscribe({
        next: (devices) => {
          this.devices.set(devices);
        },
        error: (error: unknown) => {
          this.error.set(coerceApiError(error));
        },
      });
  }

  loadQuietPeriods(): void {
    const apps = this.shell.apps();
    const devices = this.devices();
    if (!apps.length && !devices.length) {
      this.quietPeriods.set([]);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const appRequests = apps.length
      ? forkJoin(apps.map((app) => this.api.listAppQuietPeriods(app.id)))
      : of([] as ApplicationQuietPeriod[][]);
    const deviceRequests = devices.length
      ? forkJoin(devices.map((device) => this.api.listDeviceQuietPeriods(device.id)))
      : of([] as DeviceQuietPeriod[][]);

    forkJoin({
      appQuietPeriods: appRequests,
      deviceQuietPeriods: deviceRequests,
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ appQuietPeriods, deviceQuietPeriods }) => {
          this.quietPeriods.set([...appQuietPeriods.flat(), ...deviceQuietPeriods.flat()]);
        },
        error: (error: unknown) => {
          this.error.set(coerceApiError(error));
        },
      });
  }

  openCreateModal(): void {
    if (!this.shell.apps().length && !this.devices().length) {
      this.error.set({
        code: 'missing_targets',
        detail: this.copy().missingTargets,
      });
      return;
    }

    this.cancelEdit();
    this.modalScope.set(this.shell.apps().length ? 'application' : 'device');
    this.modalApplicationId.set(this.applicationOptions()[0]?.value ?? null);
    this.modalDeviceId.set(this.deviceOptions()[0]?.value ?? null);
    this.form.patchValue(
      {
        name: this.defaultQuietPeriodName(),
      },
      { emitEvent: false },
    );
    this.error.set(null);
    this.isModalOpen.set(true);
  }

  editQuietPeriod(quietPeriod: QuietPeriodView): void {
    const context = this.contextForQuietPeriod(quietPeriod);
    this.selectedQuietPeriodId.set(quietPeriod.id);
    this.editingQuietPeriodId.set(quietPeriod.id);
    this.modalContext.set(context);
    this.modalScope.set(context.scope);
    this.modalApplicationId.set(context.scope === 'application' ? context.parentId : null);
    this.modalDeviceId.set(context.scope === 'device' ? context.parentId : null);
    this.form.reset({
      id: quietPeriod.id,
      name: quietPeriod.name,
      period_type: quietPeriod.period_type,
      start_at: this.toDateValue(quietPeriod.start_at),
      end_at: this.toDateValue(quietPeriod.end_at),
      recurrence_days: [...quietPeriod.recurrence_days],
      start_time: this.toTimeValue(quietPeriod.start_time),
      end_time: this.toTimeValue(quietPeriod.end_time),
      is_active: quietPeriod.is_active,
    });
    this.isModalOpen.set(true);
  }

  setModalScope(scope: QuietPeriodScope): void {
    this.modalScope.set(scope);
    if (scope === 'application' && !this.modalApplicationId()) {
      this.modalApplicationId.set(this.applicationOptions()[0]?.value ?? null);
    }
    if (scope === 'device' && !this.modalDeviceId()) {
      this.modalDeviceId.set(this.deviceOptions()[0]?.value ?? null);
    }
  }

  setModalApplication(applicationId: number | null): void {
    this.modalApplicationId.set(applicationId);
  }

  setModalDevice(deviceId: number | null): void {
    this.modalDeviceId.set(deviceId);
  }

  cancelEdit(): void {
    this.selectedQuietPeriodId.set(null);
    this.editingQuietPeriodId.set(null);
    this.modalContext.set(null);
    this.modalApplicationId.set(this.applicationOptions()[0]?.value ?? null);
    this.modalDeviceId.set(this.deviceOptions()[0]?.value ?? null);
    this.form.reset({
      id: 0,
      name: '',
      period_type: 'ONCE',
      start_at: null,
      end_at: null,
      recurrence_days: [],
      start_time: null,
      end_time: null,
      is_active: true,
    });
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.cancelEdit();
  }

  setModalVisible(visible: boolean): void {
    if (!visible) {
      this.closeModal();
    }
  }

  saveQuietPeriod(): void {
    const context = this.modalContext() ?? this.buildCreateContext();
    if (!context) {
      this.error.set({
        code: 'missing_parent',
        detail: this.copy().missingParent,
      });
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.buildPayload();
    if (!payload) {
      return;
    }

    this.pending.set(true);
    this.error.set(null);
    this.banner.set(null);

    const request$: Observable<unknown> =
      context.scope === 'application'
        ? this.editingQuietPeriodId()
          ? this.api.updateAppQuietPeriod(context.parentId, this.editingQuietPeriodId()!, payload)
          : this.api.createAppQuietPeriod(context.parentId, payload)
        : this.editingQuietPeriodId()
          ? this.api.updateDeviceQuietPeriod(
              context.parentId,
              this.editingQuietPeriodId()!,
              payload,
            )
          : this.api.createDeviceQuietPeriod(context.parentId, payload);

    request$
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: () => {
          this.banner.set(
            this.editingQuietPeriodId()
              ? this.copy().alerts.updated
              : this.copy().alerts.created,
          );
          this.shell.refreshNavigationCounts();
          this.closeModal();
          this.loadQuietPeriods();
        },
        error: (error: unknown) => {
          this.error.set(coerceApiError(error));
        },
      });
  }

  async deleteQuietPeriod(quietPeriod: QuietPeriodView): Promise<void> {
    const context = this.contextForQuietPeriod(quietPeriod);
    const shouldDelete = await this.confirm.ask({
      message: this.interpolate(this.copy().confirmDelete, { name: quietPeriod.name }),
    });
    if (!shouldDelete) {
      return;
    }

    this.pending.set(true);
    this.error.set(null);
    this.banner.set(null);

    const request$ =
      context.scope === 'application'
        ? this.api.deleteAppQuietPeriod(context.parentId, quietPeriod.id)
        : this.api.deleteDeviceQuietPeriod(context.parentId, quietPeriod.id);

    request$
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: () => {
          this.banner.set(this.interpolate(this.copy().alerts.deleted, { name: quietPeriod.name }));
          this.shell.refreshNavigationCounts();
          this.loadQuietPeriods();
        },
        error: (error: unknown) => {
          this.error.set(coerceApiError(error));
        },
      });
  }

  hasRecurrenceDay(day: Weekday): boolean {
    return this.form.controls.recurrence_days.value.includes(day);
  }

  toggleRecurrenceDay(day: Weekday, checked: boolean): void {
    const currentDays = this.form.controls.recurrence_days.value;
    const nextDays = checked
      ? [...new Set([...currentDays, day])]
      : currentDays.filter((currentDay) => currentDay !== day);

    this.form.controls.recurrence_days.setValue(
      [...nextDays].sort((left, right) => left - right) as Weekday[],
    );
  }

  isRecurring(): boolean {
    return this.form.controls.period_type.value === 'RECURRING';
  }

  fieldErrors(fieldName: string): string[] {
    return errorFieldMessages(this.error(), fieldName);
  }

  quietPeriodScopeLabel(quietPeriod: QuietPeriodView): string {
    return 'application' in quietPeriod
      ? this.copy().scopeLabels.application
      : this.copy().scopeLabels.device;
  }

  quietPeriodTargetLabel(quietPeriod: QuietPeriodView): string {
    if ('application' in quietPeriod) {
      return (
        this.shell.apps().find((app) => app.id === quietPeriod.application)?.name ??
        this.copy().targetUnknownApplication
      );
    }

    return (
      this.devices().find((device) => device.id === quietPeriod.device)?.device_name ??
      this.copy().targetUnknownDevice
    );
  }

  quietPeriodTypeSeverity(type: QuietPeriodType): 'info' | 'warn' {
    return type === 'ONCE' ? 'info' : 'warn';
  }

  quietPeriodStatusSeverity(quietPeriod: QuietPeriodView): 'success' | 'secondary' {
    return quietPeriod.is_active ? 'success' : 'secondary';
  }

  quietPeriodScheduleLabel(quietPeriod: QuietPeriodView): string {
    if (quietPeriod.period_type === 'ONCE') {
      return `${this.formatDateTime(quietPeriod.start_at)} -> ${this.formatDateTime(quietPeriod.end_at)}`;
    }

    const days = quietPeriod.recurrence_days
      .map((day) => this.weekdayOptions().find((option) => option.value === day)?.label ?? String(day))
      .join(', ');

    return `${days} | ${this.formatTime(quietPeriod.start_time)} -> ${this.formatTime(quietPeriod.end_time)}`;
  }

  private buildCreateContext(): QuietPeriodContext | null {
    if (this.modalScope() === 'application') {
      const appId = this.modalApplicationId();
      return appId ? { scope: 'application', parentId: appId } : null;
    }

    const deviceId = this.modalDeviceId();
    return deviceId ? { scope: 'device', parentId: deviceId } : null;
  }

  private contextForQuietPeriod(quietPeriod: QuietPeriodView): QuietPeriodContext {
    if ('application' in quietPeriod) {
      return { scope: 'application', parentId: quietPeriod.application };
    }

    return { scope: 'device', parentId: quietPeriod.device };
  }

  private targetLabelForContext(context: QuietPeriodContext): string {
    if (context.scope === 'application') {
      const app = this.shell.apps().find((item) => item.id === context.parentId);
      return app ? `${this.copy().scopeLabels.application}: ${app.name}` : this.copy().targetUnknownApplication;
    }

    const device = this.devices().find((item) => item.id === context.parentId);
    return device ? `${this.copy().scopeLabels.device}: ${device.device_name}` : this.copy().targetUnknownDevice;
  }

  private defaultQuietPeriodName(): string {
    return this.modalScope() === 'device'
      ? this.copy().defaultNames.device
      : this.copy().defaultNames.application;
  }

  private buildPayload(): QuietPeriodWrite | null {
    const rawValue = this.form.getRawValue();

    if (rawValue.period_type === 'ONCE') {
      if (!rawValue.start_at || !rawValue.end_at) {
        this.error.set({
          code: 'validation_error',
          detail: this.copy().validation.onceRequired,
          errors: {
            start_at: rawValue.start_at ? [] : [this.copy().validation.required],
            end_at: rawValue.end_at ? [] : [this.copy().validation.required],
          },
        });
        return null;
      }

      if (Number.isNaN(rawValue.start_at.getTime()) || Number.isNaN(rawValue.end_at.getTime()) || rawValue.end_at <= rawValue.start_at) {
        this.error.set({
          code: 'validation_error',
          detail: 'Validation error.',
          errors: {
            end_at: [this.copy().validation.endAfterStart],
          },
        });
        return null;
      }

      return {
        name: rawValue.name,
        period_type: 'ONCE',
        start_at: this.toIso(rawValue.start_at),
        end_at: this.toIso(rawValue.end_at),
        is_active: rawValue.is_active,
      };
    }

    if (!rawValue.recurrence_days.length || !rawValue.start_time || !rawValue.end_time) {
      this.error.set({
        code: 'validation_error',
        detail: this.copy().validation.recurringRequired,
        errors: {
          recurrence_days: rawValue.recurrence_days.length ? [] : [this.copy().validation.selectOneDay],
          start_time: rawValue.start_time ? [] : [this.copy().validation.required],
          end_time: rawValue.end_time ? [] : [this.copy().validation.required],
        },
      });
      return null;
    }

    if (rawValue.start_time.getTime() === rawValue.end_time.getTime()) {
      this.error.set({
        code: 'validation_error',
          detail: 'Validation error.',
          errors: {
            end_time: [this.copy().validation.differentEndTime],
          },
        });
      return null;
    }

    return {
      name: rawValue.name,
      period_type: 'RECURRING',
      recurrence_days: rawValue.recurrence_days,
      start_time: this.toTimeWithSeconds(rawValue.start_time),
      end_time: this.toTimeWithSeconds(rawValue.end_time),
      is_active: rawValue.is_active,
    };
  }

  private toIso(value: Date): string {
    return value.toISOString();
  }

  private toTimeWithSeconds(value: Date): string {
    const pad = (part: number) => String(part).padStart(2, '0');

    return `${pad(value.getHours())}:${pad(value.getMinutes())}:00`;
  }

  private interpolate(template: string, values: Record<string, string | number>): string {
    return Object.entries(values).reduce(
      (result, [key, value]) => result.replace(`{${key}}`, String(value)),
      template,
    );
  }

  private toDateValue(value: string | null): Date | null {
    if (!value) {
      return null;
    }

    return new Date(value);
  }

  private toTimeValue(value: string | null): Date | null {
    if (!value) {
      return null;
    }

    const [hours, minutes] = value.split(':').map((part) => Number(part));
    const date = new Date();
    date.setHours(hours || 0, minutes || 0, 0, 0);
    return date;
  }

  private formatDateTime(value: string | null): string {
    if (!value) {
      return '-';
    }

    return new Intl.DateTimeFormat('fr-BE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  private formatTime(value: string | null): string {
    return value ? value.slice(0, 5) : '-';
  }
}
