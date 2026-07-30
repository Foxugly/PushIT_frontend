import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { finalize } from 'rxjs';

import { ApiErrorResponse, ApplicationRead, SendToken } from '../../../../core/models/api.models';
import { ApiErrorMessagePipe } from '../../../../core/pipes/api-error-message.pipe';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { coerceApiError } from '../../../../core/utils/api-error.utils';
import { formatDateTimeFrBe } from '../../../../core/utils/date-format.utils';
import { interpolate } from '../../../../core/utils/string.utils';
import { AppAlert } from '../../../../shared/app-alert/app-alert';
import { AppConfirmService } from '../../../../shared/app-confirm-dialog/app-confirm.service';

/** How long a revealed token stays on screen before it hides itself. */
const REVEAL_TTL_MS = 20_000;

/**
 * The send tokens of one application: list, create, reveal, revoke.
 *
 * These are the real secrets — what authorises an emission. Several per
 * application on purpose: it is what lets a compromised token be replaced
 * without an interruption (create, deploy, then revoke the old one).
 *
 * A revealed value hides itself after a few seconds and is never rendered by
 * default. A token left on screen ends up in a screenshot or a shared window.
 */
@Component({
  selector: 'app-send-tokens-panel',
  imports: [
    FormsModule,
    AppAlert,
    ApiErrorMessagePipe,
    ButtonModule,
    InputTextModule,
    TableModule,
    TagModule,
    TooltipModule
],
  templateUrl: './send-tokens-panel.html',
  styleUrl: './send-tokens-panel.scss',
})
export class SendTokensPanel implements OnInit {
  private readonly api = inject(PushitApiService);
  private readonly consoleCopy = inject(ConsoleCopyService);
  private readonly confirm = inject(AppConfirmService);
  private readonly destroyRef = inject(DestroyRef);

  readonly app = input.required<ApplicationRead>();

  readonly copy = computed(() => this.consoleCopy.current().sendTokens);

  readonly tokens = signal<SendToken[]>([]);
  readonly loading = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly banner = signal<string | null>(null);

  readonly newName = signal('');
  readonly creating = signal(false);
  /** The freshly-created raw token — served once, by the creation itself. */
  readonly createdToken = signal<string | null>(null);

  /** Id of the token whose reveal form is open. */
  readonly revealingId = signal<number | null>(null);
  readonly revealPassword = signal('');
  readonly revealPending = signal(false);
  readonly revealedToken = signal<string | null>(null);
  readonly revealError = signal<ApiErrorResponse | null>(null);
  private revealTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.load();
    this.destroyRef.onDestroy(() => this.clearRevealTimer());
  }

  formatDateTime(value: string | null): string {
    return value ? formatDateTimeFrBe(value) : this.copy().never;
  }

  tokenSeverity(token: SendToken): 'success' | 'secondary' {
    return token.is_active ? 'success' : 'secondary';
  }

  create(): void {
    const name = this.newName().trim();
    if (!name) {
      return;
    }

    this.creating.set(true);
    this.error.set(null);
    this.api
      .createSendToken(this.app().id, name)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.creating.set(false)))
      .subscribe({
        next: ({ token, ...listed }) => {
          // The raw value goes to `createdToken` and nowhere else — pushing the
          // creation response as-is would keep the secret inside the list, which
          // outlives the one-time display it was meant to have.
          this.tokens.update((tokens) => [...tokens, listed]);
          this.createdToken.set(token);
          this.newName.set('');
        },
        error: (error) => this.error.set(coerceApiError(error)),
      });
  }

  openReveal(token: SendToken): void {
    this.hideRevealed();
    this.revealError.set(null);
    this.revealPassword.set('');
    this.revealingId.set(token.id);
  }

  closeReveal(): void {
    this.revealingId.set(null);
    this.revealPassword.set('');
    this.hideRevealed();
  }

  reveal(): void {
    const tokenId = this.revealingId();
    const password = this.revealPassword();
    if (tokenId === null || !password) {
      return;
    }

    this.revealPending.set(true);
    this.revealError.set(null);
    this.api
      .revealSendToken(this.app().id, tokenId, password)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.revealPending.set(false)))
      .subscribe({
        next: (result) => {
          this.revealedToken.set(result.token);
          this.revealPassword.set('');
          // Hide it again on its own: a token left on screen ends up in a
          // screenshot or a shared window.
          this.clearRevealTimer();
          this.revealTimer = setTimeout(() => this.hideRevealed(), REVEAL_TTL_MS);
        },
        error: (error) => this.revealError.set(coerceApiError(error)),
      });
  }

  hideRevealed(): void {
    this.clearRevealTimer();
    this.revealedToken.set(null);
  }

  async revoke(token: SendToken): Promise<void> {
    const confirmed = await this.confirm.ask({
      message: interpolate(this.copy().revokeConfirm, { name: token.name }),
    });
    if (!confirmed) {
      return;
    }

    this.api
      .revokeSendToken(this.app().id, token.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.tokens.update((tokens) =>
            tokens.map((item) =>
              item.id === token.id
                ? { ...item, is_active: false, revoked_at: new Date().toISOString() }
                : item,
            ),
          );
          this.banner.set(this.copy().revokedBanner);
        },
        error: (error) => this.error.set(coerceApiError(error)),
      });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .listSendTokens(this.app().id)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false)))
      .subscribe({
        next: (tokens) => this.tokens.set(tokens),
        error: (error) => this.error.set(coerceApiError(error)),
      });
  }

  private clearRevealTimer(): void {
    if (this.revealTimer !== null) {
      clearTimeout(this.revealTimer);
      this.revealTimer = null;
    }
  }
}
