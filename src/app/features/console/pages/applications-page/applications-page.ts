import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { ApiErrorResponse, ApplicationRead } from '../../../../core/models/api.models';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { StatusLabelService } from '../../../../core/i18n/status-labels';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { AppAlert } from '../../../../shared/app-alert/app-alert';
import { ApiErrorMessagePipe } from '../../../../core/pipes/api-error-message.pipe';
import { EmptyState } from '../../../../shared/empty-state/empty-state';
import { PageHeader } from '../../../../shared/page-header/page-header';
import { EnrolmentPanel } from '../../components/enrolment-panel/enrolment-panel';

@Component({
  selector: 'app-applications-page',
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
    AppAlert,
    ApiErrorMessagePipe,
    EnrolmentPanel,
    ButtonModule,
    DialogModule,
    SkeletonModule,
    TableModule,
    TagModule,
    TooltipModule,
    EmptyState,
    PageHeader,
  ],
  templateUrl: './applications-page.html',
  styleUrl: './applications-page.scss',
})
export class ApplicationsPage {
  private readonly consoleCopy = inject(ConsoleCopyService);
  private readonly statusLabels = inject(StatusLabelService);
  private readonly router = inject(Router);
  readonly shell = inject(ConsoleShellService);
  readonly copy = computed(() => this.consoleCopy.current().applications);

  readonly pending = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly banner = signal<string | null>(null);
  readonly activeAppsCount = computed(() => this.shell.apps().filter((app) => app.is_active).length);

  // QR dialog: the ENROLMENT QR (what phones scan to subscribe). Token
  // regenerate/revoke and deletion live on the detail page (Envoi / Paramètres).
  readonly qrApp = signal<ApplicationRead | null>(null);

  openCreate(): void {
    void this.router.navigate(['/dashboard/applications/new']);
  }

  toggleState(app: ApplicationRead): void {
    this.pending.set(true);
    this.error.set(null);
    this.banner.set(null);

    this.shell.toggleAppState(
      app,
      () => {
        this.pending.set(false);
        this.banner.set(app.is_active ? this.copy().alerts.deactivated : this.copy().alerts.activated);
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

  /** The list's QR action shows the ENROLMENT QR (`apk_`, what phones scan).
   * The send token (`apt_`) stays on the detail page, never as a QR. */
  openQr(app: ApplicationRead): void {
    this.qrApp.set(app);
  }

  setQrVisible(visible: boolean): void {
    if (!visible) {
      this.closeQr();
    }
  }

  closeQr(): void {
    this.qrApp.set(null);
  }

  onEnrolmentCodeRotated(app: ApplicationRead, code: string): void {
    this.qrApp.set({ ...app, enrolment_code: code });
    this.shell.loadShell(app.id);
  }

  trackById(_: number, app: ApplicationRead): number {
    return app.id;
  }

  appSeverity(app: ApplicationRead): 'success' | 'secondary' {
    return app.is_active ? 'success' : 'secondary';
  }

  appStatusLabel(app: ApplicationRead): string {
    return this.statusLabels.activeLabel('application', app.is_active);
  }

  refreshApplications(): void {
    this.error.set(null);
    this.banner.set(null);
    this.shell.loadShell(this.shell.selectedAppId() ?? undefined);
  }

  openDetails(app: ApplicationRead): void {
    void this.router.navigate(['/dashboard/applications', app.id]);
  }
}
