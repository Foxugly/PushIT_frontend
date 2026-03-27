import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { coerceApiError, errorFieldMessages } from '../../../../core/utils/api-error.utils';

@Component({
  selector: 'app-applications-page',
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    DatePipe,
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
export class ApplicationsPage {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(PushitApiService);
  private readonly router = inject(Router);
  readonly shell = inject(ConsoleShellService);

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
        this.banner.set("Application creee. Le token brut est disponible dans la colonne de droite.");
        this.closeModal();
      },
      () => {
        this.pending.set(false);
        this.error.set({
          code: 'application_create_failed',
          detail: "Impossible de creer l'application.",
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
          this.banner.set(`Application ${app.name} mise a jour.`);
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
        this.banner.set(`Application ${app.is_active ? 'desactivee' : 'activee'} avec succes.`);
      },
      () => {
        this.pending.set(false);
        this.error.set({
          code: 'application_toggle_failed',
          detail: "Impossible de mettre a jour l'etat de l'application.",
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
        this.banner.set('Un nouveau token a ete genere et affiche dans la colonne de droite.');
      },
      () => {
        this.pending.set(false);
        this.error.set({
          code: 'application_token_failed',
          detail: 'Impossible de regenerer le token.',
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
        this.banner.set('Le token de cette application a ete revoque.');
      },
      () => {
        this.pending.set(false);
        this.error.set({
          code: 'application_revoke_failed',
          detail: 'Impossible de revoquer le token.',
        });
      },
    );
  }

  deleteApp(app: ApplicationRead): void {
    const shouldDelete = window.confirm(`Supprimer l'application "${app.name}" ?`);
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
          this.banner.set(`Application ${app.name} supprimee.`);
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

  openDetails(app: ApplicationRead): void {
    void this.router.navigate(['/dashboard/applications', app.id]);
  }
}
