import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
  BillingHistory,
  BillingInterval,
  BillingPlan,
  BillingQuantityPreview,
  BillingSubscription,
} from '../models/api.models';
import { SettingsService } from './settings.service';

/**
 * Facturation, relayée par le backend PushIT vers le service central. Le front
 * ne connaît ni Stripe ni les montants : le catalogue et les prix descendent du
 * central, si bien qu'un changement de tarif ne demande aucun déploiement ici.
 */
@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsService);

  /**
   * État de l'abonnement. `refresh` force le backend à interroger le central :
   * à utiliser au retour du Checkout, où le webhook n'est peut-être pas encore
   * arrivé et où le cache dirait encore « aucun abonnement » juste après le paiement.
   */
  subscription(refresh = false): Observable<BillingSubscription> {
    const suffix = refresh ? '?refresh=1' : '';
    return this.http.get<BillingSubscription>(this.url(`/billing/subscription/${suffix}`));
  }

  plans(): Observable<BillingPlan[]> {
    return this.http.get<BillingPlan[]>(this.url('/billing/plans/'));
  }

  history(): Observable<BillingHistory> {
    return this.http.get<BillingHistory>(this.url('/billing/history/'));
  }

  /** Ouvre le tunnel Stripe Checkout pour `quantity` exemplaires du plan. */
  checkout(plan: string, interval: BillingInterval, quantity: number): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(this.url('/billing/checkout/'), {
      plan,
      interval,
      quantity,
    });
  }

  /** Portail client Stripe : moyens de paiement, factures, résiliation. */
  portal(): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(this.url('/billing/portal/'), {});
  }

  /**
   * Ce que coûterait le passage à `quantity`, sans rien modifier. Toujours
   * appelé avant `setQuantity` : le prorata d'un changement en cours de période
   * n'est pas devinable, et on n'ajuste pas un abonnement sans l'avoir annoncé.
   */
  previewQuantity(quantity: number): Observable<BillingQuantityPreview> {
    return this.http.post<BillingQuantityPreview>(this.url('/billing/quantity/preview/'), {
      quantity,
    });
  }

  setQuantity(quantity: number): Observable<unknown> {
    return this.http.post(this.url('/billing/quantity/'), { quantity });
  }

  private url(path: string): string {
    return `${this.settings.apiBaseUrl()}${path}`;
  }
}
