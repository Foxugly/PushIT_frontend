import { CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { finalize, forkJoin } from 'rxjs';

import {
  ApiErrorResponse,
  AliasStatus,
  ApplicationQuietPeriod,
  ApplicationRead,
  DeviceRead,
  NotificationRead,
  NotificationStatus,
  PushTokenStatus,
} from '../../../../core/models/api.models';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { formatDateTimeFrBe, formatTimeLabel, weekdayShortLabel } from '../../../../core/utils/date-format.utils';
import { coerceApiError } from '../../../../core/utils/api-error.utils';
import { interpolate } from '../../../../core/utils/string.utils';
import { AppAlert } from '../../../../shared/app-alert/app-alert';
import { ApiErrorMessagePipe } from '../../../../core/pipes/api-error-message.pipe';
import { AppAlertTone } from '../../../../shared/app-alert/app-alert';
import { AppConfirmService } from '../../../../shared/app-confirm-dialog/app-confirm.service';
import { ConsoleDetailHeader } from '../../components/console-detail-header/console-detail-header';
import { ConsoleFactItem } from '../../components/console-facts-table/console-fact-item';
import { ConsoleFactsTable } from '../../components/console-facts-table/console-facts-table';
import { AppTokenReveal } from '../../components/app-token-reveal/app-token-reveal';

@Component({
  selector: 'app-application-detail-page',
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
    AppAlert, ApiErrorMessagePipe,
    ConsoleDetailHeader,
    ConsoleFactsTable,
    AppTokenReveal,
    ButtonModule,
    TagModule,
    TableModule,
    TooltipModule,
  ],
  templateUrl: './application-detail-page.html',
  styleUrl: './application-detail-page.scss',
})
export class ApplicationDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(PushitApiService);
  private readonly consoleCopy = inject(ConsoleCopyService);
  private readonly confirm = inject(AppConfirmService);
  private readonly destroyRef = inject(DestroyRef);
  readonly shell = inject(ConsoleShellService);
  readonly copy = computed(() => this.consoleCopy.current().applicationDetail);
  // The one-time token reveal (QR + token) reuses the `applications` copy block
  // (qr.* labels + alerts.created guidance) so the surface matches the list.
  readonly applicationsCopy = computed(() => this.consoleCopy.current().applications);

  readonly application = signal<ApplicationRead | null>(null);
  readonly devices = signal<DeviceRead[]>([]);
  readonly notifications = signal<NotificationRead[]>([]);
  readonly futureNotifications = signal<NotificationRead[]>([]);
  readonly quietPeriods = signal<ApplicationQuietPeriod[]>([]);
  readonly loading = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  // Related data (devices / notifications / quiet periods) loads independently
  // of the application itself, so one failing section no longer blanks the page.
  readonly relatedError = signal<ApiErrorResponse | null>(null);
  readonly relatedLoading = signal(false);
  private appId = 0;
  readonly banner = signal<string | null>(null);
  readonly bannerTone = signal<AppAlertTone>('success');
  readonly editError = signal<ApiErrorResponse | null>(null);
  readonly emailRegenerating = signal(false);
  readonly aliasChecking = signal(false);
  readonly aliasStatus = signal<AliasStatus | null>(null);

  // Maps an alias-status payload to a tag tone + message. provisioned is the
  // authoritative signal; null means the check could not run (Exchange off or
  // an upstream error), in which case `configured` disambiguates the reason.
  readonly aliasStatusView = computed<{
    severity: 'success' | 'danger' | 'warn' | 'secondary';
    label: string;
    hint: string | null;
  } | null>(() => {
    const status = this.aliasStatus();
    if (!status) {
      return null;
    }
    const copy = this.copy().aliasStatus;
    if (status.provisioned === true) {
      return { severity: 'success', label: copy.active, hint: null };
    }
    if (status.provisioned === false) {
      return { severity: 'danger', label: copy.missing, hint: copy.missingHint };
    }
    // provisioned === null: distinguish "Exchange not configured" from an actual
    // verification failure.
    if (!status.configured) {
      return { severity: 'secondary', label: copy.unavailable, hint: null };
    }
    return { severity: 'warn', label: copy.unverifiable, hint: status.detail || null };
  });

  // One-time raw token for THIS app, iff it was just (re)generated this session
  // (the shell holds it for a short TTL). This is what makes the freshly-minted
  // token reachable after create→detail navigation: the regression was that the
  // detail page had no reveal surface, so the token was lost.
  readonly revealToken = computed(() => {
    const app = this.application();
    const last = this.shell.lastGeneratedToken();
    return app && last && last.appId === app.id ? last.token : null;
  });

  readonly applicationFactsComputed = computed(() => {
    const app = this.application();
    if (!app) {
      return [];
    }

    return [
      { label: this.copy().facts.id, value: String(app.id) },
      { label: this.copy().facts.name, value: app.name },
      { label: this.copy().facts.tokenPrefix, value: app.app_token_prefix, severity: 'info' as const },
      {
        label: this.copy().facts.status,
        value: app.is_active ? this.copy().statusLabels.active : this.copy().statusLabels.inactive,
        severity: this.appSeverity(app),
      },
      {
        label: this.copy().facts.lastUsed,
        value: app.last_used_at ? this.formatDateTime(app.last_used_at) : this.copy().statusLabels.never,
      },
      {
        label: this.copy().facts.revokedToken,
        value: app.revoked_at ? this.formatDateTime(app.revoked_at) : this.copy().statusLabels.no,
        severity: app.revoked_at ? 'warn' as const : 'success' as const,
      },
      { label: this.copy().facts.createdAt, value: this.formatDateTime(app.created_at) },
    ] as ConsoleFactItem[];
  });

  ngOnInit(): void {
    const appId = Number(this.route.snapshot.paramMap.get('appId'));
    if (!Number.isFinite(appId) || appId <= 0) {
      this.error.set({
        code: 'invalid_application_id',
        detail: this.copy().errors.invalidId,
      });
      return;
    }

    this.appId = appId;
    const cachedApplication = this.shell.apps().find((app) => app.id === appId) ?? null;
    this.application.set(cachedApplication);
    this.loadApplication(appId);
    this.loadRelated(appId);
  }

  retryRelated(): void {
    this.loadRelated(this.appId);
  }

  appSeverity(app: ApplicationRead): 'success' | 'secondary' {
    return app.is_active ? 'success' : 'secondary';
  }

  deviceSeverity(status: PushTokenStatus): 'success' | 'warn' | 'danger' {
    switch (status) {
      case 'active':
        return 'success';
      case 'invalid':
        return 'warn';
      default:
        return 'danger';
    }
  }

  notificationSeverity(status: NotificationStatus): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
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

  quietPeriodTypeSeverity(type: ApplicationQuietPeriod['period_type']): 'info' | 'warn' {
    return type === 'ONCE' ? 'info' : 'warn';
  }

  quietPeriodScheduleLabel(quietPeriod: ApplicationQuietPeriod): string {
    if (quietPeriod.period_type === 'ONCE') {
      return `${this.formatDateTime(quietPeriod.start_at)} -> ${this.formatDateTime(quietPeriod.end_at)}`;
    }

    const days = quietPeriod.recurrence_days.map((day) => weekdayShortLabel(day)).join(', ');

    return `${days} | ${this.formatTime(quietPeriod.start_time)} -> ${this.formatTime(quietPeriod.end_time)}`;
  }

  applicationFacts(): ConsoleFactItem[] {
    return this.applicationFactsComputed();
  }

  async copyInboundEmail(address: string): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(address);
      } else {
        this.copyWithFallback(address);
      }

      this.bannerTone.set('success');
      this.banner.set(this.copy().inboundEmailCopied);
    } catch {
      this.bannerTone.set('danger');
      this.banner.set(this.copy().inboundEmailCopyFailed);
    }
  }

  verifyAlias(): void {
    const app = this.application();
    if (!app) {
      return;
    }

    this.aliasChecking.set(true);
    this.api
      .getAliasStatus(app.id)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.aliasChecking.set(false)))
      .subscribe({
        next: (status) => this.aliasStatus.set(status),
        error: () => {
          this.bannerTone.set('danger');
          this.banner.set(this.copy().aliasStatus.error);
        },
      });
  }

  isFutureNotification(notification: NotificationRead): boolean {
    return this.futureNotifications().some((item) => item.id === notification.id);
  }

  openEdit(): void {
    const app = this.application();
    if (!app) {
      return;
    }
    void this.router.navigate(['/dashboard/applications', app.id, 'edit']);
  }

  async regenerateInboundEmail(): Promise<void> {
    const app = this.application();
    if (!app) {
      return;
    }

    const confirmed = await this.confirm.ask({
      message: interpolate(this.copy().regenerateEmail.confirm, { name: app.name }),
    });
    if (!confirmed) {
      return;
    }

    this.emailRegenerating.set(true);
    this.editError.set(null);
    this.api
      .regenerateAppEmail(app.id)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.emailRegenerating.set(false)))
      .subscribe({
        next: (result) => {
          this.application.set({
            ...app,
            inbound_email_alias: result.inbound_email_alias,
            inbound_email_address: result.inbound_email_address,
          });
          this.bannerTone.set('success');
          this.banner.set(this.copy().regenerateEmail.success);
          this.shell.loadShell(app.id);
        },
        error: () => {
          this.bannerTone.set('danger');
          this.banner.set(this.copy().regenerateEmail.error);
        },
      });
  }

  /** Primary load: the application itself (drives the header/title). */
  private loadApplication(appId: number): void {
    this.loading.set(true);
    this.error.set(null);

    this.api
      .getApp(appId)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false)))
      .subscribe({
        next: (application) => this.application.set(application),
        error: (error) => this.error.set(coerceApiError(error)),
      });
  }

  /** Secondary load: the related panels. Failures surface a dismissible banner
   * with a retry, without blanking the page or the application header. */
  private loadRelated(appId: number): void {
    this.relatedLoading.set(true);
    this.relatedError.set(null);

    forkJoin({
      devices: this.api.listDevices(),
      notifications: this.api.listNotifications({
        application_id: appId,
        ordering: '-effective_scheduled_for',
      }),
      futureNotifications: this.api.listFutureNotifications({
        application_id: appId,
        ordering: '-effective_scheduled_for',
      }),
      quietPeriods: this.api.listAppQuietPeriods(appId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.relatedLoading.set(false)))
      .subscribe({
        next: ({ devices, notifications, futureNotifications, quietPeriods }) => {
          this.devices.set(devices.filter((device) => device.application_ids.includes(appId)));
          this.notifications.set(notifications);
          this.futureNotifications.set(futureNotifications);
          this.quietPeriods.set(quietPeriods);
        },
        error: (error) => {
          this.relatedError.set(coerceApiError(error));
        },
      });
  }

  private formatDateTime(value: string | null): string {
    return formatDateTimeFrBe(value);
  }

  private formatTime(value: string | null): string {
    return formatTimeLabel(value);
  }

  private copyWithFallback(value: string): void {
    if (typeof document === 'undefined') {
      throw new Error('Clipboard unavailable');
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (!copied) {
      throw new Error('Copy failed');
    }
  }
}
