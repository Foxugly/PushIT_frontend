import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

import { NotificationRead, NotificationStatus } from '../../../../core/models/api.models';
import { AppCopyService } from '../../../../core/services/app-copy.service';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { interpolate } from '../../../../core/utils/string.utils';
import { EmptyState } from '../../../../shared/empty-state/empty-state';

/** How many notifications the « Dernières notifications » / « Échecs récents » blocks show. */
export const DASHBOARD_FEED_SIZE = 5;

export type GettingStartedStepKey = 'app' | 'device' | 'notification';

export interface GettingStartedStep {
  key: GettingStartedStepKey;
  done: boolean;
  link: unknown[];
  queryParams: Record<string, string> | null;
}

export interface DashboardMetric {
  key: 'apps' | 'activeApps' | 'devices' | 'notifications' | 'quietPeriods';
  value: number;
  link: string;
}

@Component({
  selector: 'app-dashboard-home-page',
  imports: [DatePipe, RouterLink, ButtonModule, TagModule, EmptyState],
  templateUrl: './dashboard-home-page.html',
  styleUrl: './dashboard-home-page.scss',
})
export class DashboardHomePage implements OnInit {
  private readonly appCopy = inject(AppCopyService);
  private readonly consoleCopy = inject(ConsoleCopyService);
  private readonly api = inject(PushitApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly shell = inject(ConsoleShellService);
  readonly copy = computed(() => this.appCopy.current().console.dashboard);
  readonly statusLabels = computed(() => this.consoleCopy.current().notifications.statusLabels);
  readonly activeAppsCount = computed(() => this.shell.apps().filter((app) => app.is_active).length);

  readonly recent = signal<NotificationRead[]>([]);
  readonly recentTotal = signal(0);
  readonly failures = signal<NotificationRead[]>([]);
  readonly failuresTotal = signal(0);
  readonly feedLoading = signal(true);
  readonly feedError = signal(false);

  private readonly firstAppId = computed(() => this.shell.apps()[0]?.id ?? null);

  readonly metrics = computed<DashboardMetric[]>(() => [
    { key: 'apps', value: this.shell.apps().length, link: '/dashboard/applications' },
    { key: 'activeApps', value: this.activeAppsCount(), link: '/dashboard/applications' },
    { key: 'devices', value: this.shell.devicesCount(), link: '/dashboard/devices' },
    { key: 'notifications', value: this.shell.notificationsCount(), link: '/dashboard/notifications' },
    { key: 'quietPeriods', value: this.shell.quietPeriodsCount(), link: '/dashboard/quiet-periods' },
  ]);

  /**
   * « Pour commencer » : each step is ticked from real data (the shell's apps and
   * device count, and whether any notification exists), never from a stored flag.
   */
  readonly steps = computed((): GettingStartedStep[] => {
    const appId = this.firstAppId();
    return [
      {
        key: 'app',
        done: this.shell.apps().length > 0,
        link: ['/dashboard/applications/new'],
        queryParams: null,
      },
      {
        key: 'device',
        done: this.shell.devicesCount() > 0,
        // Devices are enrolled from the application's QR code (Destinataires tab).
        link: appId ? ['/dashboard/applications', appId] : ['/dashboard/applications/new'],
        queryParams: appId ? { tab: 'recipients' } : null,
      },
      {
        key: 'notification',
        done: this.recentTotal() > 0 || this.shell.notificationsCount() > 0,
        link: ['/dashboard/notifications'],
        queryParams: appId ? { create: '1', app: String(appId) } : { create: '1' },
      },
    ];
  });

  readonly stepsDone = computed(() => this.steps().filter((step) => step.done).length);

  /** The first step not done yet: the only one whose call-to-action is primary. */
  readonly nextStepKey = computed(() => this.steps().find((step) => !step.done)?.key ?? null);

  /**
   * Shown only once the shell AND the feed have loaded (otherwise a returning
   * user would see the checklist flash with every step unticked), and hidden for
   * good once every step is done.
   */
  readonly showGettingStarted = computed(
    () =>
      this.shell.loaded() &&
      !this.feedLoading() &&
      !this.feedError() &&
      this.stepsDone() < this.steps().length,
  );

  /** The two feeds, once loaded — hidden while the account has no notification at all. */
  readonly showFeeds = computed(() => !this.feedLoading() && (this.feedError() || this.recentTotal() > 0));

  readonly progressLabel = computed(() =>
    interpolate(this.copy().gettingStarted.progress, {
      done: this.stepsDone(),
      total: this.steps().length,
    }),
  );

  ngOnInit(): void {
    this.loadFeed();
  }

  loadFeed(): void {
    this.feedLoading.set(true);
    this.feedError.set(false);
    // No `ordering`: the server's default is newest first (-id). Ordering on the
    // effective date would put every immediate send (null date) first, unordered.
    forkJoin({
      recent: this.api.listNotificationsPage({}, 1, DASHBOARD_FEED_SIZE),
      failures: this.api.listNotificationsPage({ status: 'failed' }, 1, DASHBOARD_FEED_SIZE),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ recent, failures }) => {
          this.recent.set(recent.results);
          this.recentTotal.set(recent.count);
          this.failures.set(failures.results);
          this.failuresTotal.set(failures.count);
          this.feedLoading.set(false);
        },
        error: () => {
          this.feedError.set(true);
          this.feedLoading.set(false);
        },
      });
  }

  statusLabel(status: NotificationStatus): string {
    return this.statusLabels()[status] ?? status;
  }

  statusSeverity(status: NotificationStatus): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'sent':
        return 'success';
      case 'queued':
      case 'processing':
        return 'info';
      case 'scheduled':
        return 'warn';
      case 'failed':
      case 'partial':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  isFailure(notification: NotificationRead): boolean {
    return notification.status === 'failed' || notification.status === 'partial';
  }

  /** The date that matters to the reader: when it went out, else when it will / was created. */
  notificationDate(notification: NotificationRead): string {
    return notification.sent_at ?? notification.effective_scheduled_for ?? notification.created_at;
  }
}
