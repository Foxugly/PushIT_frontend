import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PushitApiService } from './pushit-api.service';

describe('PushitApiService.deleteMe', () => {
  it('sends DELETE /auth/me/ with the current password in the body', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(PushitApiService);
    const http = TestBed.inject(HttpTestingController);

    let done = false;
    api.deleteMe('hunter2').subscribe(() => (done = true));

    const req = http.expectOne((r) => r.url.endsWith('/auth/me/'));
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual({ current_password: 'hunter2' });
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(done).toBe(true);
    http.verify();
  });
});

describe('PushitApiService cookie-mode auth calls', () => {
  let api: PushitApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(PushitApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  const expectCookieMode = (path: string) => {
    const req = http.expectOne((r) => r.url.endsWith(path));
    expect(req.request.headers.get('X-Auth-Mode')).toBe('cookie');
    expect(req.request.withCredentials).toBe(true);
    return req;
  };

  it('login opts into the HttpOnly refresh cookie and forwards remember_me', () => {
    api.login({ email: 'a@b.c', password: 'x', remember_me: false }).subscribe();
    const req = expectCookieMode('/auth/login/');
    expect(req.request.body).toEqual({ email: 'a@b.c', password: 'x', remember_me: false });
    req.flush({ access: 'a', user: {} });
  });

  it('magic-link verify, email confirm and password change opt in too', () => {
    api.verifyMagicLink('t').subscribe();
    expectCookieMode('/auth/magic-link/verify/').flush({ access: 'a', user: {} });

    api.confirmEmail('u', 't').subscribe();
    expectCookieMode('/auth/email/confirm/').flush({ access: 'a', user: {} });

    api.changePassword({ current_password: 'a', new_password: 'b' }).subscribe();
    expectCookieMode('/auth/password/change/').flush({ access: 'a', user: {} });

    api.deleteMe('pw').subscribe();
    expectCookieMode('/auth/me/').flush(null, { status: 204, statusText: 'No Content' });
  });

  it('logout sends no refresh token in the body: the backend uses the cookie', () => {
    api.logout().subscribe();
    const req = expectCookieMode('/auth/logout/');
    expect(req.request.body).toEqual({});
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('ordinary API calls never send credentials', () => {
    api.me().subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/auth/me/'));
    expect(req.request.withCredentials).toBe(false);
    expect(req.request.headers.has('X-Auth-Mode')).toBe(false);
    req.flush({});
  });
});
