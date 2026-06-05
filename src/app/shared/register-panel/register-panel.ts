import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';

import { ApiErrorResponse } from '../../core/models/api.models';
import { getRuntimeConfig } from '../../core/runtime-config';
import { AppCopyService } from '../../core/services/app-copy.service';
import { LanguagePreferenceService } from '../../core/services/language-preference.service';
import { PushitApiService } from '../../core/services/pushit-api.service';
import { SessionService } from '../../core/services/session.service';
import { coerceApiError, errorFieldMessages } from '../../core/utils/api-error.utils';
import { AppAlert } from '../app-alert/app-alert';

interface TurnstileRenderOptions {
  sitekey: string;
  callback?: (token: string) => void;
  'error-callback'?: (error: string) => void;
  'expired-callback'?: () => void;
  theme?: 'light' | 'dark' | 'auto';
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: TurnstileRenderOptions) => string;
      reset: (widgetId?: string) => void;
      remove?: (widgetId: string) => void;
    };
  }
}

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
export class RegisterPanel implements AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly api = inject(PushitApiService);
  private readonly session = inject(SessionService);
  private readonly appCopy = inject(AppCopyService);
  readonly languagePreference = inject(LanguagePreferenceService);

  readonly title = input('');
  readonly subtitle = input('');
  readonly showLoginLink = input(true);

  // Empty when Turnstile is not provisioned → the widget is hidden and the
  // captcha is not enforced (the backend is gated on its secret the same way).
  protected readonly turnstileSiteKey = getRuntimeConfig().turnstileSiteKey;
  protected readonly turnstileEnabled = this.turnstileSiteKey.length > 0;

  readonly pending = signal(false);
  readonly registerError = signal<ApiErrorResponse | null>(null);
  readonly copy = computed(() => this.appCopy.current().registerPanel);
  readonly resolvedTitle = computed(() => this.title() || this.copy().defaultTitle);
  readonly resolvedSubtitle = computed(() => this.subtitle() || this.copy().defaultSubtitle);

  @ViewChild('turnstile', { static: false })
  protected turnstileContainer?: ElementRef<HTMLDivElement>;

  private turnstileWidgetId: string | null = null;
  private turnstileRetryTimer: ReturnType<typeof setTimeout> | null = null;

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

  ngAfterViewInit(): void {
    if (this.turnstileEnabled) {
      this.tryRenderTurnstile(0);
    }
  }

  ngOnDestroy(): void {
    if (this.turnstileRetryTimer !== null) clearTimeout(this.turnstileRetryTimer);
    if (this.turnstileWidgetId !== null && window.turnstile?.remove) {
      window.turnstile.remove(this.turnstileWidgetId);
      this.turnstileWidgetId = null;
    }
  }

  // Cloudflare's auto-render only scans the DOM once at script load. On a lazy
  // SPA route the #turnstile div arrives later, so we render explicitly once the
  // async <script> is ready, retrying a few times while it downloads.
  private tryRenderTurnstile(attempts: number): void {
    if (typeof window === 'undefined') return;
    if (!window.turnstile?.render) {
      if (attempts >= 20) return;
      this.turnstileRetryTimer = setTimeout(() => this.tryRenderTurnstile(attempts + 1), 500);
      return;
    }
    const container = this.turnstileContainer?.nativeElement;
    if (!container || this.turnstileWidgetId !== null) return;
    this.turnstileWidgetId = window.turnstile.render(container, {
      sitekey: this.turnstileSiteKey,
    });
  }

  private resetTurnstileWidget(): void {
    if (typeof window === 'undefined' || !window.turnstile?.reset) return;
    if (this.turnstileWidgetId !== null) {
      window.turnstile.reset(this.turnstileWidgetId);
    } else {
      window.turnstile.reset();
    }
  }

  private readTurnstileToken(): string {
    const input = document.querySelector<HTMLInputElement>(
      'input[name="cf-turnstile-response"]',
    );
    return input?.value ?? '';
  }

  submitRegister(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const registerPayload = this.registerForm.getRawValue();

    let turnstileToken = '';
    if (this.turnstileEnabled) {
      turnstileToken = this.readTurnstileToken();
      if (!turnstileToken) {
        this.registerError.set({ code: 'captcha_required', detail: this.copy().captchaRequired });
        return;
      }
    }

    this.registerError.set(null);
    this.pending.set(true);

    this.api
      .register({ ...registerPayload, ...(this.turnstileEnabled ? { turnstile_token: turnstileToken } : {}) })
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
          const apiError = coerceApiError(error);
          // A consumed/expired token can't be reused — re-arm the widget so the
          // user can solve it again, and surface a captcha-specific message.
          if (this.turnstileEnabled && apiError.code === 'captcha_failed') {
            this.resetTurnstileWidget();
            this.turnstileWidgetId = null;
            this.tryRenderTurnstile(0);
            apiError.detail = this.copy().captchaFailed;
          }
          this.registerError.set(apiError);
        },
      });
  }

  fieldErrors(fieldName: string): string[] {
    return errorFieldMessages(this.registerError(), fieldName);
  }
}
