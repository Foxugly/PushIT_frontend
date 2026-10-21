import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Mock, vi } from 'vitest';

import frCatalog from '../../../../../../public/i18n/fr.json';
import { CatalogStore } from '../../../../core/i18n/catalog-store';
import { UserLanguage, UserMe } from '../../../../core/models/api.models';
import { AppCopyService } from '../../../../core/services/app-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { LanguagePreferenceService } from '../../../../core/services/language-preference.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { SessionService } from '../../../../core/services/session.service';
import { SettingsPage } from './settings-page';

const COPY = frCatalog.app.console.settings;

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

  beforeEach(async () => {
    backendLanguage = signal<UserLanguage>('FR');
    updateLanguage = vi.fn();
    loadShell = vi.fn();
    shellUser = signal<UserMe | null>(user);

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
              { value: 'FR', label: 'Francais' },
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
});
