import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { LoginResponse, UserMe } from '../models/api.models';
import { SessionService } from './session.service';
import { SettingsService } from './settings.service';

describe('SessionService', () => {
  let service: SessionService;
  let httpMock: HttpTestingController;
  let router: jasmine.SpyObj<Router>;

  const user: UserMe = {
    id: 1,
    email: 'renaud@example.com',
    username: 'renaud',
    userkey: 'usr_123',
    is_active: true,
    language: 'FR',
  };

  const loginResponse: LoginResponse = {
    access: 'access-token',
    refresh: 'refresh-token',
    user,
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SessionService,
        { provide: SettingsService, useValue: { apiBaseUrl: () => '/api/v1' } },
        { provide: Router, useValue: router },
      ],
    });

    service = TestBed.inject(SessionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('stores a remembered session in localStorage', () => {
    service.startSession(loginResponse, true);

    expect(localStorage.getItem('pushit.accessToken')).toBe('access-token');
    expect(localStorage.getItem('pushit.refreshToken')).toBe('refresh-token');
    expect(localStorage.getItem('pushit.user')).toContain('"username":"renaud"');
    expect(sessionStorage.getItem('pushit.accessToken')).toBeNull();
  });

  it('stores a browser-only session in sessionStorage', () => {
    service.startSession(loginResponse, false);

    expect(sessionStorage.getItem('pushit.accessToken')).toBe('access-token');
    expect(sessionStorage.getItem('pushit.refreshToken')).toBe('refresh-token');
    expect(localStorage.getItem('pushit.accessToken')).toBeNull();
  });

  it('shares a single refresh request and updates the access token', () => {
    service.startSession(loginResponse, true);

    let firstResult: string | null = null;
    let secondResult: string | null = null;

    service.refreshAccessToken().subscribe((token) => (firstResult = token));
    service.refreshAccessToken().subscribe((token) => (secondResult = token));

    const request = httpMock.expectOne('/api/v1/auth/refresh/');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ refresh: 'refresh-token' });

    request.flush({ access: 'new-access-token' });

    expect(firstResult as string | null).toBe('new-access-token');
    expect(secondResult as string | null).toBe('new-access-token');
    expect(service.accessToken()).toBe('new-access-token');
    expect(localStorage.getItem('pushit.accessToken')).toBe('new-access-token');
  });

  it('clears the session and redirects to auth when requested', () => {
    service.startSession(loginResponse, true);

    service.clear(true);

    expect(service.accessToken()).toBeNull();
    expect(service.refreshToken()).toBeNull();
    expect(service.user()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/auth']);
  });
});
