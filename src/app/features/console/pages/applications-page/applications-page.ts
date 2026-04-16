import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { finalize } from 'rxjs';

import { ApiErrorResponse, ApplicationRead } from '../../../../core/models/api.models';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { coerceApiError, errorFieldMessages } from '../../../../core/utils/api-error.utils';
import { interpolate } from '../../../../core/utils/string.utils';
import { AppAlert } from '../../../../shared/app-alert/app-alert';
import { AppConfirmService } from '../../../../shared/app-confirm-dialog/app-confirm.service';
import { ApplicationFormFields } from '../../components/application-form-fields/application-form-fields';
import { ConsoleDialogActions } from '../../components/console-dialog-actions/console-dialog-actions';

@Component({
  selector: 'app-applications-page',
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    DatePipe,
    AppAlert,
    ApplicationFormFields,
    ConsoleDialogActions,
    ButtonModule,
    DialogModule,
    InputTextModule,
    TableModule,
    TagModule,
    TextareaModule,
    TooltipModule,
  ],
  templateUrl: './applications-page.html',
  styleUrl: './applications-page.scss',
})
export class ApplicationsPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(PushitApiService);
  private readonly consoleCopy = inject(ConsoleCopyService);
  private readonly confirm = inject(AppConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly shell = inject(ConsoleShellService);
  readonly copy = computed(() => this.consoleCopy.current().applications);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: [''],
  });

  readonly pending = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly banner = signal<string | null>(null);
  readonly isModalOpen = signal(false);
  readonly modalMode = signal<'create' | 'edit'>('create');
  readonly editingAppId = signal<number | null>(null);
  readonly activeAppsCount = computed(() => this.shell.apps().filter((app) => app.is_active).length);

  ngOnInit(): void {
    const editAppId = Number(this.route.snapshot.queryParamMap.get('edit'));
    if (!Number.isFinite(editAppId) || editAppId <= 0) {
      return;
    }

    const app = this.shell.apps().find((item) => item.id === editAppId);
    if (app) {
      this.openEditModal(app);
    }
  }

  openCreateModal(): void {
    this.error.set(null);
    this.form.reset({ name: '', description: '' });
    this.editingAppId.set(null);
    this.modalMode.set('create');
    this.isModalOpen.set(true);
  }

  openEditModal(app: ApplicationRead): void {
    this.error.set(null);
    this.editingAppId.set(app.id);
    this.modalMode.set('edit');
    this.form.reset({
      name: app.name,
      description: app.description,
    });
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.editingAppId.set(null);
    this.modalMode.set('create');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { edit: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  setModalVisible(visible: boolean): void {
    if (!visible) {
      this.closeModal();
      return;
    }

    this.isModalOpen.set(true);
  }

  createApp(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.pending.set(true);
    this.error.set(null);
    this.banner.set(null);

    this.shell.createApp(
      this.form.getRawValue(),
      () => {
        this.pending.set(false);
        this.form.reset({ name: '', description: '' });
        this.banner.set(this.copy().alerts.created);
        this.closeModal();
      },
      () => {
        this.pending.set(false);
        this.error.set({
          code: 'application_create_failed',
          detail: this.copy().errors.create,
        });
      },
    );
  }

  saveApp(): void {
    if (this.modalMode() === 'create') {
      this.createApp();
      return;
    }

    const appId = this.editingAppId();
    if (!appId) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.pending.set(true);
    this.error.set(null);
    this.banner.set(null);

    this.api
      .updateApp(appId, this.form.getRawValue())
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: (app) => {
          this.banner.set(this.interpolate(this.copy().alerts.updated, { name: app.name }));
          this.closeModal();
          this.shell.loadShell(app.id);
        },
        error: (error) => {
          this.error.set(coerceApiError(error));
        },
      });
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

  regenerateToken(app: ApplicationRead): void {
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

  revokeToken(app: ApplicationRead): void {
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

  fieldErrors(fieldName: string): string[] {
    return errorFieldMessages(this.error(), fieldName);
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
