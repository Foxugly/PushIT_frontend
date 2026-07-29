import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

import { ApiErrorResponse } from '../../../core/models/api.models';
import { AppCopyService } from '../../../core/services/app-copy.service';
import { PushitApiService } from '../../../core/services/pushit-api.service';
import { coerceApiError } from '../../../core/utils/api-error.utils';
import { AppAlert } from '../../../shared/app-alert/app-alert';
import { ApiErrorMessagePipe } from '../../../core/pipes/api-error-message.pipe';
import { TurnstileController } from '../../../shared/turnstile/turnstile';

@Component({
  selector: 'app-forgot-password-page',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AppAlert, ApiErrorMessagePipe, ButtonModule, InputTextModule],
  templateUrl: './forgot-password-page.html',
  styleUrl: './forgot-password-page.scss',
})
export class ForgotPasswordPage implements AfterViewInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly appCopy = inject(AppCopyService);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(PushitApiService);

  protected readonly turnstile = new TurnstileController();

  readonly submitted = signal(false);
  readonly pending = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly copy = computed(() => this.appCopy.current().forgotPassword);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  @ViewChild('turnstile', { static: false })
  protected turnstileContainer?: ElementRef<HTMLDivElement>;

  ngAfterViewInit(): void {
    this.turnstile.render(this.turnstileContainer?.nativeElement);
  }

  ngOnDestroy(): void {
    this.turnstile.destroy();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    let turnstileToken = '';
    if (this.turnstile.enabled) {
      turnstileToken = this.turnstile.readToken();
      if (!turnstileToken) {
        this.error.set({ code: 'captcha_required', detail: this.copy().captchaRequired });
        return;
      }
    }

    this.pending.set(true);
    this.error.set(null);

    this.api.forgotPassword(this.form.getRawValue().email, turnstileToken || undefined).subscribe({
      next: () => {
        this.pending.set(false);
        this.submitted.set(true);
      },
      error: (err) => {
        this.pending.set(false);
        const apiError = coerceApiError(err);
        if (this.turnstile.enabled && apiError.code === 'captcha_failed') {
          this.turnstile.reset();
          apiError.detail = this.copy().captchaFailed;
        }
        this.error.set(apiError);
      },
    });
  }
}
