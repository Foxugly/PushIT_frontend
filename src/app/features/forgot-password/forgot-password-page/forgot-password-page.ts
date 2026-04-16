import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

import { ApiErrorResponse } from '../../../core/models/api.models';
import { AppCopyService } from '../../../core/services/app-copy.service';
import { PushitApiService } from '../../../core/services/pushit-api.service';
import { coerceApiError } from '../../../core/utils/api-error.utils';
import { AppAlert } from '../../../shared/app-alert/app-alert';

@Component({
  selector: 'app-forgot-password-page',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AppAlert, ButtonModule, InputTextModule],
  templateUrl: './forgot-password-page.html',
  styleUrl: './forgot-password-page.scss',
})
export class ForgotPasswordPage {
  private readonly appCopy = inject(AppCopyService);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(PushitApiService);

  readonly submitted = signal(false);
  readonly pending = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly copy = computed(() => this.appCopy.current().forgotPassword);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.pending.set(true);
    this.error.set(null);

    this.api.forgotPassword(this.form.getRawValue().email).subscribe({
      next: () => {
        this.pending.set(false);
        this.submitted.set(true);
      },
      error: (err) => {
        this.pending.set(false);
        this.error.set(coerceApiError(err));
      },
    });
  }
}
