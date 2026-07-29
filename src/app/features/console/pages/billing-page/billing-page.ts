import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';

import { ApiErrorMessagePipe } from '../../../../core/pipes/api-error-message.pipe';
import {
  ApiErrorResponse,
  BillingHistory,
  BillingInterval,
  BillingPlan,
  BillingQuantityPreview,
  BillingSubscription,
  BillingSubscriptionEntry,
} from '../../../../core/models/api.models';
import { BillingService } from '../../../../core/services/billing.service';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { PublicI18nService } from '../../../../core/services/public-i18n.service';
import { coerceApiError } from '../../../../core/utils/api-error.utils';
import { interpolate } from '../../../../core/utils/string.utils';
import { AppAlert } from '../../../../shared/app-alert/app-alert';
import { PageHeader } from '../../../../shared/page-header/page-header';

/** Statuts Stripe qui se lisent « cet abonnement tourne ». */
const LIVE_STATUSES = new Set(['active', 'trialing']);

/**
 * Facturation du compte : ce qui tourne, combien d'applications c'est censé
 * couvrir, le catalogue, et l'historique avec ses factures.
 *
 * Le fil conducteur est la transparence. Les montants sont annoncés hors TVA et
 * dits comme tels ; surtout, un changement de quantité passe par un aperçu
 * obligatoire — le prorata d'un ajustement en cours de période n'est pas
 * devinable, et prélever sans l'avoir annoncé serait un prélèvement à l'aveugle.
 */
@Component({
  selector: 'app-billing-page',
  imports: [
    CommonModule,
    FormsModule,
    ApiErrorMessagePipe,
    AppAlert,
    ButtonModule,
    InputNumberModule,
    PageHeader,
    SelectButtonModule,
    TagModule,
  ],
  templateUrl: './billing-page.html',
  styleUrl: './billing-page.scss',
})
export class BillingPage implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly billing = inject(BillingService);
  private readonly consoleCopy = inject(ConsoleCopyService);
  private readonly i18n = inject(PublicI18nService);
  private readonly route = inject(ActivatedRoute);

  readonly copy = computed(() => this.consoleCopy.current().billing);

  readonly loading = signal(true);
  readonly subscription = signal<BillingSubscription | null>(null);
  readonly plans = signal<BillingPlan[]>([]);
  readonly history = signal<BillingHistory | null>(null);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly notice = signal<string>('');

  /** Quantité choisie dans le catalogue, par code de plan. */
  readonly desiredQuantity = signal<Record<string, number>>({});
  readonly interval = signal<BillingInterval>('monthly');
  readonly pendingPlan = signal<string>('');

  /** Ajustement d'un abonnement en cours. */
  readonly newQuantity = signal<number>(1);
  readonly preview = signal<BillingQuantityPreview | null>(null);
  readonly previewPending = signal(false);
  readonly applyPending = signal(false);

  readonly intervalOptions = computed(() => [
    { label: this.copy().intervalMonthly, value: 'monthly' as BillingInterval },
    { label: this.copy().intervalYearly, value: 'yearly' as BillingInterval },
  ]);

  /** Le plan actuellement souscrit, s'il est encore au catalogue. */
  readonly currentPlan = computed(() => {
    const code = this.subscription()?.plan ?? '';
    return this.plans().find((plan) => plan.code === code) ?? null;
  });

  /** L'ajustement de quantité n'a de sens que sur un plan facturé à l'unité. */
  readonly canAdjustQuantity = computed(() => {
    const sub = this.subscription();
    return !!sub?.isPaid && !!this.currentPlan()?.per_unit_quota_key;
  });

  ngOnInit(): void {
    // Au retour du Checkout on force un aller-retour vers le central : le
    // webhook n'est peut-être pas encore arrivé, et l'utilisateur verrait
    // « aucun abonnement » juste après avoir payé.
    const justPaid = this.route.snapshot.queryParamMap.get('checkout') === 'success';
    if (justPaid) {
      this.notice.set(this.copy().checkoutSuccess);
    }
    this.load(justPaid);
  }

  private load(refresh = false): void {
    this.loading.set(true);
    this.billing.subscription(refresh).subscribe({
      next: (status) => {
        this.subscription.set(status);
        this.newQuantity.set(Math.max(1, status.quota || 1));
        this.loading.set(false);
        if (status.billingEnabled) {
          this.loadCatalogue();
          this.loadHistory();
        }
      },
      error: (err) => {
        this.error.set(coerceApiError(err));
        this.loading.set(false);
      },
    });
  }

  private loadCatalogue(): void {
    this.billing.plans().subscribe({
      // Le catalogue est secondaire : sans lui la page reste utile.
      next: (plans) => {
        this.plans.set(plans);
        this.desiredQuantity.set(Object.fromEntries(plans.map((plan) => [plan.code, 1])));
      },
      error: () => this.plans.set([]),
    });
  }

  private loadHistory(): void {
    this.billing.history().subscribe({
      next: (history) => this.history.set(history),
      error: () => this.history.set(null),
    });
  }

  // --- Catalogue ---------------------------------------------------------------

  isPerUnit(plan: BillingPlan): boolean {
    return !!plan.per_unit_quota_key;
  }

  quantityFor(plan: BillingPlan): number {
    return this.desiredQuantity()[plan.code] ?? 1;
  }

  setQuantityFor(plan: BillingPlan, quantity: number | null): void {
    this.desiredQuantity.update((current) => ({
      ...current,
      [plan.code]: Math.max(1, quantity ?? 1),
    }));
  }

  /** Prix unitaire du plan pour l'intervalle choisi, en centimes, ou null. */
  unitAmount(plan: BillingPlan): number | null {
    return plan.prices[this.interval()]?.amount ?? null;
  }

  currencyOf(plan: BillingPlan): string {
    return plan.prices[this.interval()]?.currency ?? 'EUR';
  }

  /** Ce que l'utilisateur paiera par période, hors TVA, pour la quantité choisie. */
  totalFor(plan: BillingPlan): string {
    const unit = this.unitAmount(plan);
    if (unit === null) {
      return '';
    }
    const quantity = this.isPerUnit(plan) ? this.quantityFor(plan) : 1;
    return this.money(unit * quantity, this.currencyOf(plan));
  }

  /**
   * L'essai n'est accordé qu'à une première souscription d'un seul exemplaire :
   * l'annoncer quand la quantité choisie est plus grande serait mensonger.
   */
  showsTrial(plan: BillingPlan): boolean {
    return plan.trial_days > 0 && (!this.isPerUnit(plan) || this.quantityFor(plan) === 1);
  }

  trialLabel(plan: BillingPlan): string {
    return interpolate(this.copy().trialDays, { days: String(plan.trial_days) });
  }

  subscribe(plan: BillingPlan): void {
    if (this.unitAmount(plan) === null) {
      return;
    }
    this.pendingPlan.set(plan.code);
    this.error.set(null);
    const quantity = this.isPerUnit(plan) ? this.quantityFor(plan) : 1;
    this.billing.checkout(plan.code, this.interval(), quantity).subscribe({
      next: ({ url }) => {
        window.location.href = url;
      },
      error: (err) => {
        this.pendingPlan.set('');
        this.error.set(coerceApiError(err));
      },
    });
  }

  openPortal(): void {
    this.error.set(null);
    this.billing.portal().subscribe({
      next: ({ url }) => {
        window.location.href = url;
      },
      error: (err) => this.error.set(coerceApiError(err)),
    });
  }

  // --- Ajustement de quantité --------------------------------------------------

  askPreview(): void {
    this.preview.set(null);
    this.error.set(null);
    this.previewPending.set(true);
    this.billing.previewQuantity(this.newQuantity()).subscribe({
      next: (preview) => {
        this.preview.set(preview);
        this.previewPending.set(false);
      },
      error: (err) => {
        this.error.set(coerceApiError(err));
        this.previewPending.set(false);
      },
    });
  }

  /** N'est proposé qu'après un aperçu : rien n'est prélevé sans avoir été annoncé. */
  applyQuantity(): void {
    const preview = this.preview();
    if (!preview) {
      return;
    }
    this.applyPending.set(true);
    this.error.set(null);
    this.billing.setQuantity(preview.new_quantity).subscribe({
      next: () => {
        this.applyPending.set(false);
        this.preview.set(null);
        this.notice.set(this.copy().quantityApplied);
        // Le droit est recalculé et poussé par le webhook Stripe ; on retire le
        // nouvel état du backend plutôt que de le deviner ici.
        this.load(true);
      },
      error: (err) => {
        this.applyPending.set(false);
        this.error.set(coerceApiError(err));
      },
    });
  }

  /** Le montant du prorata, formulé selon son signe : prélèvement ou avoir. */
  previewSentence(preview: BillingQuantityPreview): string {
    const amount = this.money(Math.abs(preview.amount_due_now), preview.currency);
    const template = preview.amount_due_now < 0 ? this.copy().previewCredit : this.copy().previewCharge;
    return interpolate(template, {
      from: String(preview.current_quantity),
      to: String(preview.new_quantity),
      amount,
    });
  }

  // --- Historique --------------------------------------------------------------

  isLive(entry: BillingSubscriptionEntry): boolean {
    return LIVE_STATUSES.has(entry.status);
  }

  /** Un abonnement résilié s'est arrêté à sa résiliation ; sinon il court jusqu'à la fin de période. */
  endDate(entry: BillingSubscriptionEntry): string | null {
    return entry.canceledAt ?? entry.currentPeriodEnd;
  }

  planLabel(entry: BillingSubscriptionEntry): string {
    return entry.planName || entry.plan || '—';
  }

  statusLabel(status: string): string {
    // Le catalogue est type par cles litterales ; Stripe peut renvoyer un statut
    // que la copie ne couvre pas encore -- on retombe alors sur le code brut
    // plutot que d'afficher une case vide.
    const known = this.copy().statuses as Record<string, string>;
    return known[status] ?? status;
  }

  /** Les montants Stripe sont dans l'unité mineure de la devise. */
  money(cents: number, currency: string): string {
    return new Intl.NumberFormat(this.i18n.language(), {
      style: 'currency',
      currency: currency || 'EUR',
    }).format(cents / 100);
  }
}
