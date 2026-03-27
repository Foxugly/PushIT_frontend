import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { finalize } from 'rxjs';

import { ApiErrorResponse, ApplicationRead } from '../../../../core/models/api.models';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { coerceApiError } from '../../../../core/utils/api-error.utils';

@Component({
  selector: 'app-application-detail-page',
  imports: [CommonModule, RouterLink, DatePipe, ButtonModule, TagModule],
  templateUrl: './application-detail-page.html',
  styleUrl: './application-detail-page.scss',
})
export class ApplicationDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(PushitApiService);
  readonly shell = inject(ConsoleShellService);

  readonly application = signal<ApplicationRead | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);

  ngOnInit(): void {
    const appId = Number(this.route.snapshot.paramMap.get('appId'));
    if (!Number.isFinite(appId) || appId <= 0) {
      this.error.set({
        code: 'invalid_application_id',
        detail: 'Identifiant application invalide.',
      });
      return;
    }

    const cachedApplication = this.shell.apps().find((app) => app.id === appId) ?? null;
    this.application.set(cachedApplication);
    this.loadApplication(appId);
  }

  appSeverity(app: ApplicationRead): 'success' | 'secondary' {
    return app.is_active ? 'success' : 'secondary';
  }

  private loadApplication(appId: number): void {
    this.loading.set(true);
    this.error.set(null);

    this.api
      .getApp(appId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (application) => {
          this.application.set(application);
        },
        error: (error) => {
          this.error.set(coerceApiError(error));
        },
      });
  }
}
