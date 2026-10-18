import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { LoginResponse, UserMe } from '../models/api.models';
import { SessionService } from './session.service';
import { SettingsService } from './settings.service';

describe('SessionService', () => {
  let service: SessionService;
  let httpMock: HttpTestingController;
  const navigate = vi.fn().mockResolvedValue(true);

  const user: UserMe = {
    id: 1,
    email: 'renaud@example.com',
    userkey: 'usr_123',
    is_active: true,
    language: 'FR',
  };

  // Cookie mode: the backend keeps the refresh token out of the body.
  const loginResponse: LoginResponse = { access: 'access-token', user };

  function create(): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SessionService,
        { provide: SettingsService, useValue: { apiBaseUrl: () => '/api/v1' } },
        { provide: Router, useValue: { navigate } },
      ],
    });
    service = TestBed.inject(SessionService);
    httpMock = TestBed.inject(HttpTestingController);
  }

  const expectCookieRefresh = () => {
    const request = httpMock.expectOne('/api/v1/auth/refresh/');
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('X-Auth-Mode')).toBe('cookie');
    return request;
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    navigate.mockClear();
    create();
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
    localStorage.clear();
    sessionStorage.clear();
    delete (navigator as { locks?: unknown }).locks;
  });

  describe('token storage', () => {
    it('keeps the access token and user in memory only', () => {
      service.startSession(loginResponse);

      expect(service.accessToken()).toBe('access-token');
      expect(service.isAuthenticated()).toBe(true);
      for (const storage of [localStorage, sessionStorage]) {
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i)!;
          expect(storage.getItem(key)).not.toContain('access-token');
        }
      }
      expect(localStorage.getItem('pushit.accessToken')).toBeNull();
      expect(localStorage.getItem('pushit.refreshToken')).toBeNull();
      expect(localStorage.getItem('pushit.user')).toBeNull();
    });

    it('writes only a non-secret session hint', () => {
      service.startSession(loginResponse);

      expect(localStorage.getItem('pushit.session')).toMatch(/^\d+$/);
    });

    it('adoptTokens replaces the access token and user (password change)', () => {
      service.startSession(loginResponse);

      service.adoptTokens({ access: 'access-2', user: { ...user, email: 'new@example.com' } });

      expect(service.accessToken()).toBe('access-2');
      expect(service.user()?.email).toBe('new@example.com');
      expect(localStorage.getItem('pushit.accessToken')).toBeNull();
    });

    it('clear drops memory + hint and redirects to auth when requested', () => {
      service.startSession(loginResponse);

      service.clear(true);

      expect(service.accessToken()).toBeNull();
      expect(service.user()).toBeNull();
      expect(localStorage.getItem('pushit.session')).toBeNull();
      expect(navigate).toHaveBeenCalledWith(['/auth']);
    });
  });

  describe('refresh through the cookie', () => {
    it('shares a single cookie refresh request and updates the access token', () => {
      service.startSession(loginResponse);

      let first: string | null = null;
      let second: string | null = null;
      service.refreshAccessToken().subscribe((token) => (first = token));
      service.refreshAccessToken().subscribe((token) => (second = token));

      const request = expectCookieRefresh();
      expect(request.request.body).toEqual({});
      request.flush({ access: 'new-access-token' });

      expect(first as string | null).toBe('new-access-token');
      expect(second as string | null).toBe('new-access-token');
      expect(service.accessToken()).toBe('new-access-token');
    });

    it('refuses to refresh without any session', async () => {
      await expect(firstValueFrom(service.refreshAccessToken())).rejects.toThrow();
      httpMock.expectNone('/api/v1/auth/refresh/');
    });

    it('serialises the refresh across tabs with the Web Locks API', async () => {
      const request = vi.fn((_name: string, callback: () => Promise<unknown>) => callback());
      Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } });
      service.startSession(loginResponse);

      const result = firstValueFrom(service.refreshAccessToken());
      expectCookieRefresh().flush({ access: 'new-access-token' });

      await expect(result).resolves.toBe('new-access-token');
      expect(request).toHaveBeenCalledWith('pushit.refresh', expect.any(Function));
    });

    it('waits for the lock before sending (the other tab rotates the cookie first)', async () => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      const request = vi.fn(async (_name: string, callback: () => Promise<unknown>) => {
        await gate; // the other tab holds the lock
        return callback();
      });
      Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } });
      service.startSession(loginResponse);

      const result = firstValueFrom(service.refreshAccessToken());
      httpMock.expectNone('/api/v1/auth/refresh/');
      release();
      await Promise.resolve();
      await Promise.resolve();

      expectCookieRefresh().flush({ access: 'after-lock' });
      await expect(result).resolves.toBe('after-lock');
    });
  });

  describe('silent restore', () => {
    it('does nothing without a session hint (anonymous visitor)', async () => {
      await service.restore();

      httpMock.expectNone('/api/v1/auth/refresh/');
      expect(service.isAuthenticated()).toBe(false);
    });

    it('restores the session from the cookie, then loads /me/', async () => {
      localStorage.setItem('pushit.session', '1');

      const done = service.restore();
      expectCookieRefresh().flush({ access: 'restored-access' });
      await Promise.resolve();
      await Promise.resolve();
      const me = httpMock.expectOne('/api/v1/auth/me/');
      expect(me.request.headers.get('Authorization')).toBe('Bearer restored-access');
      me.flush(user);
      await done;

      expect(service.isAuthenticated()).toBe(true);
      expect(service.user()).toEqual(user);
    });

    it.each([401, 403])('a rejected cookie (%i) ends the session', async (status) => {
      localStorage.setItem('pushit.session', '1');

      const done = service.restore();
      expectCookieRefresh().flush(null, { status, statusText: 'Rejected' });
      await done;

      expect(service.isAuthenticated()).toBe(false);
      expect(localStorage.getItem('pushit.session')).toBeNull();
    });

    it('keeps the hint on a network error / 5xx (retried at the next load)', async () => {
      localStorage.setItem('pushit.session', '1');

      const done = service.restore();
      expectCookieRefresh().flush(null, { status: 502, statusText: 'Bad Gateway' });
      await done;

      expect(service.isAuthenticated()).toBe(false);
      expect(localStorage.getItem('pushit.session')).toBe('1');
    });
  });

  describe('migration from the pre-cookie storage', () => {
    it('presents the legacy refresh once in the body, in cookie mode, then deletes it', async () => {
      localStorage.setItem('pushit.refreshToken', 'legacy-refresh');
      localStorage.setItem('pushit.accessToken', 'legacy-access');
      localStorage.setItem('pushit.user', JSON.stringify(user));

      const done = service.restore();
      const request = expectCookieRefresh();
      expect(request.request.body).toEqual({ refresh: 'legacy-refresh' });
      request.flush({ access: 'migrated-access' });
      await Promise.resolve();
      await Promise.resolve();
      httpMock.expectOne('/api/v1/auth/me/').flush(user);
      await done;

      expect(service.accessToken()).toBe('migrated-access');
      expect(localStorage.getItem('pushit.refreshToken')).toBeNull();
      expect(localStorage.getItem('pushit.accessToken')).toBeNull();
      expect(localStorage.getItem('pushit.user')).toBeNull();
      expect(localStorage.getItem('pushit.session')).not.toBeNull();
    });

    it('migrates a browser-only (sessionStorage) legacy token too', async () => {
      sessionStorage.setItem('pushit.refreshToken', 'legacy-session-refresh');

      const done = service.restore();
      const request = expectCookieRefresh();
      expect(request.request.body).toEqual({ refresh: 'legacy-session-refresh' });
      request.flush({ access: 'migrated-access' });
      await Promise.resolve();
      await Promise.resolve();
      httpMock.expectOne('/api/v1/auth/me/').flush(user);
      await done;

      expect(sessionStorage.getItem('pushit.refreshToken')).toBeNull();
      expect(service.isAuthenticated()).toBe(true);
    });

    it('drops a rejected legacy token', async () => {
      localStorage.setItem('pushit.refreshToken', 'legacy-refresh');

      const done = service.restore();
      expectCookieRefresh().flush(null, { status: 401, statusText: 'Unauthorized' });
      await done;

      expect(localStorage.getItem('pushit.refreshToken')).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
    });

    it('keeps the legacy token on a network error (one more try next load)', async () => {
      localStorage.setItem('pushit.refreshToken', 'legacy-refresh');

      const done = service.restore();
      expectCookieRefresh().error(new ProgressEvent('error'));
      await done;

      expect(localStorage.getItem('pushit.refreshToken')).toBe('legacy-refresh');
    });

    it('a login drops any legacy token left in storage', () => {
      localStorage.setItem('pushit.refreshToken', 'legacy-refresh');

      service.startSession(loginResponse);

      expect(localStorage.getItem('pushit.refreshToken')).toBeNull();
    });
  });

  describe('multi-tab', () => {
    const emitStorage = (key: string | null, newValue: string | null) =>
      window.dispatchEvent(new StorageEvent('storage', { key, newValue, storageArea: localStorage }));

    it('logs out when another tab removes the session hint', () => {
      service.startSession(loginResponse);

      localStorage.removeItem('pushit.session');
      emitStorage('pushit.session', null);

      expect(service.accessToken()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
      expect(navigate).toHaveBeenCalledWith(['/auth']);
    });

    it('logs out when another tab clears the storage', () => {
      service.startSession(loginResponse);

      localStorage.clear();
      emitStorage(null, null);

      expect(service.isAuthenticated()).toBe(false);
    });

    it('restores from the shared cookie when another tab signs in', async () => {
      localStorage.setItem('pushit.session', '123');
      emitStorage('pushit.session', '123');

      expectCookieRefresh().flush({ access: 'from-other-tab' });
      await Promise.resolve();
      await Promise.resolve();
      httpMock.expectOne('/api/v1/auth/me/').flush(user);
      await Promise.resolve();

      expect(service.accessToken()).toBe('from-other-tab');
    });

    it('ignores storage events for unrelated keys', () => {
      service.startSession(loginResponse);

      emitStorage('pushit.theme', 'dark');

      httpMock.expectNone('/api/v1/auth/refresh/');
      expect(service.accessToken()).toBe('access-token');
    });

    it('storage events never carry a token', () => {
      const setItem = vi.spyOn(Storage.prototype, 'setItem');

      service.startSession(loginResponse);
      service.adoptTokens({ access: 'access-2', user });

      for (const [, value] of setItem.mock.calls) {
        expect(value).not.toMatch(/access/);
      }
      setItem.mockRestore();
    });
  });
});
