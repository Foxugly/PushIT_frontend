import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { UserMe } from '../models/api.models';
import { LanguagePreferenceService } from './language-preference.service';
import { PublicI18nService } from './public-i18n.service';
import { PushitApiService } from './pushit-api.service';
import { SessionService } from './session.service';

describe('LanguagePreferenceService', () => {
  const user: UserMe = {
    id: 1,
    email: 'renaud@example.com',
    username: 'renaud',
    userkey: 'usr_123',
    is_active: true,
    language: 'FR',
  };

  let i18n: {
    language: ReturnType<typeof signal<'fr' | 'nl' | 'en'>>;
    setLanguage: jasmine.Spy<(language: 'fr' | 'nl' | 'en') => void>;
  };
  let api: jasmine.SpyObj<PushitApiService>;
  let session: {
    isAuthenticated: ReturnType<typeof signal<boolean>>;
    user: ReturnType<typeof signal<UserMe | null>>;
    updateUser: jasmine.Spy<(user: UserMe) => void>;
  };

  beforeEach(() => {
    i18n = {
      language: signal<'fr' | 'nl' | 'en'>('fr'),
      setLanguage: jasmine.createSpy('setLanguage').and.callFake((language) => i18n.language.set(language)),
    };
    api = jasmine.createSpyObj<PushitApiService>('PushitApiService', ['updateMe']);
    session = {
      isAuthenticated: signal(false),
      user: signal<UserMe | null>(null),
      updateUser: jasmine.createSpy('updateUser'),
    };

    TestBed.configureTestingModule({
      providers: [
        LanguagePreferenceService,
        { provide: PublicI18nService, useValue: i18n },
        { provide: PushitApiService, useValue: api },
        { provide: SessionService, useValue: session },
      ],
    });
  });

  it('changes only the local language when the user is not authenticated', () => {
    const service = TestBed.inject(LanguagePreferenceService);

    service.updateLanguage('en');

    expect(i18n.language()).toBe('en');
    expect(api.updateMe).not.toHaveBeenCalled();
  });

  it('synchronizes the backend language for authenticated users', () => {
    const service = TestBed.inject(LanguagePreferenceService);
    const updatedUser = { ...user, language: 'NL' as const };
    session.isAuthenticated.set(true);
    session.user.set(user);
    api.updateMe.and.returnValue(of(updatedUser));

    service.updateLanguage('nl');

    expect(api.updateMe).toHaveBeenCalledWith({ language: 'NL' });
    expect(session.updateUser).toHaveBeenCalledWith(updatedUser);
    expect(i18n.language()).toBe('nl');
  });

  it('restores the previous language when the backend update fails', () => {
    const service = TestBed.inject(LanguagePreferenceService);
    session.isAuthenticated.set(true);
    session.user.set(user);
    i18n.language.set('fr');
    api.updateMe.and.returnValue(throwError(() => new Error('boom')));

    service.updateLanguage('en');

    expect(i18n.language()).toBe('fr');
  });
});
