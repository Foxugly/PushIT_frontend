import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';

import { ApiErrorResponse } from '../../core/models/api.models';
import { AppCopyService } from '../../core/services/app-copy.service';
import { LanguagePreferenceService } from '../../core/services/language-preference.service';
import { PushitApiService } from '../../core/services/pushit-api.service';
import { SessionService } from '../../core/services/session.service';
import { coerceApiError, errorFieldMessages } from '../../core/utils/api-error.utils';
import { AppAlert } from '../app-alert/app-alert';

@Component({
  selector: 'app-register-panel',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    AppAlert,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    SelectModule,
    TextareaModule,
  ],
  templateUrl: './register-panel.html',
  styleUrl: './register-panel.scss',
})
export class RegisterPanel {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly api = inject(PushitApiService);
  private readonly session = inject(SessionService);
  private readonly appCopy = inject(AppCopyService);
  readonly languagePreference = inject(LanguagePreferenceService);

  readonly title = input('');
  readonly subtitle = input('');
  readonly showLoginLink = input(true);

  readonly pending = signal(false);
  readonly registerError = signal<ApiErrorResponse | null>(null);
  readonly copy = computed(() => this.appCopy.current().registerPanel);
  readonly resolvedTitle = computed(() => this.title() || this.copy().defaultTitle);
  readonly resolvedSubtitle = computed(() => this.subtitle() || this.copy().defaultSubtitle);

  readonly registerForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    username: ['', [Validators.required, Validators.maxLength(150)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    language: [this.languagePreference.currentBackendLanguage(), [Validators.required]],
  });

  constructor() {
    effect(() => {
      const language = this.languagePreference.currentBackendLanguage();
      if (!this.registerForm.controls.language.dirty) {
        this.registerForm.patchValue({ language }, { emitEvent: false });
      }
    });
  }

  submitRegister(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const registerPayload = this.registerForm.getRawValue();
    this.registerError.set(null);
    this.pending.set(true);

    this.api
      .register(registerPayload)
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: () => {
          this.api
            .login({
              email: registerPayload.email,
              password: registerPayload.password,
            })
            .subscribe({
              next: (response) => {
                this.session.startSession(response, true);
                this.languagePreference.applyBackendLanguage(response.user.language);
                void this.router.navigate(['/dashboard']);
              },
              error: () => {
                void this.router.navigate(['/auth']);
              },
            });
        },
        error: (error) => {
          this.registerError.set(coerceApiError(error));
        },
      });
  }

  fieldErrors(fieldName: string): string[] {
    return errorFieldMessages(this.registerError(), fieldName);
  }
}
