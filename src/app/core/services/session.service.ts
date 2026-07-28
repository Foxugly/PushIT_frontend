import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize, map, Observable, shareReplay, throwError } from 'rxjs';

import { SKIP_AUTH } from '../http/http-context.tokens';
import { LoginResponse, TokenRefreshResponse, UserMe } from '../models/api.models';
import { SettingsService } from './settings.service';
import { StorageService } from './storage.service';

export const ACCESS_TOKEN_KEY = 'pushit.accessToken';
export const REFRESH_TOKEN_KEY = 'pushit.refreshToken';
export const USER_KEY = 'pushit.user';

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
    this.storage.remove(ACCESS_TOKEN_KEY, 'both');
    this.storage.remove(REFRESH_TOKEN_KEY, 'both');
    this.storage.remove(USER_KEY, 'both');

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

    this.storage.remove(ACCESS_TOKEN_KEY, 'both');
    this.storage.remove(REFRESH_TOKEN_KEY, 'both');
    this.storage.remove(USER_KEY, 'both');

    if (redirectToAuth) {
      void this.router.navigate(['/auth']);
    }
  }

  refreshAccessToken(): Observable<string> {
    const refreshToken = this.refreshTokenSignal();
    if (!refreshToken) {
      return throwError(() => new Error('Missing refresh token'));
    }

    if (this.refreshRequest$) {
      return this.refreshRequest$;
    }

    this.refreshRequest$ = this.http
      .post<TokenRefreshResponse>(
        `${this.settings.apiBaseUrl()}/auth/refresh/`,
        { refresh: refreshToken },
        { context: new HttpContext().set(SKIP_AUTH, true) },
      )
      .pipe(
        map((response) => {
          this.updateAccessToken(response.access);
          // The backend rotates + blacklists the refresh token on every refresh;
          // persist the rotated one so the *next* refresh doesn't present a now
          // blacklisted token (which would 401 and silently log the user out).
          if (response.refresh) {
            this.updateRefreshToken(response.refresh);
          }
          return response.access;
        }),
        shareReplay({ bufferSize: 1, refCount: true }),
        finalize(() => {
          this.refreshRequest$ = null;
        }),
      );

    return this.refreshRequest$;
  }

  private currentScope(): 'local' | 'session' {
    return this.persistSessionSignal() ? 'local' : 'session';
  }
}
