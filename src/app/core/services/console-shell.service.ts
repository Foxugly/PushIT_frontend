import { Injectable, computed, inject, signal } from '@angular/core';
import { finalize, forkJoin, map, of, retry, switchMap } from 'rxjs';
import * as Sentry from '@sentry/angular';

import { ApplicationCreateRequest, ApplicationCreateResponse, ApplicationRead, UserMe } from '../models/api.models';
import { API_ERROR_COPY } from '../utils/api-error-copy';
import { LanguagePreferenceService } from './language-preference.service';
import { PublicI18nService } from './public-i18n.service';
import { PushitApiService } from './pushit-api.service';
import { SessionService } from './session.service';

@Injectable({ providedIn: 'root' })
export class ConsoleShellService {
  private readonly api = inject(PushitApiService);
  private readonly session = inject(SessionService);
  private readonly languagePreference = inject(LanguagePreferenceService);
  private readonly i18n = inject(PublicI18nService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly user = signal<UserMe | null>(null);
  readonly apps = signal<ApplicationRead[]>([]);
  readonly devicesCount = signal(0);
  readonly notificationsCount = signal(0);
  readonly quietPeriodsCount = signal(0);
  readonly selectedAppId = signal<number | null>(null);
  // One-time raw app token shown right after create/regenerate. It's a secret,
  // so it auto-clears after a short delay and is cleared on logout (don't leave
  // it lingering in the DOM/memory for the whole session).
  readonly lastGeneratedToken = signal<{ appId: number; token: string; prefix: string } | null>(null);
  private tokenClearTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly TOKEN_TTL_MS = 120_000;

  readonly selectedApp = computed(
    () => this.apps().find((app) => app.id === this.selectedAppId()) ?? null,
  );

  loadShell(preferredAppId?: number): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      user: this.api.me(),
      apps: this.api.listApps(),
      devices: this.api.listDevices(),
    })
      // Transient network/5xx hiccups shouldn't blank the whole console: retry a
      // couple of times before surfacing the error.
      .pipe(
        retry({ count: 2, delay: 800 }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: ({ user, apps, devices }) => {
          this.session.updateUser(user);
          this.user.set(user);
          this.languagePreference.applyBackendLanguage(user.language);
          this.apps.set(apps);
          this.devicesCount.set(devices.length);
          this.syncSelectedApp(apps, preferredAppId);
          this.refreshSupplementaryCounts(apps, devices);
        },
        error: (error) => {
          this.error.set(API_ERROR_COPY[this.i18n.language()].shellLoadFailed);
          Sentry.captureException(error);
        },
      });
  }

  /** Re-run the shell load — wired to the retry button on the error banner. */
  reload(): void {
    this.loadShell(this.selectedAppId() ?? undefined);
  }

  ensureLoaded(): void {
    if (!this.user()) {
      const sessionUser = this.session.user();
      if (sessionUser) {
        this.user.set(sessionUser);
      }
    }

    if (this.user() && this.apps().length > 0 && !this.loading()) {
      return;
    }

    this.loadShell();
  }

  selectApp(appId: number | null): void {
    this.selectedAppId.set(appId);
  }

  setDevicesCount(count: number): void {
    this.devicesCount.set(count);
  }

  setNotificationsCount(count: number): void {
    this.notificationsCount.set(count);
  }

  refreshNavigationCounts(): void {
    forkJoin({
      apps: this.api.listApps(),
      devices: this.api.listDevices(),
    })
      .pipe(retry({ count: 2, delay: 800 }))
      .subscribe({
        next: ({ apps, devices }) => {
          this.apps.set(apps);
          this.syncSelectedApp(apps);
          this.devicesCount.set(devices.length);
          this.refreshSupplementaryCounts(apps, devices);
        },
        error: (error) => {
          this.error.set(API_ERROR_COPY[this.i18n.language()].shellRefreshFailed);
          Sentry.captureException(error);
        },
      });
  }

  private refreshSupplementaryCounts(
    apps: ApplicationRead[] = this.apps(),
    devices: Array<{ id: number }> = [],
  ): void {
    // Counts only — fetch the paginated `count` (page_size=1) instead of loading
    // every notification into memory just to read .length.
    forkJoin({
      notifications: this.api.countNotifications({
        application_id: null,
        status: null,
        effective_scheduled_from: null,
        effective_scheduled_to: null,
        has_quiet_period_shift: null,
        ordering: '-effective_scheduled_for',
      }),
      futureNotifications: this.api.countFutureNotifications({
        application_id: null,
        status: null,
        effective_scheduled_from: null,
        effective_scheduled_to: null,
        has_quiet_period_shift: null,
        ordering: '-effective_scheduled_for',
      }),
    })
      .pipe(
        switchMap(({ notifications, futureNotifications }) => {
          this.notificationsCount.set(notifications + futureNotifications);

          return this.loadQuietPeriodsCount(apps, devices);
        }),
      )
      .subscribe({
        next: (quietPeriodsCount) => {
          this.quietPeriodsCount.set(quietPeriodsCount);
        },
        error: () => {
          this.quietPeriodsCount.set(0);
        },
      });
  }

  createApp(
    payload: ApplicationCreateRequest,
    onDone?: (app: ApplicationCreateResponse) => void,
    onError?: () => void,
  ): void {
    this.api.createApp(payload).subscribe({
      next: (response) => {
        this.rememberGeneratedToken({
          appId: response.id,
          token: response.app_token,
          prefix: response.app_token_prefix,
        });
        this.loadShell(response.id);
        onDone?.(response);
      },
      error: () => {
        onError?.();
      },
    });
  }

  toggleAppState(app: ApplicationRead, onDone?: () => void, onError?: () => void): void {
    const request$ = app.is_active ? this.api.deactivateApp(app.id) : this.api.activateApp(app.id);
    request$.subscribe({
      next: () => {
        this.loadShell(app.id);
        onDone?.();
      },
      error: () => {
        onError?.();
      },
    });
  }

  regenerateToken(app: ApplicationRead, onDone?: () => void, onError?: () => void): void {
    this.api.regenerateAppToken(app.id).subscribe({
      next: (response) => {
        this.rememberGeneratedToken({
          appId: response.app_id,
          token: response.new_app_token,
          prefix: response.app_token_prefix,
        });
        this.loadShell(app.id);
        onDone?.();
      },
      error: () => {
        onError?.();
      },
    });
  }

  revokeToken(app: ApplicationRead, onDone?: () => void, onError?: () => void): void {
    this.api.revokeAppToken(app.id).subscribe({
      next: () => {
        this.loadShell(app.id);
        onDone?.();
      },
      error: () => {
        onError?.();
      },
    });
  }

  /** Store the one-time token and schedule it to auto-clear after a short TTL. */
  private rememberGeneratedToken(value: { appId: number; token: string; prefix: string }): void {
    this.lastGeneratedToken.set(value);
    if (this.tokenClearTimer) {
      clearTimeout(this.tokenClearTimer);
    }
    this.tokenClearTimer = setTimeout(
      () => this.lastGeneratedToken.set(null),
      ConsoleShellService.TOKEN_TTL_MS,
    );
  }

  /** Discard the one-time token (after copy, on logout, or on demand). */
  clearGeneratedToken(): void {
    if (this.tokenClearTimer) {
      clearTimeout(this.tokenClearTimer);
      this.tokenClearTimer = null;
    }
    this.lastGeneratedToken.set(null);
  }

  logout(): void {
    this.clearGeneratedToken();
    const refreshToken = this.session.refreshToken();
    if (!refreshToken) {
      this.session.clear(true);
      return;
    }

    this.api.logout(refreshToken).subscribe({
      next: () => this.session.clear(true),
      error: () => this.session.clear(true),
    });
  }

  private syncSelectedApp(apps: ApplicationRead[], preferredAppId?: number): void {
    const currentAppId = this.selectedAppId();
    const nextAppId =
      preferredAppId ??
      (apps.some((app) => app.id === currentAppId) ? currentAppId : apps[0]?.id ?? null);

    this.selectedAppId.set(nextAppId ?? null);
  }

  private loadQuietPeriodsCount(apps: ApplicationRead[], devices: Array<{ id: number }>) {
    const requests = [
      ...apps.map((app) => this.api.listAppQuietPeriods(app.id)),
      ...devices.map((device) => this.api.listDeviceQuietPeriods(device.id)),
    ];

    if (!requests.length) {
      return of(0);
    }

    return forkJoin(requests).pipe(
      map((collections) => collections.reduce((total, collection) => total + collection.length, 0)),
    );
  }
}
