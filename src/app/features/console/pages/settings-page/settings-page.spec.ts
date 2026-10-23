import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Observable, of, throwError } from 'rxjs';
import { Mock, vi } from 'vitest';

import frCatalog from '../../../../../../public/i18n/fr.json';
import { CatalogStore } from '../../../../core/i18n/catalog-store';
import { BillingSubscription, UserLanguage, UserMe } from '../../../../core/models/api.models';
import { AppCopyService } from '../../../../core/services/app-copy.service';
import { BillingService } from '../../../../core/services/billing.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { LanguagePreferenceService } from '../../../../core/services/language-preference.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { SessionService } from '../../../../core/services/session.service';
import { SettingsPage } from './settings-page';

const COPY = frCatalog.app.console.settings;
const SUB_COPY = COPY.subscription;

function makeSubscription(overrides: Partial<BillingSubscription> = {}): BillingSubscription {
  return {
    billingEnabled: true,
    isPaid: true,
    bypass: false,
    status: 'active',
    plan: 'app',
    interval: 'monthly',
    quota: 3,
    applicationsUsed: 2,
    currentPeriodEnd: '2026-11-30T00:00:00Z',
    canManage: true,
    ...overrides,
  };
}

const user: UserMe = {
  id: 1,
  email: 'renaud@example.com',
  userkey: 'usr_123',
  is_active: true,
  language: 'FR',
};

describe('SettingsPage (« Mon compte »)', () => {
  let fixture: ComponentFixture<SettingsPage>;
  let component: SettingsPage;
  let root: HTMLElement;
  let backendLanguage: ReturnType<typeof signal<UserLanguage>>;
  let updateLanguage: Mock;
  let loadShell: Mock;
  let shellUser: ReturnType<typeof signal<UserMe | null>>;
  let billingSubscription: Mock<() => Observable<BillingSubscription>>;

  beforeEach(async () => {
    backendLanguage = signal<UserLanguage>('FR');
    updateLanguage = vi.fn();
    loadShell = vi.fn();
    shellUser = signal<UserMe | null>(user);
    // Facturation non branchée par défaut : la carte « Abonnement » reste masquée.
    billingSubscription = vi.fn(() => of(makeSubscription({ billingEnabled: false })));

    await TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: AppCopyService, useValue: { current: signal(frCatalog.app) } },
        { provide: CatalogStore, useValue: { get: () => frCatalog } },
        {
          provide: ConsoleShellService,
          useValue: {
            user: shellUser,
            selectedAppId: signal<number | null>(7),
            loadShell,
            clearGeneratedToken: vi.fn(),
          },
        },
        {
          provide: LanguagePreferenceService,
          useValue: {
            options: [
              { value: 'FR', label: 'Français' },
              { value: 'EN', label: 'English' },
            ],
            currentBackendLanguage: () => backendLanguage(),
            updateLanguage,
            toFrontendLanguage: (language: UserLanguage) => language.toLowerCase(),
          },
        },
        { provide: PushitApiService, useValue: { changePassword: vi.fn(), deleteMe: vi.fn() } },
        { provide: SessionService, useValue: { adoptTokens: vi.fn(), clear: vi.fn() } },
        { provide: MessageService, useValue: { add: vi.fn() } },
        { provide: BillingService, useValue: { subscription: billingSubscription } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsPage);
    component = fixture.componentInstance;
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the three blocks with plain h3 headings and no eyebrow', () => {
    const headings = Array.from(root.querySelectorAll('.console-card h3')).map((h) => h.textContent?.trim());

    expect(root.querySelector('h1')?.textContent).toContain(COPY.title);
    expect(headings).toEqual([COPY.accountTitle, COPY.securityTitle, COPY.deleteAccount.title]);
    expect(root.querySelector('.console-shell__eyebrow')).toBeNull();
    expect(root.querySelector('app-change-password-panel #security')).not.toBeNull();
    expect(root.querySelector('app-delete-account-panel')).not.toBeNull();
  });

  it('no longer exposes the API URL', () => {
    expect(root.querySelector('input[formcontrolname="apiBaseUrl"]')).toBeNull();
    expect(root.textContent).not.toContain('/api/v1');
  });

  it('shows the e-mail and the userkey of the signed-in user', () => {
    expect(root.querySelector('[data-testid="account-email"]')?.textContent).toContain(user.email);
    expect(root.querySelector('[data-testid="account-userkey"]')?.textContent).toContain(user.userkey);
  });

  it('falls back when the e-mail is unknown and hides the userkey row', () => {
    shellUser.set(null);
    fixture.detectChanges();

    expect(root.querySelector('[data-testid="account-email"]')?.textContent).toContain(COPY.fallbackEmail);
    expect(root.querySelector('[data-testid="account-userkey"]')).toBeNull();
  });

  it('copies the userkey to the clipboard and confirms it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    await component.copyUserkey();
    fixture.detectChanges();

    expect(writeText).toHaveBeenCalledWith(user.userkey);
    expect(component.banner()).toEqual({ key: 'userkeyCopied', tone: 'success' });
    expect(component.bannerMessage()).toBe(COPY.userkeyCopied);
    expect(root.textContent).toContain(COPY.userkeyCopied);
  });

  it('reports a failed copy instead of a false success', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    await component.copyUserkey();

    expect(component.banner()).toEqual({ key: 'copyFailed', tone: 'danger' });
    expect(component.bannerMessage()).toBe(COPY.copyFailed);
  });

  it('saves the language as soon as it changes, without a Save button', () => {
    expect(root.querySelector('[data-testid="account-panel"] button[type="submit"]')).toBeNull();

    component.saveLanguage('EN');

    expect(updateLanguage).toHaveBeenCalledWith('en');
    expect(loadShell).not.toHaveBeenCalled();
    expect(component.banner()).toEqual({ key: 'languageSaved', tone: 'success' });
    expect(component.bannerMessage()).toBe(COPY.languageSaved);
  });

  it('follows a language changed elsewhere', () => {
    backendLanguage.set('EN');
    fixture.detectChanges();

    expect(component.language.value).toBe('EN');
  });

  describe('subscription card', () => {
    function render(response: Observable<BillingSubscription>): HTMLElement {
      billingSubscription.mockReturnValue(response);
      const fresh = TestBed.createComponent(SettingsPage);
      fresh.detectChanges();
      return fresh.nativeElement as HTMLElement;
    }

    function links(el: HTMLElement): string[] {
      return Array.from(el.querySelectorAll('[data-testid="subscription-panel"] p-button'))
        .map((button) => button.getAttribute('ng-reflect-router-link') ?? button.textContent?.trim() ?? '');
    }

    it('is hidden when billing is not enabled', () => {
      expect(billingSubscription).toHaveBeenCalledOnce();
      expect(root.querySelector('[data-testid="subscription-panel"]')).toBeNull();
    });

    it('shows an offered access without plan, end date nor manage button', () => {
      const el = render(
        of(makeSubscription({ bypass: true, plan: '', interval: '', quota: 10000, currentPeriodEnd: null, canManage: false })),
      );
      const panel = el.querySelector('[data-testid="subscription-panel"]');

      expect(panel?.querySelector('h3')?.textContent?.trim()).toBe(SUB_COPY.title);
      expect(el.querySelector('[data-testid="subscription-offered"]')?.textContent).toContain(SUB_COPY.offered);
      expect(panel?.textContent).toContain(SUB_COPY.offeredHint);
      expect(el.querySelector('[data-testid="subscription-period-end"]')).toBeNull();
      expect(panel?.querySelector('p-button')).toBeNull();
    });

    it('shows the plan, the usage and the end of the period of a paid account', () => {
      const el = render(of(makeSubscription({ plan: 'app', interval: 'yearly', quota: 3, applicationsUsed: 2 })));

      expect(el.querySelector('[data-testid="subscription-plan"]')?.textContent).toContain(
        frCatalog.app.pricing.perApp.name,
      );
      expect(el.querySelector('[data-testid="subscription-plan"]')?.textContent).toContain(SUB_COPY.intervalYearly);
      expect(el.querySelector('[data-testid="subscription-usage"]')?.textContent?.trim()).toBe('2 / 3');
      expect(el.querySelector('[data-testid="subscription-period-end"]')?.textContent?.trim()).not.toBe('');
      expect(el.querySelector('[data-testid="subscription-panel"]')?.textContent).toContain(SUB_COPY.manage);
      expect(el.querySelector('[data-testid="subscription-offered"]')).toBeNull();
    });

    it('says « illimité » rather than the backend sentinel for the unlimited plan', () => {
      const el = render(of(makeSubscription({ plan: 'unlimited', quota: 10000, applicationsUsed: 4 })));

      expect(el.querySelector('[data-testid="subscription-plan"]')?.textContent).toContain(
        frCatalog.app.pricing.unlimited.name,
      );
      expect(el.querySelector('[data-testid="subscription-usage"]')?.textContent?.trim()).toBe(
        `4 / ${SUB_COPY.unlimited}`,
      );
    });

    it('points an account without subscription to the pricing and the billing page', () => {
      const el = render(of(makeSubscription({ isPaid: false, plan: '', quota: 0, currentPeriodEnd: null })));
      const panel = el.querySelector('[data-testid="subscription-panel"]');

      expect(el.querySelector('[data-testid="subscription-none"]')?.textContent).toContain(SUB_COPY.none);
      expect(panel?.textContent).toContain(SUB_COPY.seePlans);
      expect(panel?.textContent).toContain(SUB_COPY.manage);
      expect(el.querySelector('[data-testid="subscription-plan"]')).toBeNull();
      expect(links(el)).toHaveLength(2);
    });

    it('keeps the page usable when the subscription cannot be read', () => {
      const el = render(throwError(() => new Error('503')));

      expect(el.querySelector('[data-testid="subscription-error"]')?.textContent).toContain(SUB_COPY.loadFailed);
      expect(el.querySelector('[data-testid="account-email"]')?.textContent).toContain(user.email);
      expect(el.querySelector('app-change-password-panel')).not.toBeNull();
      expect(el.querySelector('app-delete-account-panel')).not.toBeNull();
    });
  });
});
