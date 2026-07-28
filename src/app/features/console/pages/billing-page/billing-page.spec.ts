import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import {
  BillingPlan,
  BillingQuantityPreview,
  BillingSubscription,
} from '../../../../core/models/api.models';
import { BillingService } from '../../../../core/services/billing.service';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { BillingPage } from './billing-page';

const BILLING_COPY = {
  title: 'Facturation',
  lead: 'Lead',
  loading: 'Chargement',
  disabled: 'Facturation desactivee',
  currentEyebrow: 'Abonnement',
  currentTitle: 'En cours',
  planLabel: 'Formule',
  usageLabel: 'Utilisees',
  renewsLabel: 'Renouvellement',
  statusLabel: 'Statut',
  managePortal: 'Gerer',
  portalHint: 'Portail',
  noSubscription: 'Aucun abonnement',
  intervalMonthly: 'Mensuel',
  intervalYearly: 'Annuel',
  adjustEyebrow: 'Quantite',
  adjustTitle: 'Changer',
  adjustLead: 'Prorata annonce',
  quantityLabel: 'Nombre',
  previewButton: 'Calculer',
  belowUsageWarning: 'Sous le nombre possede',
  previewCharge: 'De {from} a {to} : {amount} maintenant.',
  previewCredit: 'De {from} a {to} : avoir de {amount}.',
  nextRenewalLabel: 'Renouvellement :',
  amountsExcludeVat: 'Hors TVA',
  confirmQuantity: 'Confirmer',
  quantityApplied: 'Quantite mise a jour.',
  plansEyebrow: 'Catalogue',
  plansTitle: 'Formules',
  perMonth: '/ mois HT',
  perYear: '/ an HT',
  perApplication: 'par application',
  totalLabel: 'Total :',
  priceUnavailable: 'Tarif indisponible',
  trialDays: '{days} jours offerts',
  trialConditions: 'Premiere souscription, une seule application.',
  subscribeButton: "S'abonner",
  vatNote: 'Montants hors TVA',
  historyEyebrow: 'Historique',
  historyTitle: 'Abonnements',
  startedLabel: 'Debut',
  endedLabel: 'Fin',
  noHistory: 'Aucun',
  invoicesTitle: 'Factures',
  invoiceNumber: 'Numero',
  invoiceDate: 'Date',
  invoiceAmount: 'Montant',
  invoicePdf: 'PDF',
  invoiceView: 'Voir',
  noInvoices: 'Aucune',
  checkoutSuccess: 'Paiement enregistre.',
  goToBilling: 'Voir la facturation',
  statuses: { active: 'Actif', trialing: 'Essai' },
};

const PER_UNIT_PLAN: BillingPlan = {
  code: 'app',
  name: 'Par application',
  description: '',
  quotas: {},
  per_unit_quota_key: 'applications',
  trial_days: 30,
  prices: {
    monthly: { id: 'price_m', amount: 200, currency: 'EUR' },
    yearly: { id: 'price_y', amount: 2000, currency: 'EUR' },
  },
};

const FLAT_PLAN: BillingPlan = {
  code: 'unlimited',
  name: 'Illimite',
  description: '',
  quotas: { applications: 10000 },
  per_unit_quota_key: '',
  trial_days: 0,
  prices: {
    monthly: { id: 'price_u_m', amount: 2000, currency: 'EUR' },
    yearly: null,
  },
};

function makeSubscription(overrides: Partial<BillingSubscription> = {}): BillingSubscription {
  return {
    billingEnabled: true,
    isPaid: true,
    status: 'active',
    plan: 'app',
    interval: 'monthly',
    quota: 2,
    applicationsUsed: 1,
    currentPeriodEnd: '2026-09-01T00:00:00Z',
    canManage: true,
    ...overrides,
  };
}

describe('BillingPage', () => {
  let fixture: ComponentFixture<BillingPage>;
  let component: BillingPage;
  let billing: jasmine.SpyObj<BillingService>;

  async function setup(
    subscription: BillingSubscription,
    queryParams: Record<string, string> = {},
  ): Promise<void> {
    billing = jasmine.createSpyObj<BillingService>('BillingService', [
      'subscription',
      'plans',
      'history',
      'checkout',
      'portal',
      'previewQuantity',
      'setQuantity',
    ]);
    billing.subscription.and.returnValue(of(subscription));
    billing.plans.and.returnValue(of([PER_UNIT_PLAN, FLAT_PLAN]));
    billing.history.and.returnValue(of({ billingEnabled: true, subscriptions: [], invoices: [] }));

    await TestBed.configureTestingModule({
      imports: [BillingPage],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BillingService, useValue: billing },
        { provide: ConsoleCopyService, useValue: { current: signal({ billing: BILLING_COPY }) } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BillingPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('leaves everything alone when billing is not enabled', async () => {
    // C'est l'etat de production tant que le central n'est pas branche : la page
    // doit le dire sans reclamer un catalogue qui n'existe pas.
    await setup(makeSubscription({ billingEnabled: false, isPaid: false, quota: 0 }));

    expect(billing.plans).not.toHaveBeenCalled();
    expect(billing.history).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Facturation desactivee');
  });

  it('pulls the central when coming back from Checkout', async () => {
    // Sans ce pull, l'utilisateur qui revient de Stripe avant le webhook lirait
    // « aucun abonnement » juste apres avoir paye.
    await setup(makeSubscription(), { checkout: 'success' });

    expect(billing.subscription).toHaveBeenCalledWith(true);
    expect(component.notice()).toBe('Paiement enregistre.');
  });

  it('does not pull the central on an ordinary visit', async () => {
    await setup(makeSubscription());

    expect(billing.subscription).toHaveBeenCalledWith(false);
  });

  it('multiplies the displayed total by the chosen quantity', async () => {
    await setup(makeSubscription());

    component.setQuantityFor(PER_UNIT_PLAN, 3);

    expect(component.totalFor(PER_UNIT_PLAN)).toContain('6');
  });

  it('stops announcing the trial once more than one unit is chosen', async () => {
    // L'essai n'est accorde qu'a une premiere souscription d'un seul exemplaire :
    // l'annoncer au-dela serait mensonger.
    await setup(makeSubscription());

    expect(component.showsTrial(PER_UNIT_PLAN)).toBe(true);

    component.setQuantityFor(PER_UNIT_PLAN, 2);

    expect(component.showsTrial(PER_UNIT_PLAN)).toBe(false);
  });

  it('only offers the quantity adjuster on a per-unit plan', async () => {
    await setup(makeSubscription({ plan: 'unlimited' }));

    expect(component.canAdjustQuantity()).toBe(false);
  });

  it('never applies a quantity change that was not previewed first', async () => {
    // La garantie de transparence : rien n'est preleve sans avoir ete annonce.
    await setup(makeSubscription());

    component.newQuantity.set(5);
    component.applyQuantity();

    expect(billing.setQuantity).not.toHaveBeenCalled();
  });

  it('applies exactly the quantity that was previewed', async () => {
    await setup(makeSubscription());
    const preview: BillingQuantityPreview = {
      current_quantity: 2,
      new_quantity: 4,
      amount_due_now: 247,
      currency: 'EUR',
      next_renewal: 1_800_000_000,
    };
    billing.previewQuantity.and.returnValue(of(preview));
    billing.setQuantity.and.returnValue(of({}));

    component.newQuantity.set(4);
    component.askPreview();
    component.applyQuantity();

    expect(billing.setQuantity).toHaveBeenCalledWith(4);
  });

  it('words the preview as a credit when the proration is negative', async () => {
    // Annoncer « sera facture » pour un avoir inquieterait pour rien.
    await setup(makeSubscription());

    const sentence = component.previewSentence({
      current_quantity: 4,
      new_quantity: 2,
      amount_due_now: -320,
      currency: 'EUR',
      next_renewal: null,
    });

    expect(sentence).toContain('avoir');
    expect(sentence).not.toContain('-');
  });

  it('keeps the page usable when the catalogue cannot be loaded', async () => {
    await setup(makeSubscription());
    billing.plans.and.returnValue(throwError(() => new Error('down')));

    expect(component.subscription()).not.toBeNull();
    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('surfaces a checkout failure instead of navigating away', async () => {
    await setup(makeSubscription());
    billing.checkout.and.returnValue(throwError(() => new Error('down')));

    component.subscribe(PER_UNIT_PLAN);

    expect(component.error()).not.toBeNull();
    expect(component.pendingPlan()).toBe('');
  });

  it('falls back to the raw code for a status the copy does not cover', async () => {
    await setup(makeSubscription());

    expect(component.statusLabel('active')).toBe('Actif');
    expect(component.statusLabel('past_due')).toBe('past_due');
  });
});
