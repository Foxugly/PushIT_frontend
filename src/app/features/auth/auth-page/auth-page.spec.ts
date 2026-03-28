import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { LoginResponse } from '../../../core/models/api.models';
import { AppCopyService } from '../../../core/services/app-copy.service';
import { LanguagePreferenceService } from '../../../core/services/language-preference.service';
import { PushitApiService } from '../../../core/services/pushit-api.service';
import { SessionService } from '../../../core/services/session.service';
import { AuthPage } from './auth-page';

describe('AuthPage', () => {
  let fixture: ComponentFixture<AuthPage>;
  let component: AuthPage;
  let api: jasmine.SpyObj<PushitApiService>;
  let session: jasmine.SpyObj<SessionService>;
  let languagePreference: jasmine.SpyObj<LanguagePreferenceService>;
  let router: Router;

  const loginResponse: LoginResponse = {
    access: 'access-token',
    refresh: 'refresh-token',
    user: {
      id: 1,
      email: 'renaud@example.com',
      username: 'renaud',
      userkey: 'usr_123',
      is_active: true,
      language: 'FR',
    },
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj<PushitApiService>('PushitApiService', ['login']);
    session = jasmine.createSpyObj<SessionService>('SessionService', ['startSession']);
    languagePreference = jasmine.createSpyObj<LanguagePreferenceService>(
      'LanguagePreferenceService',
      ['applyBackendLanguage'],
    );
    const appCopy = {
      current: () => ({
        auth: {
          eyebrow: 'Connexion',
          title: 'Acceder a votre espace.',
          description: 'Desc',
          email: 'Email',
          password: 'Mot de passe',
          passwordPlaceholder: 'Mot de passe',
          rememberMe: 'Se souvenir de moi',
          forgotPassword: 'Mot de passe oublie ?',
          register: 'Inscription',
          submit: 'Se connecter',
          pending: 'Connexion...',
        },
      }),
    };

    await TestBed.configureTestingModule({
      imports: [AuthPage],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: PushitApiService, useValue: api },
        { provide: SessionService, useValue: session },
        { provide: LanguagePreferenceService, useValue: languagePreference },
        { provide: AppCopyService, useValue: appCopy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthPage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
  });

  it('does not submit when the form is invalid', () => {
    component.submitLogin();

    expect(api.login).not.toHaveBeenCalled();
    expect(component.loginPending()).toBeFalse();
  });

  it('starts the session and redirects to the dashboard on success', () => {
    api.login.and.returnValue(of(loginResponse));
    component.loginForm.setValue({
      email: 'renaud@example.com',
      password: 'secret',
      rememberMe: true,
    });

    component.submitLogin();

    expect(api.login).toHaveBeenCalledWith({
      email: 'renaud@example.com',
      password: 'secret',
    });
    expect(session.startSession).toHaveBeenCalledWith(loginResponse, true);
    expect(languagePreference.applyBackendLanguage).toHaveBeenCalledWith('FR');
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('stores the API error on login failure', () => {
    api.login.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            error: {
          code: 'invalid_credentials',
          detail: 'Bad credentials.',
            },
          }),
      ),
    );
    component.loginForm.setValue({
      email: 'renaud@example.com',
      password: 'bad',
      rememberMe: false,
    });

    component.submitLogin();

    expect(component.loginError()).toEqual(
      jasmine.objectContaining({
        code: 'invalid_credentials',
        detail: 'Bad credentials.',
      }),
    );
    expect(component.loginPending()).toBeFalse();
  });
});
