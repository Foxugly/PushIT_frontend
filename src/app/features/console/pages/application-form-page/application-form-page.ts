import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { finalize } from 'rxjs';

import { ApiErrorResponse } from '../../../../core/models/api.models';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { coerceApiError, errorFieldMessages } from '../../../../core/utils/api-error.utils';
import { isBillingRefusal } from '../../../../core/utils/api-error-copy';
import { AppAlert } from '../../../../shared/app-alert/app-alert';
import { ApiErrorMessagePipe } from '../../../../core/pipes/api-error-message.pipe';
import { ApplicationFormFields } from '../../components/application-form-fields/application-form-fields';
import { PageHeader } from '../../../../shared/page-header/page-header';
import { ConsoleDialogActions } from '../../components/console-dialog-actions/console-dialog-actions';
import { AvatarCropper } from '../../../../shared/avatar-cropper/avatar-cropper';

/**
 * Creation of an application (`/dashboard/applications/new`). Editing an
 * existing one lives in the detail page's Aperçu tab;
 * the old `/edit` route redirects there.
 */
@Component({
  selector: 'app-application-form-page',
  imports: [
    ReactiveFormsModule,
    AppAlert,
    ApiErrorMessagePipe,
    ApplicationFormFields,
    PageHeader,
    RouterLink,
    ConsoleDialogActions,
    ButtonModule,
    AvatarCropper
],
  templateUrl: './application-form-page.html',
  styleUrl: './application-form-page.scss',
})
export class ApplicationFormPage {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(PushitApiService);
  private readonly consoleCopy = inject(ConsoleCopyService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly shell = inject(ConsoleShellService);
  readonly copy = computed(() => this.consoleCopy.current().applications);
  readonly billingCopy = computed(() => this.consoleCopy.current().billing);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: [''],
  });

  readonly pending = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);

  // The cropped logo waits here until the app exists (the upload endpoint needs
  // its id), then goes up right after creation.
  readonly pendingLogo = signal<File | null>(null);
  readonly logoPreview = signal<string | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => this.setPendingLogo(null));
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.pending.set(true);
    this.error.set(null);

    this.shell.createApp(
      this.form.getRawValue(),
      (app) => {
        // Land on the detail page's API tab, which reveals the freshly-created
        // one-time token (QR + raw token) via <app-token-reveal>: the shell stored
        // it via rememberGeneratedToken, and the detail page's revealToken()
        // surfaces it while it is still held. Without that reveal the token would
        // be lost -- so a failed logo upload still lands there, with a warning banner.
        const target = ['/dashboard/applications', app.id];
        const queryParams = { tab: 'api' };
        const logo = this.pendingLogo();
        if (!logo) {
          this.pending.set(false);
          void this.router.navigate(target, { queryParams });
          return;
        }
        this.api
          .uploadAppLogo(app.id, logo)
          .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.pending.set(false)))
          .subscribe({
            next: () => {
              this.shell.loadShell(app.id);
              void this.router.navigate(target, { queryParams });
            },
            error: () =>
              void this.router.navigate(target, {
                queryParams,
                state: { logoUploadFailed: true },
              }),
          });
      },
      (err) => {
        this.pending.set(false);
        const failure = coerceApiError(err);
        // Un refus de facturation dit precisement ce qui manque -- souscrire, ou
        // augmenter la quantite : ecraser ce detail par un « la creation a
        // echoue » generique laisserait l'utilisateur sans issue.
        this.error.set(
          this.isBillingRefusal(failure)
            ? failure
            : { code: 'application_create_failed', detail: this.copy().errors.create },
        );
      },
    );
  }

  /** Les deux 402 du gating de facturation, qui menent tous deux a la page dediee. */
  isBillingRefusal(error: ApiErrorResponse | null): boolean {
    return isBillingRefusal(error);
  }

  readonly billingRefused = computed(() => this.isBillingRefusal(this.error()));

  onLogoCropped(file: File): void {
    if (file) {
      this.setPendingLogo(file);
    }
  }

  removeLogo(): void {
    this.setPendingLogo(null);
  }

  private setPendingLogo(file: File | null): void {
    const previous = this.logoPreview();
    if (previous) {
      URL.revokeObjectURL(previous);
    }
    this.pendingLogo.set(file);
    this.logoPreview.set(file ? URL.createObjectURL(file) : null);
  }

  cancel(): void {
    void this.router.navigate(['/dashboard/applications']);
  }

  fieldErrors(fieldName: string): string[] {
    return errorFieldMessages(this.error(), fieldName);
  }
}
