import { CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
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
import { coerceApiError, errorFieldMessages } from '../../../../core/utils/api-error.utils';
import { interpolate } from '../../../../core/utils/string.utils';
import { AppAlert } from '../../../../shared/app-alert/app-alert';
import { ApiErrorMessagePipe } from '../../../../core/pipes/api-error-message.pipe';
import { AppAlertTone } from '../../../../shared/app-alert/app-alert';
import { AppConfirmService } from '../../../../shared/app-confirm-dialog/app-confirm.service';
import { PageHeader } from '../../../../shared/page-header/page-header';
import { ConsoleFactItem } from '../../components/console-facts-table/console-fact-item';
import { ConsoleFactsTable } from '../../components/console-facts-table/console-facts-table';
import { AppTokenReveal } from '../../components/app-token-reveal/app-token-reveal';
import { CodeExamples } from '../../components/code-examples/code-examples';
import { EnrolmentPanel } from '../../components/enrolment-panel/enrolment-panel';
import { SendTokensPanel } from '../../components/send-tokens-panel/send-tokens-panel';
import { SettingsService } from '../../../../core/services/settings.service';
import { ApplicationFormFields } from '../../components/application-form-fields/application-form-fields';
import { AvatarCropper } from '../../../../shared/avatar-cropper/avatar-cropper';

/**
 * The detail page's tabs, in display order. The active one lives in the `?tab=`
 * query param (absent = overview) so a tab can be linked to, survives a reload,
 * and the create flow / the old `/edit` route can land on a given tab.
 */
export const APP_DETAIL_TABS = [
  'overview',
  'recipients',
  'sending',
  'notifications',
  'quiet-periods',
  'settings',
] as const;
export type AppDetailTab = (typeof APP_DETAIL_TABS)[number];

/** Unknown / missing values fall back to the overview. */
export function normalizeAppDetailTab(value: unknown): AppDetailTab {
  return APP_DETAIL_TABS.includes(value as AppDetailTab) ? (value as AppDetailTab) : 'overview';
}

@Component({
  selector: 'app-application-detail-page',
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
    ReactiveFormsModule,
    AppAlert, ApiErrorMessagePipe,
    ApplicationFormFields,
    AvatarCropper,
    TabsModule,
    PageHeader,
    ConsoleFactsTable,
    AppTokenReveal,
    CodeExamples,
    EnrolmentPanel,
    SendTokensPanel,
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
  private readonly settings = inject(SettingsService);
  private readonly fb = inject(FormBuilder);
  readonly shell = inject(ConsoleShellService);
  readonly apiBaseUrl = computed(() => this.settings.apiBaseUrl());
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
  /** Id of the device being evicted, to keep the spinner on its own row. */
  readonly evicting = signal<number | null>(null);
  readonly aliasChecking = signal(false);
  readonly aliasStatus = signal<AliasStatus | null>(null);

  readonly tabs = APP_DETAIL_TABS;
  readonly activeTab = signal<AppDetailTab>('overview');
  /** Settings tab: name/description save, logo, activation, deletion. */
  readonly settingsForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: [''],
  });
  readonly saving = signal(false);
  readonly logoPending = signal(false);
  /** Activate/deactivate, legacy token regenerate/revoke and delete share one lock. */
  readonly actionPending = signal(false);

  readonly tabLabels = computed<Record<AppDetailTab, string>>(() => {
    const tabs = this.copy().tabs;
    return {
      overview: tabs.overview,
      recipients: tabs.recipients,
      sending: tabs.sending,
      notifications: tabs.notifications,
      'quiet-periods': tabs.quietPeriods,
      settings: tabs.settings,
    };
  });

  /** Most recent `sent_at` among the notifications already loaded, if any. */
  readonly lastSentAt = computed(() => {
    const sent = this.notifications()
      .map((notification) => notification.sent_at)
      .filter((value): value is string => !!value)
      .sort();
    return sent.length ? sent[sent.length - 1] : null;
  });

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

  /**
   * True while this application still SENDS with the legacy token. Switching
   * that token off (the plan's last step) would break whoever is behind this —
   * so the page says it out loud instead of letting the day arrive by surprise.
   */
  readonly stillSendsWithLegacyToken = computed(
    () => this.application()?.legacy_send_last_used_at != null,
  );

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
    // Set by the create form when the app was created but its logo upload failed.
    if (typeof history !== 'undefined' && history.state?.logoUploadFailed) {
      this.bannerTone.set('danger');
      this.banner.set(this.copy().errors.logo);
    }
    const cachedApplication = this.shell.apps().find((app) => app.id === appId) ?? null;
    this.setApplication(cachedApplication);
    this.loadApplication(appId);
    this.loadRelated(appId);

    // Follow `?tab=` (initial load, links, back/forward). Without a tab param, a
    // token just minted for this app (create / regenerate) opens the Envoi tab,
    // where the one-time reveal lives.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const raw = params.get('tab');
      if (raw === null && this.shell.lastGeneratedToken()?.appId === appId) {
        this.activeTab.set('sending');
        return;
      }
      this.activeTab.set(normalizeAppDetailTab(raw));
    });
  }

  /**
   * Switch tab and mirror it in the URL. replaceUrl: tabs are views of one page,
   * so Back leaves the page instead of stepping through every tab visited.
   */
  selectTab(value: unknown): void {
    const tab = normalizeAppDetailTab(value);
    if (tab === this.activeTab()) {
      return;
    }
    this.activeTab.set(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'overview' ? null : tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  retryRelated(): void {
    this.loadRelated(this.appId);
  }

  /** Keep the page's application in sync after the enrolment panel rotated. */
  onEnrolmentCodeRotated(code: string): void {
    this.application.update((app) =>
      app ? { ...app, enrolment_code: code, enrolment_code_rotated_at: new Date().toISOString() } : app,
    );
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

  /** Header pencil: editing now lives in the Paramètres tab. */
  openEdit(): void {
    this.selectTab('settings');
  }

  /** Opens the notifications page's create modal, pre-selected on this app. */
  newNotification(): void {
    const app = this.application();
    if (!app) {
      return;
    }
    void this.router.navigate(['/dashboard/notifications'], {
      queryParams: { app: app.id, create: 1 },
    });
  }

  saveSettings(): void {
    const app = this.application();
    if (!app) {
      return;
    }
    if (this.settingsForm.invalid) {
      this.settingsForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.editError.set(null);
    this.api
      .updateApp(app.id, this.settingsForm.getRawValue())
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => {
          this.settingsForm.markAsPristine();
          this.setApplication(updated);
          this.bannerTone.set('success');
          this.banner.set(this.copy().settings.saved);
          this.shell.loadShell(updated.id);
        },
        error: (err) => this.editError.set(coerceApiError(err)),
      });
  }

  settingsFieldErrors(fieldName: string): string[] {
    return errorFieldMessages(this.editError(), fieldName);
  }

  onLogoCropped(file: File): void {
    const app = this.application();
    if (!app || !file) {
      return;
    }

    this.logoPending.set(true);
    this.api
      .uploadAppLogo(app.id, file)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.logoPending.set(false)))
      .subscribe({
        next: (updated) => {
          this.application.update((current) => (current ? { ...current, logo: updated.logo } : current));
          this.bannerTone.set('success');
          this.banner.set(this.copy().logo.updated);
          this.shell.loadShell(app.id);
        },
        error: () => {
          this.bannerTone.set('danger');
          this.banner.set(this.copy().errors.logo);
        },
      });
  }

  removeLogo(): void {
    const app = this.application();
    if (!app) {
      return;
    }

    this.logoPending.set(true);
    this.api
      .deleteAppLogo(app.id)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.logoPending.set(false)))
      .subscribe({
        next: () => {
          this.application.update((current) => (current ? { ...current, logo: null } : current));
          this.bannerTone.set('success');
          this.banner.set(this.copy().logo.removed);
          this.shell.loadShell(app.id);
        },
        error: () => {
          this.bannerTone.set('danger');
          this.banner.set(this.copy().errors.logo);
        },
      });
  }

  toggleState(): void {
    const app = this.application();
    if (!app) {
      return;
    }

    this.actionPending.set(true);
    this.shell.toggleAppState(
      app,
      () => {
        this.actionPending.set(false);
        this.application.update((current) => (current ? { ...current, is_active: !app.is_active } : current));
        this.bannerTone.set('success');
        this.banner.set(
          app.is_active ? this.applicationsCopy().alerts.deactivated : this.applicationsCopy().alerts.activated,
        );
      },
      () => {
        this.actionPending.set(false);
        this.bannerTone.set('danger');
        this.banner.set(this.applicationsCopy().errors.toggle);
      },
    );
  }

  /** Legacy application token: mint a new one (revealed once in this tab). */
  async regenerateLegacyToken(): Promise<void> {
    const app = this.application();
    if (!app) {
      return;
    }
    const confirmed = await this.confirm.ask({
      message: interpolate(this.applicationsCopy().confirmRegenerate, { name: app.name }),
    });
    if (!confirmed) {
      return;
    }

    this.actionPending.set(true);
    this.shell.regenerateToken(
      app,
      () => {
        this.actionPending.set(false);
        this.bannerTone.set('success');
        this.banner.set(this.applicationsCopy().alerts.regenerated);
        this.loadApplication(app.id);
      },
      () => {
        this.actionPending.set(false);
        this.bannerTone.set('danger');
        this.banner.set(this.applicationsCopy().errors.regenerate);
      },
    );
  }

  async revokeLegacyToken(): Promise<void> {
    const app = this.application();
    if (!app) {
      return;
    }
    const confirmed = await this.confirm.ask({
      message: interpolate(this.applicationsCopy().confirmRevoke, { name: app.name }),
    });
    if (!confirmed) {
      return;
    }

    this.actionPending.set(true);
    this.shell.revokeToken(
      app,
      () => {
        this.actionPending.set(false);
        this.bannerTone.set('success');
        this.banner.set(this.applicationsCopy().alerts.revoked);
        this.loadApplication(app.id);
      },
      () => {
        this.actionPending.set(false);
        this.bannerTone.set('danger');
        this.banner.set(this.applicationsCopy().errors.revoke);
      },
    );
  }

  /** Danger zone: delete after confirmation, then back to the list. */
  async deleteApplication(): Promise<void> {
    const app = this.application();
    if (!app) {
      return;
    }
    const confirmed = await this.confirm.ask({
      message: interpolate(this.applicationsCopy().confirmDelete, { name: app.name }),
    });
    if (!confirmed) {
      return;
    }

    this.actionPending.set(true);
    this.editError.set(null);
    this.api
      .deleteApp(app.id)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.actionPending.set(false)))
      .subscribe({
        next: () => {
          this.shell.loadShell();
          void this.router.navigate(['/dashboard/applications']);
        },
        error: (err) => this.editError.set(coerceApiError(err)),
      });
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

  /**
   * Remove a subscriber from this application. The device itself survives — it
   * belongs to somebody else — and only the link to this application is cut.
   * The confirmation says the other half out loud: eviction alone does not keep
   * them out, since the enrolment code they scanned still works.
   */
  async evictDevice(device: DeviceRead): Promise<void> {
    const app = this.application();
    if (!app) {
      return;
    }

    const confirmed = await this.confirm.ask({
      message: interpolate(this.copy().evict.confirm, {
        device: device.device_name || String(device.id),
        name: app.name,
      }),
    });
    if (!confirmed) {
      return;
    }

    this.evicting.set(device.id);
    this.api
      .evictDeviceFromApp(app.id, device.id)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.evicting.set(null)))
      .subscribe({
        next: () => {
          this.devices.update((devices) => devices.filter((item) => item.id !== device.id));
          this.bannerTone.set('success');
          this.banner.set(this.copy().evict.success);
        },
        error: () => {
          this.bannerTone.set('danger');
          this.banner.set(this.copy().evict.error);
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
        next: (application) => this.setApplication(application),
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

  /** Set the application and re-seed the settings form, unless the user is mid-edit. */
  private setApplication(app: ApplicationRead | null): void {
    this.application.set(app);
    if (app && !this.settingsForm.dirty) {
      this.settingsForm.reset({ name: app.name, description: app.description });
    }
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
