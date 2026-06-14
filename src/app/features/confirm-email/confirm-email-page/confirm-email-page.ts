import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

import { ApiErrorResponse } from '../../../core/models/api.models';
import { AppCopyService } from '../../../core/services/app-copy.service';
import { LanguagePreferenceService } from '../../../core/services/language-preference.service';
import { PushitApiService } from '../../../core/services/pushit-api.service';
import { SessionService } from '../../../core/services/session.service';
import { coerceApiError } from '../../../core/utils/api-error.utils';
import { AppAlert } from '../../../shared/app-alert/app-alert';

@Component({
  selector: 'app-confirm-email-page',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AppAlert, ButtonModule, InputTextModule],
  templateUrl: './confirm-email-page.html',
  styleUrl: './confirm-email-page.scss',
})
export class ConfirmEmailPage implements OnInit {
  private readonly appCopy = inject(AppCopyService);
  private readonly api = inject(PushitApiService);
  private readonly session = inject(SessionService);
  private readonly languagePreference = inject(LanguagePreferenceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly fb = inject(FormBuilder);

  private readonly uid = this.route.snapshot.paramMap.get('uid') ?? '';
  private readonly token = this.route.snapshot.paramMap.get('token') ?? '';

  readonly confirming = signal(true);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly resent = signal(false);
  readonly resendPending = signal(false);
  readonly copy = computed(() => this.appCopy.current().confirmEmail);

  readonly resendForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  ngOnInit(): void {
    // The uid/token are captured above; strip them from the URL bar + history
    // so the single-use credentials don't linger in history / referer headers.
    this.location.replaceState('/auth/confirm-email');

    this.api
      .confirmEmail(this.uid, this.token)
      .pipe(finalize(() => this.confirming.set(false)))
      .subscribe({
        next: (response) => {
          this.session.startSession(response, true);
          this.languagePreference.applyBackendLanguage(response.user.language);
          void this.router.navigate(['/dashboard']);
        },
        error: (err) => this.error.set(coerceApiError(err)),
      });
  }

  resend(): void {
    if (this.resendForm.invalid) {
      this.resendForm.markAllAsTouched();
      return;
    }
    this.resendPending.set(true);
    this.api
      .resendConfirmation(this.resendForm.getRawValue().email)
      .pipe(finalize(() => this.resendPending.set(false)))
      .subscribe({ next: () => this.resent.set(true), error: () => this.resent.set(true) });
  }
}
