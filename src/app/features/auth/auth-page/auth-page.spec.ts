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
      userkey: 'usr_123',
      is_active: true,
      language: 'FR',
    },
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj<PushitApiService>('PushitApiService', ['login', 'requestMagicLink']);
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
          or: 'ou',
          magicRequest: 'Recevoir un lien de connexion',
          magicTitle: 'Connexion par lien',
          magicDescription: 'Saisissez votre email.',
          magicSend: 'Envoyer le lien',
          magicPending: 'Envoi...',
          magicSent: 'Lien envoyé.',
          magicBack: 'Retour',
          magicCaptchaRequired: 'Captcha requis.',
          magicCaptchaFailed: 'Captcha échoué.',
          validation: {
            emailRequired: "L'email est requis.",
            emailInvalid: 'Saisissez une adresse email valide.',
            passwordRequired: 'Le mot de passe est requis.',
          },
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

  it('toggles into inline magic-link mode, prefilling the email', () => {
    component.loginForm.patchValue({ email: 'renaud@example.com' });

    component.enterMagicMode();

    expect(component.magicMode()).toBeTrue();
    expect(component.magicForm.getRawValue().email).toBe('renaud@example.com');
  });

  it('requests a magic link and shows the sent confirmation', () => {
    api.requestMagicLink.and.returnValue(of(undefined));
    component.enterMagicMode();
    component.magicForm.setValue({ email: 'renaud@example.com' });

    component.submitMagic();

    expect(api.requestMagicLink).toHaveBeenCalledWith('renaud@example.com', undefined);
    expect(component.magicSent()).toBeTrue();
    expect(component.magicPending()).toBeFalse();
  });

  it('does not request a magic link when the email is invalid', () => {
    component.enterMagicMode();
    component.magicForm.setValue({ email: 'not-an-email' });

    component.submitMagic();

    expect(api.requestMagicLink).not.toHaveBeenCalled();
  });

  // Les deux tests suivants assertent le DOM, pas seulement l'etat du
  // composant : le defaut corrige ici etait justement invisible cote etat.
  // submitMagic() sortait bien sur magicForm.invalid, mais l'utilisateur ne
  // voyait STRICTEMENT rien -- les seules erreurs rendues venaient de
  // magicError(), c'est-a-dire de la reponse serveur, jamais atteinte.
  it('tells the visitor why an empty magic-link request went nowhere', () => {
    component.enterMagicMode();
    fixture.detectChanges();

    component.submitMagic();
    fixture.detectChanges();

    expect(api.requestMagicLink).not.toHaveBeenCalled();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain("L'email est requis.");
  });

  it('tells the visitor why an empty login went nowhere', () => {
    component.submitLogin();
    fixture.detectChanges();

    expect(api.login).not.toHaveBeenCalled();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain("L'email est requis.");
    expect(text).toContain('Le mot de passe est requis.');
  });

  it('redirects an unconfirmed account to the check-email page (no dead-end error)', () => {
    api.login.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 403,
            error: { code: 'email_not_verified', detail: 'Confirm your email first.' },
          }),
      ),
    );
    component.loginForm.setValue({
      email: 'pending@example.com',
      password: 'secret123',
      rememberMe: false,
    });

    component.submitLogin();

    expect(router.navigate).toHaveBeenCalledWith(['/auth/check-email'], {
      state: { email: 'pending@example.com' },
    });
    expect(component.loginError()).toBeNull();
  });
});
