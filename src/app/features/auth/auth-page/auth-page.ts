import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { ApiErrorMessagePipe } from '../../../core/pipes/api-error-message.pipe';
import { TurnstileController } from '../../../shared/turnstile/turnstile';

@Component({
  selector: 'app-auth-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    AppAlert, ApiErrorMessagePipe,
    ButtonModule,
    CheckboxModule,
    InputTextModule,
    PasswordModule,
  ],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.scss',
})
export class AuthPage implements OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly api = inject(PushitApiService);
  private readonly session = inject(SessionService);
  private readonly appCopy = inject(AppCopyService);
  private readonly languagePreference = inject(LanguagePreferenceService);

  protected readonly turnstile = new TurnstileController();

  readonly loginPending = signal(false);
  readonly loginError = signal<ApiErrorResponse | null>(null);
  readonly copy = computed(() => this.appCopy.current().auth);

  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    rememberMe: [false],
  });

  // Passwordless magic-link ("ou" divider → inline email-only mode). Mirrors the
  // fleet reference (FoxRunner login magicMode toggle).
  readonly magicMode = signal(false);
  readonly magicPending = signal(false);
  readonly magicSent = signal(false);
  readonly magicError = signal<ApiErrorResponse | null>(null);
  readonly magicForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  private readonly magicTurnstileRef = viewChild<ElementRef<HTMLDivElement>>('magicTurnstile');

  constructor() {
    // The Turnstile container only exists once the inline magic form is shown
    // (@if), so render the widget when it appears. No-op when the captcha isn't
    // provisioned (empty site key) — dev/e2e never render it.
    effect(() => {
      const container = this.magicTurnstileRef()?.nativeElement;
      if (this.magicMode() && container) {
        this.turnstile.render(container);
      }
    });
  }

  ngOnDestroy(): void {
    this.turnstile.destroy();
  }

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
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loginPending.set(false)))
      .subscribe({
        next: (response) => {
          this.session.startSession(response, this.loginForm.getRawValue().rememberMe);
          this.languagePreference.applyBackendLanguage(response.user.language);
          void this.router.navigate(['/dashboard']);
        },
        error: (error) => {
          const apiError = coerceApiError(error);
          // Unconfirmed email: send them to the "check your email" page (with resend)
          // instead of a dead-end error.
          if (apiError.code === 'email_not_verified') {
            void this.router.navigate(['/auth/check-email'], {
              state: { email: this.loginForm.getRawValue().email },
            });
            return;
          }
          this.loginError.set(apiError);
        },
      });
  }

  enterMagicMode(): void {
    this.loginError.set(null);
    this.magicError.set(null);
    this.magicSent.set(false);
    this.magicForm.reset({ email: this.loginForm.getRawValue().email });
    this.magicMode.set(true);
  }

  exitMagicMode(): void {
    this.turnstile.destroy();
    this.magicMode.set(false);
  }

  submitMagic(): void {
    if (this.magicForm.invalid) {
      this.magicForm.markAllAsTouched();
      return;
    }

    let turnstileToken = '';
    if (this.turnstile.enabled) {
      turnstileToken = this.turnstile.readToken();
      if (!turnstileToken) {
        this.magicError.set({ code: 'captcha_required', detail: this.copy().magicCaptchaRequired });
        return;
      }
    }

    this.magicError.set(null);
    this.magicPending.set(true);

    this.api
      .requestMagicLink(this.magicForm.getRawValue().email, turnstileToken || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.magicPending.set(false)))
      .subscribe({
        next: () => this.magicSent.set(true),
        error: (error) => {
          const apiError = coerceApiError(error);
          if (this.turnstile.enabled && apiError.code === 'captcha_failed') {
            this.turnstile.reset();
            apiError.detail = this.copy().magicCaptchaFailed;
          }
          this.magicError.set(apiError);
        },
      });
  }

  fieldErrors(error: ApiErrorResponse | null, fieldName: string): string[] {
    return errorFieldMessages(error, fieldName);
  }
}
