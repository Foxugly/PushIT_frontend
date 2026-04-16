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

  accessToken(): string | null {
    return this.accessTokenSignal();
  }

  refreshToken(): string | null {
    return this.refreshTokenSignal();
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
        map((response) => response.access),
        map((accessToken) => {
          this.updateAccessToken(accessToken);
          return accessToken;
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
