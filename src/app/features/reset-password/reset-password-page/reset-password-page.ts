import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';

import { ApiErrorResponse } from '../../../core/models/api.models';
import { AppCopyService } from '../../../core/services/app-copy.service';
import { PushitApiService } from '../../../core/services/pushit-api.service';
import { coerceApiError } from '../../../core/utils/api-error.utils';
import { AppAlert } from '../../../shared/app-alert/app-alert';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const pwd = group.get('password')?.value as string;
  const confirm = group.get('confirm_password')?.value as string;
  if (!pwd || !confirm) return null;
  return pwd === confirm ? null : { password_mismatch: true };
}

@Component({
  selector: 'app-reset-password-page',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AppAlert, ButtonModule, PasswordModule],
  templateUrl: './reset-password-page.html',
  styleUrl: './reset-password-page.scss',
})
export class ResetPasswordPage {
  private readonly appCopy = inject(AppCopyService);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(PushitApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly uid = this.route.snapshot.paramMap.get('uid') ?? '';
  private readonly token = this.route.snapshot.paramMap.get('token') ?? '';

  readonly pending = signal(false);
  readonly succeeded = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly copy = computed(() => this.appCopy.current().resetPassword);

  readonly form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm_password: ['', [Validators.required]],
    },
    { validators: [passwordsMatch] },
  );

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.pending.set(true);
    this.error.set(null);

    this.api
      .resetPassword(this.uid, this.token, this.form.getRawValue().password)
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: () => this.succeeded.set(true),
        error: (err) => this.error.set(coerceApiError(err)),
      });
  }

  goToLogin(): void {
    void this.router.navigate(['/auth']);
  }
}
