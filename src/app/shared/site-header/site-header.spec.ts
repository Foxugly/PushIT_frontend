import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { UserMe } from '../../core/models/api.models';
import { AppCopyService } from '../../core/services/app-copy.service';
import { LanguagePreferenceService } from '../../core/services/language-preference.service';
import { PushitApiService } from '../../core/services/pushit-api.service';
import { SessionService } from '../../core/services/session.service';
import { SiteHeader } from './site-header';

describe('SiteHeader', () => {
  let fixture: ComponentFixture<SiteHeader>;
  let component: SiteHeader;
  let session: {
    isAuthenticated: ReturnType<typeof signal<boolean>>;
    user: ReturnType<typeof signal<UserMe | null>>;
    refreshToken: jasmine.Spy<() => string | null>;
    clear: jasmine.Spy<(redirect?: boolean) => void>;
  };
  let api: jasmine.SpyObj<PushitApiService>;
  let languagePreference: jasmine.SpyObj<LanguagePreferenceService>;

  beforeEach(async () => {
    session = {
      isAuthenticated: signal(false),
      user: signal<UserMe | null>(null),
      refreshToken: jasmine.createSpy('refreshToken').and.returnValue(null),
      clear: jasmine.createSpy('clear'),
    };
    api = jasmine.createSpyObj<PushitApiService>('PushitApiService', ['logout']);
    api.logout.and.returnValue(of(void 0));
    languagePreference = jasmine.createSpyObj<LanguagePreferenceService>(
      'LanguagePreferenceService',
      ['updateLanguage'],
    );
    const appCopy = {
      current: signal({
        header: {
          home: 'Home',
          dashboard: 'Dashboard',
          about: 'About',
          features: 'Features',
          donate: 'Donate',
          login: 'Se connecter',
          settings: 'Settings',
          changePassword: 'Changer de mot de passe',
          logout: 'Deconnexion',
        },
      }),
    };

    await TestBed.configureTestingModule({
      imports: [SiteHeader],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: SessionService, useValue: session },
        { provide: PushitApiService, useValue: api },
        { provide: LanguagePreferenceService, useValue: languagePreference },
        { provide: AppCopyService, useValue: appCopy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SiteHeader);
    component = fixture.componentInstance;
  });

  it('shows the login action when the user is not authenticated', () => {
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Se connecter');
    expect(text).not.toContain('Dashboard');
  });

  it('shows dashboard and username when the user is authenticated', () => {
    session.isAuthenticated.set(true);
    session.user.set({
      id: 1,
      email: 'renaud@example.com',
      username: 'renaud',
      userkey: 'usr_123',
      is_active: true,
      language: 'FR',
    });

    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Dashboard');
    expect(text).toContain('renaud');
    expect(text).not.toContain('Se connecter');
  });

  it('clears the session immediately when no refresh token is available', () => {
    component.requestLogout();

    expect(api.logout).not.toHaveBeenCalled();
    expect(session.clear).toHaveBeenCalledWith(true);
  });

  it('logs out through the API when a refresh token exists', () => {
    session.refreshToken.and.returnValue('refresh-token');

    component.requestLogout();

    expect(api.logout).toHaveBeenCalledWith('refresh-token');
    expect(session.clear).toHaveBeenCalledWith(true);
  });
});
