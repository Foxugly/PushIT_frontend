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
    session.startSession(
      {
        access: 'old-access',
        refresh: 'old-refresh',
        user: { id: 1, email: 'a@b.c', userkey: 'usr_1', is_active: true, language: 'FR' },
      },
      true,
    );
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  const expire = () =>
    httpMock.expectOne('/api/v1/apps/').flush(null, { status: 401, statusText: 'Unauthorized' });

  it('refreshes on 401 and retries with the new access token', () => {
    let body: unknown;
    http.get('/api/v1/apps/').subscribe((value) => (body = value));

    expire();
    httpMock.expectOne('/api/v1/auth/refresh/').flush({ access: 'new-access', refresh: 'new-refresh' });
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
    expect(session.refreshToken()).toBeNull();
    expect(localStorage.getItem('pushit.refreshToken')).toBeNull();
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
    expect(session.refreshToken()).toBe('old-refresh');
    expect(localStorage.getItem('pushit.refreshToken')).toBe('old-refresh');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps the session on a network error during refresh', () => {
    let error: unknown;
    http.get('/api/v1/apps/').subscribe({ error: (err) => (error = err) });

    expire();
    httpMock.expectOne('/api/v1/auth/refresh/').error(new ProgressEvent('error'));

    expect((error as HttpErrorResponse).status).toBe(0);
    expect(session.refreshToken()).toBe('old-refresh');
    expect(navigate).not.toHaveBeenCalled();
  });
});
