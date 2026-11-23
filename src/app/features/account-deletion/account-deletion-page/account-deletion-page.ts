import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from '@openng/optimus-ui/button';

import { AppCopyService } from '../../../core/services/app-copy.service';

/**
 * Public, stable explanation of how to delete a PushIT account and what is
 * erased — the "account deletion URL" of the Google Play Data safety form.
 * Keep the route (`/account-deletion`) stable: it is registered on the store.
 */
@Component({
  selector: 'app-account-deletion-page',
  imports: [RouterLink, ButtonModule],
  templateUrl: './account-deletion-page.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './account-deletion-page.scss',
})
export class AccountDeletionPage {
  private readonly appCopy = inject(AppCopyService);

  readonly copy = computed(() => this.appCopy.current().accountDeletion);
}
