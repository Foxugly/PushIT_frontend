import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';

import { ApiErrorResponse } from '../../../../core/models/api.models';
import { ApiErrorMessagePipe } from '../../../../core/pipes/api-error-message.pipe';
import { AppCopyService } from '../../../../core/services/app-copy.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { SessionService } from '../../../../core/services/session.service';
import { coerceApiError } from '../../../../core/utils/api-error.utils';
import { PageHeader } from '../../../../shared/page-header/page-header';

export const PASSWORD_MIN_LENGTH = 8;

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const pwd = group.get('newPassword')?.value as string;
  const confirm = group.get('confirmPassword')?.value as string;
  if (!pwd || !confirm) return null;
  return pwd === confirm ? null : { password_mismatch: true };
}

/** Backend codes this page translates itself; anything else goes through the
 * generic `apiError` pipe (network, 5xx, ...). */
type KnownErrorKey =
  | 'currentPasswordInvalid'
  | 'passwordUnchanged'
  | 'passwordInvalid'
  | 'validation'
  | 'throttled';

const KNOWN_ERRORS: Record<string, KnownErrorKey> = {
  current_password_invalid: 'currentPasswordInvalid',
  password_unchanged: 'passwordUnchanged',
  password_invalid: 'passwordInvalid',
  validation_error: 'validation',
  invalid: 'validation',
  throttled: 'throttled',
  http_429: 'throttled',
};

@Component({
  selector: 'app-change-password-page',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    MessageModule,
    PasswordModule,
    PageHeader,
    ApiErrorMessagePipe,
  ],
  templateUrl: './change-password-page.html',
  styleUrl: './change-password-page.scss',
})
export class ChangePasswordPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly appCopy = inject(AppCopyService);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(PushitApiService);
  private readonly session = inject(SessionService);

  readonly copy = computed(() => this.appCopy.current().console.changePassword);
  readonly pending = signal(false);
  readonly succeeded = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);

  /** Translation key for a backend code this page knows, else null. */
  readonly knownErrorKey = computed<KnownErrorKey | null>(() => {
    const code = this.error()?.code;
    return code ? (KNOWN_ERRORS[code] ?? null) : null;
  });

  /** Validator messages returned with `password_invalid`. */
  readonly validatorMessages = computed(() =>
    this.error()?.code === 'password_invalid' ? (this.error()?.errors?.['new_password'] ?? []) : [],
  );

  readonly form = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [passwordsMatch] },
  );

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword } = this.form.getRawValue();
    this.pending.set(true);
    this.error.set(null);
    this.succeeded.set(false);

    this.api
      .changePassword({ current_password: currentPassword, new_password: newPassword })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.pending.set(false)),
      )
      .subscribe({
        next: (response) => {
          // Every previous refresh token is now blacklisted server-side: store
          // the fresh pair or the next refresh would sign this session out.
          this.session.adoptTokens(response);
          this.form.reset();
          this.succeeded.set(true);
        },
        error: (err) => this.error.set(coerceApiError(err)),
      });
  }

  showFieldError(name: 'currentPassword' | 'newPassword' | 'confirmPassword', error: string): boolean {
    const control = this.form.controls[name];
    return control.touched && control.hasError(error);
  }
}
