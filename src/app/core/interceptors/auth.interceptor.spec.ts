import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { SessionService } from '../services/session.service';
import { SettingsService } from '../services/settings.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let session: SessionService;
  const navigate = vi.fn().mockResolvedValue(true);

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    navigate.mockClear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: SettingsService, useValue: { apiBaseUrl: () => '/api/v1' } },
        { provide: Router, useValue: { navigate } },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionService);
    session.startSession({
      access: 'old-access',
      user: { id: 1, email: 'a@b.c', userkey: 'usr_1', is_active: true, language: 'FR' },
    });
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  const expire = () =>
    httpMock.expectOne('/api/v1/apps/').flush(null, { status: 401, statusText: 'Unauthorized' });

  it('attaches the in-memory access token', () => {
    http.get('/api/v1/apps/').subscribe();

    const request = httpMock.expectOne('/api/v1/apps/');
    expect(request.request.headers.get('Authorization')).toBe('Bearer old-access');
    // Ordinary API calls never send the refresh cookie.
    expect(request.request.withCredentials).toBe(false);
    request.flush([]);
  });

  it('refreshes through the cookie on 401 and retries with the new access token', () => {
    let body: unknown;
    http.get('/api/v1/apps/').subscribe((value) => (body = value));

    expire();
    const refresh = httpMock.expectOne('/api/v1/auth/refresh/');
    expect(refresh.request.withCredentials).toBe(true);
    expect(refresh.request.headers.get('X-Auth-Mode')).toBe('cookie');
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    refresh.flush({ access: 'new-access' });
    const retry = httpMock.expectOne('/api/v1/apps/');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new-access');
    retry.flush([]);

    expect(body).toEqual([]);
  });

  it.each([401, 403])('clears the session when the refresh is rejected (%i)', (status) => {
    let error: unknown;
    http.get('/api/v1/apps/').subscribe({ error: (err) => (error = err) });

    expire();
    httpMock.expectOne('/api/v1/auth/refresh/').flush(null, { status, statusText: 'Rejected' });

    expect((error as HttpErrorResponse).status).toBe(status);
    expect(session.accessToken()).toBeNull();
    expect(localStorage.getItem('pushit.session')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/auth']);
  });

  it('keeps the session on a 5xx during refresh and surfaces the error', () => {
    let error: unknown;
    http.get('/api/v1/apps/').subscribe({ error: (err) => (error = err) });

    expire();
    httpMock
      .expectOne('/api/v1/auth/refresh/')
      .flush(null, { status: 502, statusText: 'Bad Gateway' });

    expect((error as HttpErrorResponse).status).toBe(502);
    expect(session.accessToken()).toBe('old-access');
    expect(localStorage.getItem('pushit.session')).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps the session on a network error during refresh', () => {
    let error: unknown;
    http.get('/api/v1/apps/').subscribe({ error: (err) => (error = err) });

    expire();
    httpMock.expectOne('/api/v1/auth/refresh/').error(new ProgressEvent('error'));

    expect((error as HttpErrorResponse).status).toBe(0);
    expect(session.accessToken()).toBe('old-access');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('surfaces a 401 on the retried request without clearing the session', () => {
    let error: unknown;
    http.get('/api/v1/apps/').subscribe({ error: (err) => (error = err) });

    expire();
    httpMock.expectOne('/api/v1/auth/refresh/').flush({ access: 'new-access' });
    httpMock
      .expectOne('/api/v1/apps/')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect((error as HttpErrorResponse).status).toBe(401);
    expect(session.accessToken()).toBe('new-access');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('surfaces a 401 without session and redirects to /auth', () => {
    session.clear();
    let error: unknown;
    http.get('/api/v1/apps/').subscribe({ error: (err) => (error = err) });

    expire();
    httpMock.expectNone('/api/v1/auth/refresh/');

    expect((error as HttpErrorResponse).status).toBe(401);
    expect(navigate).toHaveBeenCalledWith(['/auth']);
  });
});
