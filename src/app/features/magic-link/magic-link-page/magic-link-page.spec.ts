import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { LoginResponse } from '../../../core/models/api.models';
import { AppCopyService } from '../../../core/services/app-copy.service';
import { LanguagePreferenceService } from '../../../core/services/language-preference.service';
import { PushitApiService } from '../../../core/services/pushit-api.service';
import { SessionService } from '../../../core/services/session.service';
import { MagicLinkPage } from './magic-link-page';

const loginResponse: LoginResponse = {
  access: 'access-token',
  refresh: 'refresh-token',
  user: { id: 1, email: 'renaud@example.com', userkey: 'usr_123', is_active: true, language: 'FR' },
};

const appCopy = {
  current: () => ({
    magicLink: {
      title: 'Connexion en cours',
      verifying: 'Vérification…',
      invalid: 'Lien invalide.',
      invalidHint: 'Demandez un nouveau lien.',
      backToLogin: 'Retour à la connexion',
    },
  }),
};

function setup(token: string | null) {
  const api = jasmine.createSpyObj<PushitApiService>('PushitApiService', ['verifyMagicLink']);
  const session = jasmine.createSpyObj<SessionService>('SessionService', ['startSession']);
  const languagePreference = jasmine.createSpyObj<LanguagePreferenceService>(
    'LanguagePreferenceService',
    ['applyBackendLanguage'],
  );
  TestBed.configureTestingModule({
    imports: [MagicLinkPage],
    providers: [
      provideRouter([]),
      provideNoopAnimations(),
      { provide: PushitApiService, useValue: api },
      { provide: SessionService, useValue: session },
      { provide: LanguagePreferenceService, useValue: languagePreference },
      { provide: AppCopyService, useValue: appCopy },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: new Map([['token', token]]) } },
      },
    ],
  });
  return { api, session };
}

describe('MagicLinkPage', () => {
  let fixture: ComponentFixture<MagicLinkPage>;

  it('verifies the token, starts a persistent session and redirects to the dashboard', () => {
    const { api, session } = setup('good-token');
    api.verifyMagicLink.and.returnValue(of(loginResponse));

    fixture = TestBed.createComponent(MagicLinkPage);
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();

    expect(api.verifyMagicLink).toHaveBeenCalledWith('good-token');
    expect(session.startSession).toHaveBeenCalledWith(loginResponse, true);
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('shows the failed state on an invalid/expired token', () => {
    const { api, session } = setup('bad-token');
    api.verifyMagicLink.and.returnValue(throwError(() => new Error('boom')));

    fixture = TestBed.createComponent(MagicLinkPage);
    fixture.detectChanges();

    expect(fixture.componentInstance.verifying()).toBeFalse();
    expect(fixture.componentInstance.failed()).toBeTrue();
    expect(session.startSession).not.toHaveBeenCalled();
  });

  it('fails fast when no token is present in the route', () => {
    const { api } = setup(null);

    fixture = TestBed.createComponent(MagicLinkPage);
    fixture.detectChanges();

    expect(api.verifyMagicLink).not.toHaveBeenCalled();
    expect(fixture.componentInstance.failed()).toBeTrue();
  });
});
