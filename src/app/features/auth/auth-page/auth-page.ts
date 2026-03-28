import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';

import { ApiErrorResponse } from '../../../core/models/api.models';
import { AppCopyService } from '../../../core/services/app-copy.service';
import { LanguagePreferenceService } from '../../../core/services/language-preference.service';
import { PushitApiService } from '../../../core/services/pushit-api.service';
import { SessionService } from '../../../core/services/session.service';
import { coerceApiError, errorFieldMessages } from '../../../core/utils/api-error.utils';
import { AppAlert } from '../../../shared/app-alert/app-alert';

@Component({
  selector: 'app-auth-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    AppAlert,
    ButtonModule,
    CheckboxModule,
    InputTextModule,
    PasswordModule,
  ],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.scss',
})
export class AuthPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly api = inject(PushitApiService);
  private readonly session = inject(SessionService);
  private readonly appCopy = inject(AppCopyService);
  private readonly languagePreference = inject(LanguagePreferenceService);

  readonly loginPending = signal(false);
  readonly loginError = signal<ApiErrorResponse | null>(null);
  readonly copy = computed(() => this.appCopy.current().auth);

  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    rememberMe: [false],
  });

  submitLogin(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loginError.set(null);
    this.loginPending.set(true);

    this.api
      .login({
        email: this.loginForm.getRawValue().email,
        password: this.loginForm.getRawValue().password,
      })
      .pipe(finalize(() => this.loginPending.set(false)))
      .subscribe({
        next: (response) => {
          this.session.startSession(response, this.loginForm.getRawValue().rememberMe);
          this.languagePreference.applyBackendLanguage(response.user.language);
          void this.router.navigate(['/dashboard']);
        },
        error: (error) => {
          this.loginError.set(coerceApiError(error));
        },
      });
  }

  fieldErrors(error: ApiErrorResponse | null, fieldName: string): string[] {
    return errorFieldMessages(error, fieldName);
  }
}
