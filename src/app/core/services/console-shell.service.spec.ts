import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import {
  makeApplication,
  makeDevice,
  makeUser,
} from '../../../testing/console-fixtures';
import { ApplicationQuietPeriod, DeviceQuietPeriod } from '../models/api.models';
import { PushitApiService } from './pushit-api.service';
import { ConsoleShellService } from './console-shell.service';
import { SessionService } from './session.service';
import { LanguagePreferenceService } from './language-preference.service';

describe('ConsoleShellService', () => {
  let service: ConsoleShellService;
  let api: jasmine.SpyObj<PushitApiService>;
  let session: {
    user: ReturnType<typeof signal<ReturnType<typeof makeUser> | null>>;
    refreshToken: jasmine.Spy<() => string | null>;
    updateUser: jasmine.Spy<(user: ReturnType<typeof makeUser>) => void>;
    clear: jasmine.Spy<(redirect?: boolean) => void>;
  };
  let languagePreference: jasmine.SpyObj<LanguagePreferenceService>;

  beforeEach(() => {
    api = jasmine.createSpyObj<PushitApiService>('PushitApiService', [
      'me',
      'listApps',
      'listDevices',
      'listNotifications',
      'listFutureNotifications',
      'listAppQuietPeriods',
      'listDeviceQuietPeriods',
      'createApp',
      'activateApp',
      'deactivateApp',
      'regenerateAppToken',
      'revokeAppToken',
      'logout',
    ]);
    session = {
      user: signal<ReturnType<typeof makeUser> | null>(null),
      refreshToken: jasmine.createSpy('refreshToken').and.returnValue(null),
      updateUser: jasmine.createSpy('updateUser'),
      clear: jasmine.createSpy('clear'),
    };
    languagePreference = jasmine.createSpyObj<LanguagePreferenceService>('LanguagePreferenceService', [
      'applyBackendLanguage',
    ]);

    api.me.and.returnValue(of(makeUser()));
    api.listApps.and.returnValue(of([makeApplication()]));
    api.listDevices.and.returnValue(of([makeDevice()]));
    api.listNotifications.and.returnValue(of([]));
    api.listFutureNotifications.and.returnValue(of([]));
    api.listAppQuietPeriods.and.returnValue(of([]));
    api.listDeviceQuietPeriods.and.returnValue(of([]));
    api.createApp.and.returnValue(
      of({
        ...makeApplication({ id: 999 }),
        app_token: 'app-token-secret',
      }),
    );
    api.activateApp.and.returnValue(of({ app_id: 101, is_active: true }));
    api.deactivateApp.and.returnValue(of({ app_id: 101, is_active: false }));
    api.regenerateAppToken.and.returnValue(
      of({
        app_id: 101,
        app_token_prefix: 'apt_new',
        new_app_token: 'new-secret',
      }),
    );
    api.revokeAppToken.and.returnValue(of({ app_id: 101, revoked_at: '2026-03-28T10:00:00Z' }));
    api.logout.and.returnValue(of(void 0));

    TestBed.configureTestingModule({
      providers: [
        ConsoleShellService,
        { provide: PushitApiService, useValue: api },
        { provide: SessionService, useValue: session },
        { provide: LanguagePreferenceService, useValue: languagePreference },
      ],
    });

    service = TestBed.inject(ConsoleShellService);
  });

  it('loads shell data and supplementary counts', () => {
    api.listNotifications.and.returnValue(of([{}] as never[]));
    api.listFutureNotifications.and.returnValue(of([{}, {}] as never[]));
    api.listAppQuietPeriods.and.returnValue(
      of([
        {
          id: 1,
          application: 101,
          name: 'App silence',
          period_type: 'ONCE',
          start_at: null,
          end_at: null,
          recurrence_days: [],
          start_time: null,
          end_time: null,
          is_active: true,
          created_at: '2026-03-28T10:00:00Z',
          updated_at: '2026-03-28T10:00:00Z',
        },
      ] as ApplicationQuietPeriod[]),
    );
    api.listDeviceQuietPeriods.and.returnValue(
      of([
        {
          id: 2,
          device: 201,
          name: 'Device silence 1',
          period_type: 'ONCE',
          start_at: null,
          end_at: null,
          recurrence_days: [],
          start_time: null,
          end_time: null,
          is_active: true,
          created_at: '2026-03-28T10:00:00Z',
          updated_at: '2026-03-28T10:00:00Z',
        },
        {
          id: 3,
          device: 201,
          name: 'Device silence 2',
          period_type: 'ONCE',
          start_at: null,
          end_at: null,
          recurrence_days: [],
          start_time: null,
          end_time: null,
          is_active: true,
          created_at: '2026-03-28T10:00:00Z',
          updated_at: '2026-03-28T10:00:00Z',
        },
      ] as DeviceQuietPeriod[]),
    );

    service.loadShell();

    expect(session.updateUser).toHaveBeenCalledWith(makeUser());
    expect(languagePreference.applyBackendLanguage).toHaveBeenCalledWith('FR');
    expect(service.apps().length).toBe(1);
    expect(service.devicesCount()).toBe(1);
    expect(service.notificationsCount()).toBe(3);
    expect(service.quietPeriodsCount()).toBe(3);
    expect(service.selectedAppId()).toBe(101);
  });

  it('ensureLoaded reuses the stored session user when apps are already available', () => {
    session.user.set(makeUser({ username: 'cached-user' }));
    service.apps.set([makeApplication()]);
    service.user.set(null);

    service.ensureLoaded();

    expect(service.user()?.username).toBe('cached-user');
    expect(api.me).not.toHaveBeenCalled();
  });

  it('ensureLoaded triggers a shell load when data is missing', () => {
    service.ensureLoaded();

    expect(api.me).toHaveBeenCalled();
  });

  it('refreshNavigationCounts updates counts and keeps a valid selection', () => {
    service.selectedAppId.set(101);
    api.listNotifications.and.returnValue(of([]));
    api.listFutureNotifications.and.returnValue(of([]));

    service.refreshNavigationCounts();

    expect(api.listApps).toHaveBeenCalled();
    expect(api.listDevices).toHaveBeenCalled();
    expect(service.selectedAppId()).toBe(101);
    expect(service.devicesCount()).toBe(1);
  });

  it('sets an error when refreshNavigationCounts fails', () => {
    api.listApps.and.returnValue(throwError(() => new Error('boom')));

    service.refreshNavigationCounts();

    expect(service.error()).toBe("Impossible de rafraichir les compteurs de navigation.");
  });

  it('stores generated token information when creating an app', () => {
    const onDone = jasmine.createSpy('onDone');

    service.createApp({ name: 'Demo', description: 'Desc' }, onDone);

    expect(api.createApp).toHaveBeenCalledWith({ name: 'Demo', description: 'Desc' });
    expect(service.lastGeneratedToken()).toEqual({
      appId: 999,
      token: 'app-token-secret',
      prefix: 'apt_12345678',
    });
    expect(onDone).toHaveBeenCalled();
  });

  it('toggles application state using the proper endpoint', () => {
    const onDone = jasmine.createSpy('onDone');

    service.toggleAppState(makeApplication({ is_active: true }), onDone);
    service.toggleAppState(makeApplication({ id: 102, is_active: false }), onDone);

    expect(api.deactivateApp).toHaveBeenCalledWith(101);
    expect(api.activateApp).toHaveBeenCalledWith(102);
  });

  it('regenerates and revokes application tokens', () => {
    service.regenerateToken(makeApplication());
    service.revokeToken(makeApplication());

    expect(service.lastGeneratedToken()).toEqual({
      appId: 101,
      token: 'new-secret',
      prefix: 'apt_new',
    });
    expect(api.revokeAppToken).toHaveBeenCalledWith(101);
  });

  it('logs out immediately when no refresh token exists', () => {
    service.logout();

    expect(api.logout).not.toHaveBeenCalled();
    expect(session.clear).toHaveBeenCalledWith(true);
  });

  it('logs out through the API and clears the session even on API failure', () => {
    session.refreshToken.and.returnValue('refresh-token');
    api.logout.and.returnValue(throwError(() => new Error('boom')));

    service.logout();

    expect(api.logout).toHaveBeenCalledWith('refresh-token');
    expect(session.clear).toHaveBeenCalledWith(true);
  });
});
