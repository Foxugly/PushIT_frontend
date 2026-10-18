import { HttpClient, HttpContext } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  defer,
  finalize,
  firstValueFrom,
  from,
  map,
  Observable,
  of,
  shareReplay,
  throwError,
} from 'rxjs';

import { SKIP_AUTH } from '../http/http-context.tokens';
import { LoginResponse, TokenRefreshResponse, UserMe } from '../models/api.models';
import { SettingsService } from './settings.service';
import { StorageService } from './storage.service';

export const ACCESS_TOKEN_KEY = 'pushit.accessToken';
export const REFRESH_TOKEN_KEY = 'pushit.refreshToken';
export const USER_KEY = 'pushit.user';
const SESSION_KEYS: readonly string[] = [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY];

/** Web Locks name serialising `auth/refresh/` across every tab of the origin. */
export const REFRESH_LOCK_NAME = 'pushit.refresh';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly settings = inject(SettingsService);
  private readonly storage = inject(StorageService);

  private readonly initialAccessTokenState = this.storage.findString(ACCESS_TOKEN_KEY);
  private readonly initialRefreshTokenState = this.storage.findString(REFRESH_TOKEN_KEY);
  private readonly initialUserState = this.storage.findObject<UserMe>(USER_KEY);

  private readonly persistSessionSignal = signal(this.initialAccessTokenState?.scope !== 'session');
  private readonly accessTokenSignal = signal<string | null>(this.initialAccessTokenState?.value ?? null);
  private readonly refreshTokenSignal = signal<string | null>(
    this.initialRefreshTokenState?.value ?? null,
  );
  private readonly userSignal = signal<UserMe | null>(this.initialUserState?.value ?? null);

  private refreshRequest$: Observable<string> | null = null;

  constructor() {
    // Multi-tab: the backend rotates + blacklists the refresh token on every
    // refresh, so a tab still holding the previous one would 401 and log the
    // user out. `storage` fires in the *other* tabs on every localStorage
    // write: resync our signals (rotated tokens, login, logout).
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

  refreshToken(): string | null {
    return this.refreshTokenSignal();
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

  user(): UserMe | null {
    return this.userSignal();
  }

  startSession(response: LoginResponse, rememberSession = true): void {
    this.accessTokenSignal.set(response.access);
    this.refreshTokenSignal.set(response.refresh);
    this.userSignal.set(response.user);
    this.persistSessionSignal.set(rememberSession);

    const scope = rememberSession ? 'local' : 'session';
    // Only purge the *other* scope, then overwrite: removing the target keys
    // first would make other tabs briefly see "no refresh token" (= logout).
    const otherScope = rememberSession ? 'session' : 'local';
    this.storage.remove(ACCESS_TOKEN_KEY, otherScope);
    this.storage.remove(REFRESH_TOKEN_KEY, otherScope);
    this.storage.remove(USER_KEY, otherScope);

    this.storage.setString(ACCESS_TOKEN_KEY, response.access, scope);
    this.storage.setString(REFRESH_TOKEN_KEY, response.refresh, scope);
    this.storage.setObject(USER_KEY, response.user, scope);
  }

  updateUser(user: UserMe): void {
    this.userSignal.set(user);
    this.storage.setObject(USER_KEY, user, this.currentScope());
  }

  updateAccessToken(accessToken: string): void {
    this.accessTokenSignal.set(accessToken);
    this.storage.setString(ACCESS_TOKEN_KEY, accessToken, this.currentScope());
  }

  updateRefreshToken(refreshToken: string): void {
    this.refreshTokenSignal.set(refreshToken);
    this.storage.setString(REFRESH_TOKEN_KEY, refreshToken, this.currentScope());
  }

  clear(redirectToAuth = false): void {
    this.accessTokenSignal.set(null);
    this.refreshTokenSignal.set(null);
    this.userSignal.set(null);

    // Refresh first: it is the key other tabs treat as "logged out".
    this.storage.remove(REFRESH_TOKEN_KEY, 'both');
    this.storage.remove(ACCESS_TOKEN_KEY, 'both');
    this.storage.remove(USER_KEY, 'both');

    if (redirectToAuth) {
      void this.router.navigate(['/auth']);
    }
  }

  /**
   * Obtain a fresh access token. Concurrent callers in this tab share one
   * request; across tabs the refresh is serialised with the Web Locks API and,
   * once inside the lock, storage is re-read: if another tab already rotated
   * the refresh token we adopt its tokens instead of presenting the (now
   * blacklisted) one we hold.
   */
  refreshAccessToken(): Observable<string> {
    const refreshToken = this.refreshTokenSignal();
    if (!refreshToken) {
      return throwError(() => new Error('Missing refresh token'));
    }

    if (this.refreshRequest$) {
      return this.refreshRequest$;
    }

    this.refreshRequest$ = defer(() =>
      this.withRefreshLock(() => this.refreshOrAdopt(refreshToken)),
    ).pipe(
      shareReplay({ bufferSize: 1, refCount: true }),
      finalize(() => {
        this.refreshRequest$ = null;
      }),
    );

    return this.refreshRequest$;
  }

  private refreshOrAdopt(usedRefreshToken: string): Observable<string> {
    const storedRefresh = this.storage.findString(REFRESH_TOKEN_KEY)?.value ?? null;
    if (storedRefresh && storedRefresh !== usedRefreshToken) {
      // Another tab rotated while we waited (or before its storage event
      // reached us): adopt its tokens rather than burning a blacklisted one.
      this.syncFromStorage();
      const adoptedAccess = this.accessTokenSignal();
      if (adoptedAccess) {
        return of(adoptedAccess);
      }
    }
    // Nothing stored (storage unavailable) -> keep the in-memory token; if it
    // really is revoked the backend 401s and the interceptor clears.
    return this.postRefresh(storedRefresh ?? usedRefreshToken);
  }

  private postRefresh(refreshToken: string): Observable<string> {
    return this.http
      .post<TokenRefreshResponse>(
        `${this.settings.apiBaseUrl()}/auth/refresh/`,
        { refresh: refreshToken },
        { context: new HttpContext().set(SKIP_AUTH, true) },
      )
      .pipe(
        map((response) => {
          // The backend rotates + blacklists the refresh token on every refresh;
          // persist the rotated one so the *next* refresh doesn't present a now
          // blacklisted token (which would 401 and silently log the user out).
          if (response.refresh) {
            this.updateRefreshToken(response.refresh);
          }
          this.updateAccessToken(response.access);
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
    if (event.key !== null && !SESSION_KEYS.includes(event.key)) {
      return;
    }
    this.syncFromStorage();
  }

  /** Re-read tokens + user from storage into the signals (another tab wrote them). */
  private syncFromStorage(): void {
    const refresh = this.storage.findString(REFRESH_TOKEN_KEY);
    if (!refresh) {
      // Logged out elsewhere: drop our copy (storage is already empty).
      const hadSession = this.refreshTokenSignal() !== null;
      this.accessTokenSignal.set(null);
      this.refreshTokenSignal.set(null);
      this.userSignal.set(null);
      if (hadSession) {
        void this.router.navigate(['/auth']);
      }
      return;
    }
    const access = this.storage.findString(ACCESS_TOKEN_KEY);
    const user = this.storage.findObject<UserMe>(USER_KEY);
    this.refreshTokenSignal.set(refresh.value);
    this.accessTokenSignal.set(access?.value ?? null);
    if (user) {
      this.userSignal.set(user.value);
    }
    this.persistSessionSignal.set(refresh.scope === 'local');
  }

  private currentScope(): 'local' | 'session' {
    return this.persistSessionSignal() ? 'local' : 'session';
  }
}
