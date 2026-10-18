import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';

import { adminGuard, authGuard, guestGuard } from './auth.guard';
import { SessionService } from '../services/session.service';

describe('auth guards', () => {
  let router: jasmine.SpyObj<Router>;
  let session: {
    isAuthenticated: ReturnType<typeof signal<boolean>>;
    isAdmin: ReturnType<typeof signal<boolean>>;
    accessTokenExpired: jasmine.Spy<() => boolean>;
    clear: jasmine.Spy;
  };
  const route = {} as ActivatedRouteSnapshot;
  const state = { url: '/' } as RouterStateSnapshot;

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);
    router.createUrlTree.and.callFake((commands) => ({ commands } as unknown as UrlTree));
    session = {
      isAuthenticated: signal(false),
      isAdmin: signal(false),
      accessTokenExpired: jasmine.createSpy('accessTokenExpired').and.returnValue(false),
      clear: jasmine.createSpy('clear'),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: SessionService, useValue: session },
      ],
    });
  });

  it('authGuard allows authenticated users', () => {
    session.isAuthenticated.set(true);

    const result = TestBed.runInInjectionContext(() => authGuard(route, state));

    expect(result).toBeTrue();
  });

  it('authGuard allows an expired access token (the interceptor refreshes it via the cookie)', () => {
    session.isAuthenticated.set(true);
    session.accessTokenExpired.and.returnValue(true);

    const result = TestBed.runInInjectionContext(() => authGuard(route, state));

    expect(session.clear).not.toHaveBeenCalled();
    expect(result).toBeTrue();
  });

  it('authGuard redirects guests to /auth', () => {
    const result = TestBed.runInInjectionContext(() => authGuard(route, state));

    expect(router.createUrlTree).toHaveBeenCalledWith(['/auth']);
    expect(result).toEqual(jasmine.objectContaining({ commands: ['/auth'] }));
  });

  it('guestGuard redirects authenticated users to /dashboard', () => {
    session.isAuthenticated.set(true);

    const result = TestBed.runInInjectionContext(() => guestGuard(route, state));

    expect(router.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
    expect(result).toEqual(jasmine.objectContaining({ commands: ['/dashboard'] }));
  });

  it('guestGuard allows guests', () => {
    const result = TestBed.runInInjectionContext(() => guestGuard(route, state));

    expect(result).toBeTrue();
  });

  it('adminGuard allows staff users', () => {
    session.isAdmin.set(true);

    const result = TestBed.runInInjectionContext(() => adminGuard(route, state));

    expect(result).toBeTrue();
  });

  it('adminGuard redirects non-staff users to /dashboard', () => {
    session.isAdmin.set(false);

    const result = TestBed.runInInjectionContext(() => adminGuard(route, state));

    expect(router.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
    expect(result).toEqual(jasmine.objectContaining({ commands: ['/dashboard'] }));
  });
});
