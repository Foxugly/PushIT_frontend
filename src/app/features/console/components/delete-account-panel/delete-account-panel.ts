import { ApplicationRef, Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { finalize } from 'rxjs';

import { CatalogStore } from '../../../../core/i18n/catalog-store';
import { AppCopyService } from '../../../../core/services/app-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { PublicI18nService } from '../../../../core/services/public-i18n.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { SessionService } from '../../../../core/services/session.service';
import { coerceApiError } from '../../../../core/utils/api-error.utils';
import { apiErrorCopy, localizeApiError } from '../../../../core/utils/api-error-copy';

export const DELETE_ACCOUNT_CONFIRM_KEY = 'delete-account';

/**
 * « Supprimer mon compte » (RGPD art. 17) — `DELETE /auth/me/`.
 *
 * The confirmation dialog states what goes with the account (the owned
 * applications, for every subscriber) and carries the password field: the
 * dialog stays open on a wrong password so the user can retry in place.
 *
 * On 204 the backend has already blacklisted every refresh token, so there is
 * nothing to log out from: the local session is dropped and the user lands on
 * the home page with a confirmation toast.
 */
@Component({
  selector: 'app-delete-account-panel',
  imports: [ReactiveFormsModule, RouterLink, ButtonModule, ConfirmDialogModule, MessageModule, PasswordModule],
  providers: [ConfirmationService],
  templateUrl: './delete-account-panel.html',
  styleUrl: './delete-account-panel.scss',
})
export class DeleteAccountPanel {
  private readonly api = inject(PushitApiService);
  private readonly session = inject(SessionService);
  private readonly shell = inject(ConsoleShellService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly appCopy = inject(AppCopyService);
  private readonly catalogs = inject(CatalogStore);
  private readonly i18n = inject(PublicI18nService);
  private readonly appRef = inject(ApplicationRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly confirmKey = DELETE_ACCOUNT_CONFIRM_KEY;
  readonly copy = computed(() => this.appCopy.current().console.settings.deleteAccount);

  readonly password = new FormControl('', { nonNullable: true });
  readonly pending = signal(false);
  /** Already-localized message shown in the dialog (an error never fades on its own). */
  readonly error = signal<string | null>(null);

  open(): void {
    this.password.reset('');
    this.error.set(null);
    this.confirmation.confirm({ key: this.confirmKey, header: this.copy().dialogTitle });
  }

  cancel(): void {
    if (this.pending()) {
      return;
    }
    this.confirmation.close();
  }

  submit(): void {
    if (this.pending()) {
      return;
    }
    const currentPassword = this.password.value;
    if (!currentPassword) {
      this.error.set(this.copy().passwordRequired);
      return;
    }

    this.pending.set(true);
    this.error.set(null);
    this.api
      .deleteMe(currentPassword)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.pending.set(false)),
      )
      .subscribe({
        next: () => this.onDeleted(),
        error: (err: unknown) => this.error.set(this.errorMessage(err)),
      });
  }

  private onDeleted(): void {
    const success = this.copy().success;
    this.confirmation.close();
    this.password.reset('');
    this.shell.clearGeneratedToken();
    // Every refresh token is already blacklisted server-side: no logout call.
    this.session.clear();
    void this.router.navigateByUrl('/').then(() => {
      // The console layout (and its <p-toast>) is gone; wait for the public
      // layout's toast to be rendered, otherwise the message is dropped.
      afterNextRender(
        () => this.messages.add({ severity: 'success', summary: success, life: 8000 }),
        { injector: this.appRef.injector },
      );
    });
  }

  private errorMessage(err: unknown): string {
    const apiError = coerceApiError(err);
    if (apiError.code === 'current_password_invalid') {
      return this.copy().passwordInvalid;
    }
    if (apiError.code === 'validation_error') {
      return this.copy().passwordRequired;
    }
    return localizeApiError(apiError, apiErrorCopy(this.catalogs, this.i18n.language()));
  }
}
