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

  // Monotonic load token: each loadShell() tags its in-flight request; a late
  // response whose token is no longer current is ignored so overlapping loads
  // (e.g. a fast mutation triggering reload while a prior load is still in
  // flight) can't clobber the signals with stale data.
  private loadToken = 0;

  readonly selectedApp = computed(
    () => this.apps().find((app) => app.id === this.selectedAppId()) ?? null,
  );

  loadShell(preferredAppId?: number): void {
    const token = ++this.loadToken;
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      user: this.api.me(),
      apps: this.api.listApps(),
      // Cheap count (page_size=1) for the nav badge — decoupled from the full
      // device list, which is now only fetched by the quiet-period fan-out.
      devicesCount: this.api.countDevices(),
    })
      // Transient network/5xx hiccups shouldn't blank the whole console: retry a
      // couple of times before surfacing the error.
      .pipe(
        retry({ count: 2, delay: 800 }),
        finalize(() => {
          // Only the latest load owns the loading flag.
          if (token === this.loadToken) {
            this.loading.set(false);
          }
        }),
      )
      .subscribe({
        next: ({ user, apps, devicesCount }) => {
          // A newer load started while this one was in flight → drop the result.
          if (token !== this.loadToken) {
            return;
          }
          this.session.updateUser(user);
          this.user.set(user);
          this.languagePreference.applyBackendLanguage(user.language);
          this.apps.set(apps);
          this.devicesCount.set(devicesCount);
          this.syncSelectedApp(apps, preferredAppId);
          this.refreshSupplementaryCounts(apps, token);
        },
        error: (error) => {
          if (token !== this.loadToken) {
            return;
          }
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
      // Cheap count for the badge; the full device list is fetched separately by
      // the quiet-period fan-out below.
      devicesCount: this.api.countDevices(),
    })
      .pipe(retry({ count: 2, delay: 800 }))
      .subscribe({
        next: ({ apps, devicesCount }) => {
          this.apps.set(apps);
          this.syncSelectedApp(apps);
          this.devicesCount.set(devicesCount);
          this.refreshSupplementaryCounts(apps);
        },
        error: (error) => {
          this.error.set(API_ERROR_COPY[this.i18n.language()].shellRefreshFailed);
          Sentry.captureException(error);
        },
      });
  }

  // Cache key for the last computed quiet-period count: the sorted set of app +
  // device ids it was derived from. Quiet periods only change when an app/device
  // is added/removed (or a quiet period is directly edited — see invalidate
  // below), NOT on token/active-state mutations, so when the key is unchanged we
  // reuse the cached count instead of re-running the N+M fan-out.
  private quietPeriodsKey: string | null = null;

  private refreshSupplementaryCounts(
    apps: ApplicationRead[] = this.apps(),
    token: number = this.loadToken,
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
          if (token === this.loadToken) {
            this.notificationsCount.set(notifications + futureNotifications);
          }

          return this.quietPeriodsCount$(apps);
        }),
      )
      .subscribe({
        next: (quietPeriodsCount) => {
          if (token === this.loadToken) {
            this.quietPeriodsCount.set(quietPeriodsCount);
          }
        },
        error: () => {
          if (token === this.loadToken) {
            this.quietPeriodsCount.set(0);
          }
        },
      });
  }

  /**
   * Resolve the quiet-period count, reusing the cached value when the app/device
   * id set is unchanged. This decouples the expensive N+M fan-out from app/device
   * mutations (activate, regenerate token, revoke…) that don't touch quiet
   * periods: those keep the same id set, so the cached count is returned without
   * any request.
   *
   * Residual cost: when the id set DOES change (app/device added or removed) the
   * count is still computed with one request per app + one per device — there is
   * no aggregate backend endpoint for it. That fan-out now only runs on those
   * structural changes (and the explicit invalidations below), not on every
   * mutation.
   */
  private quietPeriodsCount$(apps: ApplicationRead[]) {
    // The quiet-period count is inherently per-device (one request per app + one
    // per device — there is no aggregate endpoint), so it needs the device id
    // set. Fetch it here, on the quiet-period pipeline, rather than on the shell
    // load: the nav's device badge comes from the cheap countDevices() and no
    // longer waits on this fan-out.
    return this.api.listDevices().pipe(
      switchMap((devices) => {
        const key = this.computeQuietPeriodsKey(apps, devices);
        if (key === this.quietPeriodsKey) {
          return of(this.quietPeriodsCount());
        }

        return this.loadQuietPeriodsCount(apps, devices).pipe(
          map((count) => {
            this.quietPeriodsKey = key;
            return count;
          }),
        );
      }),
    );
  }

  private computeQuietPeriodsKey(
    apps: ApplicationRead[],
    devices: Array<{ id: number }>,
  ): string {
    const appIds = apps.map((app) => app.id).sort((a, b) => a - b);
    const deviceIds = devices.map((device) => device.id).sort((a, b) => a - b);
    return `a:${appIds.join(',')}|d:${deviceIds.join(',')}`;
  }

  /**
   * Force the next supplementary-counts refresh to recompute the quiet-period
   * count even if the app/device id set is unchanged. Call this after a direct
   * quiet-period mutation (create/update/delete), where the id set stays the
   * same but the underlying counts changed.
   */
  invalidateQuietPeriodsCount(): void {
    this.quietPeriodsKey = null;
  }

  createApp(
    payload: ApplicationCreateRequest,
    onDone?: (app: ApplicationCreateResponse) => void,
    // L'erreur est transmise : la creation peut echouer pour une raison que
    // l'appelant doit distinguer -- un 402 de facturation ne se traite pas
    // comme un echec de validation.
    onError?: (error: unknown) => void,
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
      error: (err) => {
        onError?.(err);
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
