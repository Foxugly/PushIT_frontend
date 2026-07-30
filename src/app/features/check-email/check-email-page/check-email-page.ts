import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';

import { AppCopyService } from '../../../core/services/app-copy.service';
import { PushitApiService } from '../../../core/services/pushit-api.service';
import { AppAlert } from '../../../shared/app-alert/app-alert';

@Component({
  selector: 'app-check-email-page',
  imports: [RouterLink, AppAlert, ButtonModule],
  templateUrl: './check-email-page.html',
  styleUrl: './check-email-page.scss',
})
export class CheckEmailPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly appCopy = inject(AppCopyService);
  private readonly api = inject(PushitApiService);
  private readonly router = inject(Router);

  // Email passed via router state from the register flow (may be absent on a direct hit).
  readonly email = signal<string>(
    (this.router.getCurrentNavigation()?.extras.state?.['email'] as string | undefined) ??
      (history.state?.['email'] as string | undefined) ??
      '',
  );
  readonly resent = signal(false);
  readonly resendPending = signal(false);
  readonly copy = computed(() => this.appCopy.current().checkEmail);

  resend(): void {
    if (!this.email() || this.resendPending()) return;
    this.resendPending.set(true);
    this.api
      .resendConfirmation(this.email())
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.resendPending.set(false)))
      .subscribe({ next: () => this.resent.set(true), error: () => this.resent.set(true) });
  }
}
