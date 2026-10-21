import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { vi } from 'vitest';

import { adminGuard, authGuard, guestGuard } from './auth.guard';
import { SessionService } from '../services/session.service';
import { documentNavigation, TURNSTILE_SCRIPT_SRC } from '../../shared/turnstile/turnstile';

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

  describe('after Cloudflare Turnstile was loaded in this document', () => {
    let script: HTMLScriptElement;

    beforeEach(() => {
      script = document.createElement('script');
      script.setAttribute('src', TURNSTILE_SCRIPT_SRC);
      document.head.appendChild(script);
    });

    afterEach(() => {
      script.remove();
      vi.restoreAllMocks();
    });

    it('authGuard enters the console through a full page load', () => {
      const assign = vi.spyOn(documentNavigation, 'assign').mockImplementation(() => undefined);
      session.isAuthenticated.set(true);

      const result = TestBed.runInInjectionContext(() =>
        authGuard(route, { url: '/dashboard/applications?tab=x' } as RouterStateSnapshot),
      );

      expect(result).toBe(false);
      expect(assign).toHaveBeenCalledWith('/dashboard/applications?tab=x');
    });

    it('authGuard still sends guests to /auth without reloading', () => {
      const assign = vi.spyOn(documentNavigation, 'assign').mockImplementation(() => undefined);

      const result = TestBed.runInInjectionContext(() => authGuard(route, state));

      expect(assign).not.toHaveBeenCalled();
      expect(result).toEqual(jasmine.objectContaining({ commands: ['/auth'] }));
    });
  });

  it('authGuard redirects guests to /auth', () => {
    const result = TestBed.runInInjectionContext(() =>
      authGuard(route, { url: '/dashboard' } as RouterStateSnapshot),
    );

    expect(router.createUrlTree).toHaveBeenCalledWith(['/auth']);
    expect(result).toEqual(jasmine.objectContaining({ commands: ['/auth'] }));
  });

  it('authGuard passes a deep link to /auth as returnUrl (path + query + fragment)', () => {
    const url = '/dashboard/applications/10?tab=sending#top';

    TestBed.runInInjectionContext(() => authGuard(route, { url } as RouterStateSnapshot));

    expect(router.createUrlTree).toHaveBeenCalledWith(['/auth'], {
      queryParams: { returnUrl: url },
    });
  });

  it('authGuard drops an unsafe URL instead of forwarding it', () => {
    TestBed.runInInjectionContext(() =>
      authGuard(route, { url: '//evil.example/x' } as RouterStateSnapshot),
    );

    expect(router.createUrlTree).toHaveBeenCalledWith(['/auth']);
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
