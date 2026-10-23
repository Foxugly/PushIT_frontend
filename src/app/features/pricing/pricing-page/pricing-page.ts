import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { BillingSubscription } from '../../../core/models/api.models';
import { AppCopyService } from '../../../core/services/app-copy.service';
import { BillingService } from '../../../core/services/billing.service';
import { SessionService } from '../../../core/services/session.service';

/** Codes de plan du central (PushIT_server `billing.models.Subscription.plan`). */
export type PricingPlanCode = 'app' | 'unlimited';

export interface PricingCta {
  link: string;
  label: string;
  /** L'offre affichée est celle que l'utilisateur a déjà. */
  current: boolean;
}

/**
 * Page publique des tarifs : « par application » (quantité, essai de 30 jours)
 * et « illimité ». Les montants sont écrits en dur dans le gabarit, hors TVA :
 * la page doit s'afficher sans compte, alors que le catalogue `billing/plans/`
 * exige d'être connecté. La TVA est calculée au paiement, selon le pays.
 *
 * L'appel à l'action suit l'état : visiteur → `/register` ; connecté → la page
 * de facturation, avec « Votre offre actuelle » sur le plan déjà souscrit
 * (lu via `billing/subscription/`, jamais appelé sans session).
 */
@Component({
  selector: 'app-pricing-page',
  imports: [RouterLink],
  templateUrl: './pricing-page.html',
  styleUrl: './pricing-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PricingPage implements OnInit {
  private readonly appCopy = inject(AppCopyService);
  private readonly billing = inject(BillingService);
  private readonly destroyRef = inject(DestroyRef);
  readonly session = inject(SessionService);

  readonly copy = computed(() => this.appCopy.current().pricing);
  private readonly subscription = signal<BillingSubscription | null>(null);

  /** Code du plan payé en cours, ou null (visiteur, pas d'abonnement, lecture en échec). */
  readonly currentPlan = computed<string | null>(() => {
    const sub = this.subscription();
    return this.session.isAuthenticated() && sub?.isPaid ? sub.plan : null;
  });

  ngOnInit(): void {
    if (!this.session.isAuthenticated()) {
      return;
    }
    this.billing
      .subscription()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sub) => this.subscription.set(sub),
        // Secondaire : sans l'état de l'abonnement, les cartes renvoient vers la facturation.
        error: () => this.subscription.set(null),
      });
  }

  cta(plan: PricingPlanCode): PricingCta {
    const copy = this.copy();
    if (!this.session.isAuthenticated()) {
      return {
        link: '/register',
        label: plan === 'app' ? copy.ctaTrial : copy.ctaRegister,
        current: false,
      };
    }
    const current = this.currentPlan();
    if (current === plan) {
      return { link: '/dashboard/billing', label: copy.ctaManage, current: true };
    }
    return {
      link: '/dashboard/billing',
      label: current ? copy.ctaChange : copy.ctaSubscribe,
      current: false,
    };
  }
}
