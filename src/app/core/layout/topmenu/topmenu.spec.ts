import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { UserMe } from '../../models/api.models';
import { AppCopyService } from '../../services/app-copy.service';
import { LanguagePreferenceService } from '../../services/language-preference.service';
import { PushitApiService } from '../../services/pushit-api.service';
import { SessionService } from '../../services/session.service';
import { Topmenu } from './topmenu';

describe('Topmenu', () => {
  let fixture: ComponentFixture<Topmenu>;
  let session: {
    isAuthenticated: ReturnType<typeof signal<boolean>>;
    user: ReturnType<typeof signal<UserMe | null>>;
    refreshToken: jasmine.Spy<() => string | null>;
    clear: jasmine.Spy<(redirect?: boolean) => void>;
  };

  beforeEach(async () => {
    session = {
      isAuthenticated: signal(false),
      user: signal<UserMe | null>(null),
      refreshToken: jasmine.createSpy('refreshToken').and.returnValue(null),
      clear: jasmine.createSpy('clear'),
    };
    const api = jasmine.createSpyObj<PushitApiService>('PushitApiService', ['logout']);
    api.logout.and.returnValue(of(void 0));
    const languagePreference = jasmine.createSpyObj<LanguagePreferenceService>(
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
      imports: [Topmenu],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: SessionService, useValue: session },
        { provide: PushitApiService, useValue: api },
        { provide: LanguagePreferenceService, useValue: languagePreference },
        { provide: AppCopyService, useValue: appCopy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Topmenu);
  });

  it('hides the Dashboard nav link when the user is not authenticated', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent as string).not.toContain('Dashboard');
  });

  it('shows the Dashboard nav link when the user is authenticated', () => {
    session.isAuthenticated.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent as string).toContain('Dashboard');
  });
});
