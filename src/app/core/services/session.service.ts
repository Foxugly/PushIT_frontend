import { HttpClient, HttpContext, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  defer,
  finalize,
  firstValueFrom,
  from,
  map,
  Observable,
  shareReplay,
  tap,
  throwError,
  timeout,
} from 'rxjs';

import { cookieAuthOptions } from '../http/auth-cookie';
import { SKIP_AUTH } from '../http/http-context.tokens';
import { LoginResponse, TokenRefreshResponse, UserMe } from '../models/api.models';
import { SettingsService } from './settings.service';
import { StorageService } from './storage.service';

/**
 * Non-secret "a session exists" hint in localStorage. It tells a fresh page
 * load whether to try the silent restore, and its `storage` events tell the
 * other tabs "session changed" (new value) or "logged out" (removed). It never
 * carries a token: the refresh token lives in the backend's HttpOnly cookie
 * and the access token in memory only.
 */
export const SESSION_HINT_KEY = 'pushit.session';

/** Pre-cookie storage keys. Read once for the migration, then deleted. */
export const LEGACY_ACCESS_TOKEN_KEY = 'pushit.accessToken';
export const LEGACY_REFRESH_TOKEN_KEY = 'pushit.refreshToken';
export const LEGACY_USER_KEY = 'pushit.user';
const LEGACY_KEYS: readonly string[] = [
  LEGACY_REFRESH_TOKEN_KEY,
  LEGACY_ACCESS_TOKEN_KEY,
  LEGACY_USER_KEY,
];

/** Web Locks name serialising `auth/refresh/` across every tab of the origin. */
export const REFRESH_LOCK_NAME = 'pushit.refresh';

/** Upper bound on the boot-time restore, so a hung API never blocks the SPA. */
const RESTORE_TIMEOUT_MS = 10_000;

/** 401/403 from `auth/refresh/` = refresh token rejected (expired, blacklisted, absent). */
export function isRejectedRefresh(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403);
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly settings = inject(SettingsService);
  private readonly storage = inject(StorageService);

  // Memory only: a reload re-obtains the access token from the refresh cookie.
  private readonly accessTokenSignal = signal<string | null>(null);
  private readonly userSignal = signal<UserMe | null>(null);

  private refreshRequest$: Observable<string> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const onStorage = (event: StorageEvent) => this.onStorageEvent(event);
      window.addEventListener('storage', onStorage);
      inject(DestroyRef).onDestroy(() => window.removeEventListener('storage', onStorage));
    }
  }

  readonly isAuthenticated = computed(() => Boolean(this.accessTokenSignal() && this.userSignal()));

  // Drives the admin-only console nav entry / adminGuard. Defaults to false when
  // the flag is absent (older backend) — never grant admin on a missing field.
  readonly isAdmin = computed(() => Boolean(this.userSignal()?.is_staff));
  /** Un cran au-dessus d'isAdmin : requis pour les gestes qui engagent de
   *  l'argent, comme offrir un acces gratuit. Le serveur exige le meme niveau. */
  readonly isSuperuser = computed(() => Boolean(this.userSignal()?.is_superuser));

  accessToken(): string | null {
    return this.accessTokenSignal();
  }

  user(): UserMe | null {
    return this.userSignal();
  }

  /**
   * Whether a refresh is worth attempting: a live in-memory session, the
   * session hint, or a legacy refresh token still waiting for its migration.
   */
  hasSession(): boolean {
    return (
      this.accessTokenSignal() !== null ||
      this.storage.findString(SESSION_HINT_KEY) !== null ||
      this.legacyRefreshToken() !== null
    );
  }

  /**
   * Whether the access token's `exp` is in the past. Evaluated fresh on each
   * call (NOT a computed — it depends on the wall clock, not a signal). Returns
   * false when there's no token or the payload can't be decoded (don't lock the
   * user out on a parsing quirk; the 401 interceptor remains the backstop).
   */
  accessTokenExpired(): boolean {
    const token = this.accessTokenSignal();
    if (!token) {
      return false;
    }
    const exp = this.decodeJwtExp(token);
    if (exp === null) {
      return false;
    }
    // 5s skew tolerance.
    return exp * 1000 <= Date.now() - 5000;
  }

  private decodeJwtExp(token: string): number | null {
    const payload = token.split('.')[1];
    if (!payload) {
      return null;
    }
    try {
      const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      return typeof json.exp === 'number' ? json.exp : null;
    } catch {
      return null;
    }
  }

  /**
   * Adopt a login / magic-link / email-confirm response. The refresh token is
   * already in the HttpOnly cookie (the "remember me" choice was sent to the
   * backend, which picks a persistent or a browser-session cookie).
   */
  startSession(response: LoginResponse): void {
    this.accessTokenSignal.set(response.access);
    this.userSignal.set(response.user);
    this.dropLegacyStorage();
    this.announceSessionChange();
  }

  updateUser(user: UserMe): void {
    this.userSignal.set(user);
  }

  updateAccessToken(accessToken: string): void {
    this.accessTokenSignal.set(accessToken);
  }

  /**
   * Adopt the response of a password change: the backend blacklisted every
   * previous refresh token and re-set the cookie; keep the fresh access token.
   */
  adoptTokens(response: LoginResponse): void {
    this.accessTokenSignal.set(response.access);
    this.userSignal.set(response.user);
    this.announceSessionChange();
  }

  /** Drop the local session (memory + hint) and tell the other tabs. */
  clear(redirectToAuth = false): void {
    this.accessTokenSignal.set(null);
    this.userSignal.set(null);
    this.storage.remove(SESSION_HINT_KEY, 'both');
    this.dropLegacyStorage();

    if (redirectToAuth) {
      void this.router.navigate(['/auth']);
    }
  }

  /**
   * Silent restore at boot (app initializer) and when another tab signs in:
   * refresh through the cookie, then load `/me/`. Never throws. A rejected
   * refresh (401/403) ends the session; a network error / 5xx keeps the hint
   * so the next load retries.
   */
  async restore(): Promise<void> {
    if (!this.hasSession()) {
      return;
    }
    try {
      const access = await firstValueFrom(
        this.refreshAccessToken().pipe(timeout(RESTORE_TIMEOUT_MS)),
      );
      const user = await firstValueFrom(
        this.http
          .get<UserMe>(`${this.settings.apiBaseUrl()}/auth/me/`, {
            headers: new HttpHeaders({ Authorization: `Bearer ${access}` }),
            context: new HttpContext().set(SKIP_AUTH, true),
          })
          .pipe(timeout(RESTORE_TIMEOUT_MS)),
      );
      this.userSignal.set(user);
      if (this.storage.findString(SESSION_HINT_KEY) === null) {
        // Migrated from a legacy token: start announcing the session.
        this.announceSessionChange();
      }
    } catch (error) {
      if (isRejectedRefresh(error)) {
        this.clear();
      } else {
        // Keep the hint, but render as signed out until a later retry.
        this.accessTokenSignal.set(null);
      }
    }
  }

  /**
   * Obtain a fresh access token from the refresh cookie. Concurrent callers in
   * this tab share one request; across tabs the refresh is serialised with the
   * Web Locks API, so two tabs never present the same cookie (the backend
   * rotates + blacklists it on every refresh: the second would be rejected).
   * The browser sends whatever cookie is current when the request leaves, so a
   * tab that waited for the lock uses the token the other tab just rotated.
   */
  refreshAccessToken(): Observable<string> {
    if (!this.hasSession()) {
      return throwError(() => new Error('No session to refresh'));
    }

    if (this.refreshRequest$) {
      return this.refreshRequest$;
    }

    this.refreshRequest$ = defer(() => this.withRefreshLock(() => this.postRefresh())).pipe(
      shareReplay({ bufferSize: 1, refCount: true }),
      finalize(() => {
        this.refreshRequest$ = null;
      }),
    );

    return this.refreshRequest$;
  }

  private postRefresh(): Observable<string> {
    // Migration: a token left in storage by the pre-cookie SPA is presented
    // once in the body (cookie mode on, so the rotated token lands in the
    // cookie), then deleted. Read inside the lock: another tab may already
    // have migrated it.
    const legacy = this.legacyRefreshToken();
    return this.http
      .post<TokenRefreshResponse>(
        `${this.settings.apiBaseUrl()}/auth/refresh/`,
        legacy ? { refresh: legacy } : {},
        { ...cookieAuthOptions(), context: new HttpContext().set(SKIP_AUTH, true) },
      )
      .pipe(
        tap({
          next: () => {
            if (legacy) this.dropLegacyStorage();
          },
          error: (error: unknown) => {
            if (legacy && isRejectedRefresh(error)) this.dropLegacyStorage();
          },
        }),
        map((response) => {
          this.accessTokenSignal.set(response.access);
          return response.access;
        }),
      );
  }

  /** Run `task` under the cross-tab refresh lock; plain call when Web Locks is unavailable. */
  private withRefreshLock<T>(task: () => Observable<T>): Observable<T> {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (!locks?.request) {
      return task();
    }
    return from(
      locks.request(REFRESH_LOCK_NAME, () => firstValueFrom(task())) as Promise<T>,
    );
  }

  private onStorageEvent(event: StorageEvent): void {
    // event.key === null <=> storage.clear() in another tab.
    if (event.key !== null && event.key !== SESSION_HINT_KEY) {
      return;
    }
    if (event.newValue === null) {
      // Logged out elsewhere (the cookie is gone too): drop our copy.
      const hadSession = this.accessTokenSignal() !== null;
      this.accessTokenSignal.set(null);
      this.userSignal.set(null);
      if (hadSession) {
        void this.router.navigate(['/auth']);
      }
      return;
    }
    // Signed in / password changed elsewhere: the shared cookie already holds
    // the new session; pick it up (access token + user).
    void this.restore();
  }

  /** New hint value -> a `storage` event in every other tab. */
  private announceSessionChange(): void {
    this.storage.setString(SESSION_HINT_KEY, String(Date.now()), 'local');
  }

  private legacyRefreshToken(): string | null {
    return this.storage.findString(LEGACY_REFRESH_TOKEN_KEY)?.value ?? null;
  }

  private dropLegacyStorage(): void {
    for (const key of LEGACY_KEYS) {
      this.storage.remove(key, 'both');
    }
  }
}
