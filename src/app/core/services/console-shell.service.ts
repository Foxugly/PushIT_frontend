import { Injectable, computed, inject, signal } from '@angular/core';
import { finalize, forkJoin, map, of, switchMap } from 'rxjs';

import { ApplicationCreateRequest, ApplicationRead, UserMe } from '../models/api.models';
import { LanguagePreferenceService } from './language-preference.service';
import { PushitApiService } from './pushit-api.service';
import { SessionService } from './session.service';

@Injectable({ providedIn: 'root' })
export class ConsoleShellService {
  private readonly api = inject(PushitApiService);
  private readonly session = inject(SessionService);
  private readonly languagePreference = inject(LanguagePreferenceService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly user = signal<UserMe | null>(null);
  readonly apps = signal<ApplicationRead[]>([]);
  readonly devicesCount = signal(0);
  readonly notificationsCount = signal(0);
  readonly quietPeriodsCount = signal(0);
  readonly selectedAppId = signal<number | null>(null);
  readonly lastGeneratedToken = signal<{ appId: number; token: string; prefix: string } | null>(null);

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
      .pipe(finalize(() => this.loading.set(false)))
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
        error: () => {
          this.error.set("Impossible de charger l'espace console.");
        },
      });
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
      .subscribe({
        next: ({ apps, devices }) => {
          this.apps.set(apps);
          this.syncSelectedApp(apps);
          this.devicesCount.set(devices.length);
          this.refreshSupplementaryCounts(apps, devices);
        },
        error: () => {
          this.error.set("Impossible de rafraichir les compteurs de navigation.");
        },
      });
  }

  private refreshSupplementaryCounts(
    apps: ApplicationRead[] = this.apps(),
    devices: Array<{ id: number }> = [],
  ): void {
    forkJoin({
      notifications: this.api.listNotifications({
        application_id: null,
        status: null,
        effective_scheduled_from: null,
        effective_scheduled_to: null,
        has_quiet_period_shift: null,
        ordering: '-effective_scheduled_for',
      }),
      futureNotifications: this.api.listFutureNotifications({
        effective_scheduled_from: null,
        effective_scheduled_to: null,
        has_quiet_period_shift: null,
        ordering: '-effective_scheduled_for',
      }),
    })
      .pipe(
        switchMap(({ notifications, futureNotifications }) => {
          this.notificationsCount.set(notifications.length + futureNotifications.length);

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

  createApp(payload: ApplicationCreateRequest, onDone?: () => void, onError?: () => void): void {
    this.api.createApp(payload).subscribe({
      next: (response) => {
        this.lastGeneratedToken.set({
          appId: response.id,
          token: response.app_token,
          prefix: response.app_token_prefix,
        });
        this.loadShell(response.id);
        onDone?.();
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
        this.lastGeneratedToken.set({
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

  logout(): void {
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
