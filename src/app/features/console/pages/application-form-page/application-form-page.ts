import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { finalize } from 'rxjs';

import { ApiErrorResponse, ApplicationRead } from '../../../../core/models/api.models';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { coerceApiError, errorFieldMessages } from '../../../../core/utils/api-error.utils';
import { AppAlert } from '../../../../shared/app-alert/app-alert';
import { ApiErrorMessagePipe } from '../../../../core/pipes/api-error-message.pipe';
import { ApplicationFormFields } from '../../components/application-form-fields/application-form-fields';
import { ConsoleDetailHeader } from '../../components/console-detail-header/console-detail-header';
import { ConsoleDialogActions } from '../../components/console-dialog-actions/console-dialog-actions';
import { AvatarCropper } from '../../../../shared/avatar-cropper/avatar-cropper';

@Component({
  selector: 'app-application-form-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AppAlert,
    ApiErrorMessagePipe,
    ApplicationFormFields,
    ConsoleDetailHeader,
    ConsoleDialogActions,
    ButtonModule,
    AvatarCropper,
  ],
  templateUrl: './application-form-page.html',
  styleUrl: './application-form-page.scss',
})
export class ApplicationFormPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(PushitApiService);
  private readonly consoleCopy = inject(ConsoleCopyService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly shell = inject(ConsoleShellService);
  readonly copy = computed(() => this.consoleCopy.current().applications);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: [''],
  });

  /** null in create mode, the app id in edit mode. */
  readonly appId = signal<number | null>(null);
  readonly isEdit = computed(() => this.appId() !== null);
  readonly pending = signal(false);
  readonly loading = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);

  // Edit mode: the application currently being edited (drives logo preview).
  readonly application = signal<ApplicationRead | null>(null);
  readonly logoPending = signal(false);

  ngOnInit(): void {
    const rawId = this.route.snapshot.paramMap.get('appId');
    if (rawId === null) {
      // Create mode.
      this.form.reset({ name: '', description: '' });
      return;
    }

    const appId = Number(rawId);
    if (!Number.isFinite(appId) || appId <= 0) {
      this.error.set({ code: 'invalid_application_id', detail: this.copy().errors.invalidId });
      return;
    }

    this.appId.set(appId);
    const cached = this.shell.apps().find((app) => app.id === appId) ?? null;
    if (cached) {
      this.application.set(cached);
      this.form.reset({ name: cached.name, description: cached.description });
    }
    this.loadApplication(appId);
  }

  private loadApplication(appId: number): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getApp(appId)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false)))
      .subscribe({
        next: (app) => {
          this.application.set(app);
          this.form.reset({ name: app.name, description: app.description });
        },
        error: (err) => this.error.set(coerceApiError(err)),
      });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.isEdit()) {
      this.updateApp();
    } else {
      this.createApp();
    }
  }

  private createApp(): void {
    this.pending.set(true);
    this.error.set(null);

    this.shell.createApp(
      this.form.getRawValue(),
      (app) => {
        // Navigate to the detail page where the freshly-created one-time token
        // is revealed (the shell stored it via rememberGeneratedToken). The QR
        // dialog on the list/detail surfaces it while it is still held.
        this.pending.set(false);
        void this.router.navigate(['/dashboard/applications', app.id]);
      },
      () => {
        this.pending.set(false);
        this.error.set({ code: 'application_create_failed', detail: this.copy().errors.create });
      },
    );
  }

  private updateApp(): void {
    const appId = this.appId();
    if (appId === null) {
      return;
    }

    this.pending.set(true);
    this.error.set(null);

    this.api
      .updateApp(appId, this.form.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.pending.set(false)))
      .subscribe({
        next: (app) => {
          this.shell.loadShell(app.id);
          void this.router.navigate(['/dashboard/applications', app.id]);
        },
        error: (err) => this.error.set(coerceApiError(err)),
      });
  }

  onLogoCropped(file: File): void {
    const appId = this.appId();
    if (!file || appId === null) {
      return;
    }

    this.logoPending.set(true);
    this.error.set(null);
    this.api
      .uploadAppLogo(appId, file)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.logoPending.set(false)))
      .subscribe({
        next: (app) => {
          this.application.set(app);
          this.shell.loadShell(app.id);
        },
        error: (err) => this.error.set(coerceApiError(err)),
      });
  }

  removeLogo(): void {
    const appId = this.appId();
    if (appId === null) {
      return;
    }

    this.logoPending.set(true);
    this.error.set(null);
    this.api
      .deleteAppLogo(appId)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.logoPending.set(false)))
      .subscribe({
        next: () => {
          const app = this.application();
          if (app) {
            this.application.set({ ...app, logo: null });
          }
          this.shell.loadShell(appId);
        },
        error: (err) => this.error.set(coerceApiError(err)),
      });
  }

  cancel(): void {
    void this.router.navigate(['/dashboard/applications']);
  }

  fieldErrors(fieldName: string): string[] {
    return errorFieldMessages(this.error(), fieldName);
  }
}
