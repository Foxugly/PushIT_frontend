import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { BillingSubscription, UserLanguage } from '../../../../core/models/api.models';
import { AppCopyService } from '../../../../core/services/app-copy.service';
import { BillingService } from '../../../../core/services/billing.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { LanguagePreferenceService } from '../../../../core/services/language-preference.service';
import { AppAlert, AppAlertTone } from '../../../../shared/app-alert/app-alert';
import { PageHeader } from '../../../../shared/page-header/page-header';
import { ChangePasswordPanel } from '../../components/change-password-panel/change-password-panel';
import { DeleteAccountPanel } from '../../components/delete-account-panel/delete-account-panel';

type BannerKey = 'languageSaved' | 'userkeyCopied' | 'copyFailed';

/** Le quota « illimité » du backend (`billing.service.UNLIMITED`). */
const UNLIMITED_QUOTA = 10_000;

/** État de la carte « Abonnement » : rien n'est affiché tant que la lecture n'a pas abouti. */
type SubscriptionState =
  | { kind: 'loading' }
  | { kind: 'loaded'; subscription: BillingSubscription }
  | { kind: 'error' };

/**
 * « Mon compte » — one column of cards: the account (e-mail, userkey, language
 * saved on change), the subscription (read-only summary, managed on
 * `/dashboard/billing`), security (change password) and the danger zone (delete).
 * The API base URL comes from the runtime config and has no UI here.
 */
@Component({
  selector: 'app-settings-page',
  imports: [
    PageHeader,
    ReactiveFormsModule,
    AppAlert,
    ChangePasswordPanel,
    DeleteAccountPanel,
    ButtonModule,
    DatePipe,
    RouterLink,
    SelectModule,
    TagModule,
    TooltipModule,
  ],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
})
export class SettingsPage {
  private readonly appCopy = inject(AppCopyService);
  private readonly billing = inject(BillingService);
  private readonly destroyRef = inject(DestroyRef);
  readonly shell = inject(ConsoleShellService);
  readonly languagePreference = inject(LanguagePreferenceService);

  readonly copy = computed(() => this.appCopy.current().console.settings);
  readonly subscriptionCopy = computed(() => this.copy().subscription);
  private readonly planNames = computed(() => this.appCopy.current().pricing);
  readonly subscriptionState = signal<SubscriptionState>({ kind: 'loading' });
  /** Copy key rather than text: a language change re-translates the alert it raised. */
  readonly banner = signal<{ key: BannerKey; tone: AppAlertTone } | null>(null);
  readonly bannerMessage = computed(() => {
    const banner = this.banner();
    return banner ? this.copy()[banner.key] : '';
  });
  readonly language = new FormControl<UserLanguage>(this.languagePreference.currentBackendLanguage(), {
    nonNullable: true,
  });

  constructor() {
    this.loadSubscription();

    // Follow a language changed elsewhere (top-bar switcher, backend profile).
    effect(() => {
      const language = this.languagePreference.currentBackendLanguage();
      if (this.language.value !== language) {
        this.language.setValue(language, { emitEvent: false });
      }
    });
  }

  /**
   * Lecture seule, servie depuis le cache local du backend. Une panne ne doit
   * jamais casser « Mon compte » : la carte dit seulement qu'elle n'a pas pu lire.
   */
  private loadSubscription(): void {
    this.billing
      .subscription()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (subscription) => this.subscriptionState.set({ kind: 'loaded', subscription }),
        error: () => this.subscriptionState.set({ kind: 'error' }),
      });
  }

  /** Nom de la formule (codes `app` / `unlimited`) ; code brut si inconnu. */
  planName(plan: string): string {
    const names = this.planNames();
    if (plan === 'app') {
      return names.perApp.name;
    }
    if (plan === 'unlimited') {
      return names.unlimited.name;
    }
    return plan;
  }

  intervalLabel(interval: string): string {
    const copy = this.subscriptionCopy();
    if (interval === 'yearly') {
      return copy.intervalYearly;
    }
    if (interval === 'monthly') {
      return copy.intervalMonthly;
    }
    return '';
  }

  /** « 2 / 5 », ou « 2 / illimité » pour le forfait. */
  usage(subscription: BillingSubscription): string {
    const quota =
      subscription.quota >= UNLIMITED_QUOTA
        ? this.subscriptionCopy().unlimited
        : String(subscription.quota);
    return `${subscription.applicationsUsed} / ${quota}`;
  }

  saveLanguage(language: UserLanguage): void {
    this.languagePreference.updateLanguage(this.languagePreference.toFrontendLanguage(language));
    // No shell reload: with no app yet, the console layout swaps the router
    // outlet for its loading card, which would recreate this page and drop the alert.
    this.banner.set({ key: 'languageSaved', tone: 'success' });
  }

  async copyUserkey(): Promise<void> {
    const userkey = this.shell.user()?.userkey;
    if (!userkey) {
      return;
    }
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(userkey);
      this.banner.set({ key: 'userkeyCopied', tone: 'success' });
    } catch {
      this.banner.set({ key: 'copyFailed', tone: 'danger' });
    }
  }
}
