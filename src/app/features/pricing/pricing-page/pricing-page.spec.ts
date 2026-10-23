import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import enCatalog from '../../../../../public/i18n/en.json';
import frCatalog from '../../../../../public/i18n/fr.json';
import { BillingSubscription } from '../../../core/models/api.models';
import { AppCopyService } from '../../../core/services/app-copy.service';
import { BillingService } from '../../../core/services/billing.service';
import { SessionService } from '../../../core/services/session.service';
import { PricingPage } from './pricing-page';

const fr = frCatalog.app.pricing;

function paidSubscription(plan: string): BillingSubscription {
  return {
    billingEnabled: true,
    isPaid: true,
    status: 'active',
    plan,
    interval: 'monthly',
    quota: 3,
    applicationsUsed: 2,
    currentPeriodEnd: null,
    canManage: true,
  };
}

describe('PricingPage', () => {
  let fixture: ComponentFixture<PricingPage>;
  const isAuthenticated = signal(false);
  const current = signal(frCatalog.app);
  const subscription = vi.fn<(refresh?: boolean) => Observable<BillingSubscription>>();

  beforeEach(async () => {
    isAuthenticated.set(false);
    current.set(frCatalog.app);
    subscription.mockReset();
    subscription.mockReturnValue(of({ ...paidSubscription(''), isPaid: false }));

    await TestBed.configureTestingModule({
      imports: [PricingPage],
      providers: [
        provideRouter([]),
        { provide: SessionService, useValue: { isAuthenticated } },
        { provide: AppCopyService, useValue: { current } },
        { provide: BillingService, useValue: { subscription } },
      ],
    }).compileComponents();
  });

  function render(): HTMLElement {
    fixture = TestBed.createComponent(PricingPage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function plan(host: HTMLElement, code: 'app' | 'unlimited'): HTMLElement {
    return host.querySelector(`[data-plan="${code}"]`) as HTMLElement;
  }

  function cta(host: HTMLElement, code: 'app' | 'unlimited'): HTMLAnchorElement {
    return plan(host, code).querySelector('a.pricing-plan__cta') as HTMLAnchorElement;
  }

  it('shows both plans with their excl.-VAT prices and the trial on the per-app plan only', () => {
    const host = render();
    const perApp = plan(host, 'app').textContent!;
    const unlimited = plan(host, 'unlimited').textContent!;

    expect(perApp).toContain(fr.perApp.name);
    expect(perApp).toContain('2 €');
    expect(perApp).toContain('20 €');
    expect(perApp).toContain(fr.perApplication);
    expect(perApp).toContain(fr.perApp.trial);
    expect(perApp).toContain(fr.exclVat);

    expect(unlimited).toContain(fr.unlimited.name);
    expect(unlimited).toContain('20 €');
    expect(unlimited).toContain('200 €');
    expect(unlimited).not.toContain(fr.perApp.trial);
    expect(unlimited).toContain(fr.yearlySaving);

    expect(host.querySelector('.pricing-vat-note')?.textContent).toContain(fr.vatNote);
  });

  it('sends a visitor to registration and never asks for the subscription', () => {
    const host = render();

    expect(cta(host, 'app').getAttribute('href')).toBe('/register');
    expect(cta(host, 'app').textContent!.trim()).toBe(fr.ctaTrial);
    expect(cta(host, 'unlimited').getAttribute('href')).toBe('/register');
    expect(cta(host, 'unlimited').textContent!.trim()).toBe(fr.ctaRegister);
    expect(subscription).not.toHaveBeenCalled();
  });

  it('sends a signed-in user without a subscription to the billing page', () => {
    isAuthenticated.set(true);
    const host = render();

    expect(subscription).toHaveBeenCalledOnce();
    for (const code of ['app', 'unlimited'] as const) {
      expect(cta(host, code).getAttribute('href')).toBe('/dashboard/billing');
      expect(cta(host, code).textContent!.trim()).toBe(fr.ctaSubscribe);
    }
    expect(host.textContent).not.toContain(fr.currentPlan);
  });

  it('marks the subscribed plan as the current one', () => {
    isAuthenticated.set(true);
    subscription.mockReturnValue(of(paidSubscription('unlimited')));
    const host = render();

    expect(plan(host, 'unlimited').textContent).toContain(fr.currentPlan);
    expect(cta(host, 'unlimited').textContent!.trim()).toBe(fr.ctaManage);
    expect(plan(host, 'app').textContent).not.toContain(fr.currentPlan);
    expect(cta(host, 'app').textContent!.trim()).toBe(fr.ctaChange);
    expect(cta(host, 'app').getAttribute('href')).toBe('/dashboard/billing');
  });

  it('still links to billing when the subscription lookup fails', () => {
    isAuthenticated.set(true);
    subscription.mockReturnValue(throwError(() => new Error('offline')));
    const host = render();

    expect(cta(host, 'app').getAttribute('href')).toBe('/dashboard/billing');
    expect(cta(host, 'app').textContent!.trim()).toBe(fr.ctaSubscribe);
  });

  it('follows the active language', () => {
    const host = render();
    current.set(enCatalog.app as typeof frCatalog.app);
    fixture.detectChanges();

    expect(host.querySelector('h1')?.textContent).toBe(enCatalog.app.pricing.title);
    expect(plan(host, 'app').textContent).toContain(enCatalog.app.pricing.exclVat);
  });
});
