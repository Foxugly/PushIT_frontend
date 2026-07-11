import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { finalize } from 'rxjs';

import { ApiErrorResponse, ApplicationRead } from '../../../../core/models/api.models';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { coerceApiError } from '../../../../core/utils/api-error.utils';
import { interpolate } from '../../../../core/utils/string.utils';
import { AppAlert } from '../../../../shared/app-alert/app-alert';
import { ApiErrorMessagePipe } from '../../../../core/pipes/api-error-message.pipe';
import { AppConfirmService } from '../../../../shared/app-confirm-dialog/app-confirm.service';
import { EmptyState } from '../../../../shared/empty-state/empty-state';
import { AppTokenReveal } from '../../components/app-token-reveal/app-token-reveal';

@Component({
  selector: 'app-applications-page',
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
    AppAlert,
    ApiErrorMessagePipe,
    AppTokenReveal,
    ButtonModule,
    DialogModule,
    SkeletonModule,
    TableModule,
    TagModule,
    TooltipModule,
    EmptyState,
  ],
  templateUrl: './applications-page.html',
  styleUrl: './applications-page.scss',
})
export class ApplicationsPage {
  private readonly api = inject(PushitApiService);
  private readonly consoleCopy = inject(ConsoleCopyService);
  private readonly confirm = inject(AppConfirmService);
  private readonly router = inject(Router);
  readonly shell = inject(ConsoleShellService);
  readonly copy = computed(() => this.consoleCopy.current().applications);

  readonly pending = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly banner = signal<string | null>(null);
  readonly activeAppsCount = computed(() => this.shell.apps().filter((app) => app.is_active).length);

  // QR dialog: shows the app token as a scannable QR (for the mobile app to
  // link a device) via the shared <app-token-reveal>. The raw token is only
  // available right after create/regenerate (it's stored hashed), so the dialog
  // falls back to a regenerate affordance when we don't hold it.
  readonly qrApp = signal<ApplicationRead | null>(null);
  readonly qrError = signal<string | null>(null);
  /** Raw token for the dialog's app, iff it was just (re)generated this session. */
  readonly qrToken = computed(() => {
    const app = this.qrApp();
    const last = this.shell.lastGeneratedToken();
    return app && last && last.appId === app.id ? last.token : null;
  });

  openCreate(): void {
    void this.router.navigate(['/dashboard/applications/new']);
  }

  openEdit(app: ApplicationRead): void {
    void this.router.navigate(['/dashboard/applications', app.id, 'edit']);
  }

  toggleState(app: ApplicationRead): void {
    this.pending.set(true);
    this.error.set(null);
    this.banner.set(null);

    this.shell.toggleAppState(
      app,
      () => {
        this.pending.set(false);
        this.banner.set(!app.is_active ? this.copy().alerts.deactivated : this.copy().alerts.activated);
      },
      () => {
        this.pending.set(false);
        this.error.set({
          code: 'application_toggle_failed',
          detail: this.copy().errors.toggle,
        });
      },
    );
  }

  async regenerateToken(app: ApplicationRead): Promise<void> {
    const confirmed = await this.confirm.ask({
      message: this.interpolate(this.copy().confirmRegenerate, { name: app.name }),
    });
    if (!confirmed) {
      return;
    }

    this.pending.set(true);
    this.error.set(null);
    this.banner.set(null);

    this.shell.regenerateToken(
      app,
      () => {
        this.pending.set(false);
        this.banner.set(this.copy().alerts.regenerated);
      },
      () => {
        this.pending.set(false);
        this.error.set({
          code: 'application_token_failed',
          detail: this.copy().errors.regenerate,
        });
      },
    );
  }

  openQr(app: ApplicationRead): void {
    this.qrApp.set(app);
    this.qrError.set(null);
  }

  setQrVisible(visible: boolean): void {
    if (!visible) {
      this.closeQr();
    }
  }

  closeQr(): void {
    this.qrApp.set(null);
    this.qrError.set(null);
  }

  /** Regenerate the token (rotating it) so we hold the raw value. The shared
   * <app-token-reveal> then renders its QR reactively once `qrToken()` is set. */
  regenerateForQr(app: ApplicationRead): void {
    this.qrError.set(null);
    this.shell.regenerateToken(
      app,
      () => {
        if (!this.qrToken()) {
          this.qrError.set(this.copy().qr.error);
        }
      },
      () => {
        this.qrError.set(this.copy().errors.regenerate);
      },
    );
  }

  async revokeToken(app: ApplicationRead): Promise<void> {
    const confirmed = await this.confirm.ask({
      message: this.interpolate(this.copy().confirmRevoke, { name: app.name }),
    });
    if (!confirmed) {
      return;
    }

    this.pending.set(true);
    this.error.set(null);
    this.banner.set(null);

    this.shell.revokeToken(
      app,
      () => {
        this.pending.set(false);
        this.banner.set(this.copy().alerts.revoked);
      },
      () => {
        this.pending.set(false);
        this.error.set({
          code: 'application_revoke_failed',
          detail: this.copy().errors.revoke,
        });
      },
    );
  }

  async deleteApp(app: ApplicationRead): Promise<void> {
    const shouldDelete = await this.confirm.ask({
      message: this.interpolate(this.copy().confirmDelete, { name: app.name }),
    });
    if (!shouldDelete) {
      return;
    }

    this.pending.set(true);
    this.error.set(null);
    this.banner.set(null);

    this.api
      .deleteApp(app.id)
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: () => {
          this.banner.set(this.interpolate(this.copy().alerts.deleted, { name: app.name }));
          this.shell.loadShell();
        },
        error: (error) => {
          this.error.set(coerceApiError(error));
        },
      });
  }

  trackById(_: number, app: ApplicationRead): number {
    return app.id;
  }

  appSeverity(app: ApplicationRead): 'success' | 'secondary' {
    return app.is_active ? 'success' : 'secondary';
  }

  appStatusLabel(app: ApplicationRead): string {
    return app.is_active ? this.copy().statuses.active : this.copy().statuses.inactive;
  }

  refreshApplications(): void {
    this.error.set(null);
    this.banner.set(null);
    this.shell.loadShell(this.shell.selectedAppId() ?? undefined);
  }

  openDetails(app: ApplicationRead): void {
    void this.router.navigate(['/dashboard/applications', app.id]);
  }

  private interpolate = interpolate;
}
