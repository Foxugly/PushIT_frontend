import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

import { ApiErrorMessagePipe } from '../../../../core/pipes/api-error-message.pipe';
import { ApiErrorResponse, StaffUser } from '../../../../core/models/api.models';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { StaffService } from '../../../../core/services/staff.service';
import { coerceApiError } from '../../../../core/utils/api-error.utils';
import { AppAlert } from '../../../../shared/app-alert/app-alert';
import { PageHeader } from '../../../../shared/page-header/page-header';

/**
 * Back-office des comptes : chercher quelqu'un et lui offrir l'accès.
 *
 * La page ne fait que ça, parce que l'API ne fait que ça. Changer un email, un
 * mot de passe, désactiver ou supprimer un compte reste dans l'admin Django —
 * ce ne sont pas des gestes à mettre à un clic dans une console.
 *
 * Sans recherche, la liste montre les comptes déjà offerts : c'est la question
 * qu'on se pose en pratique, « à qui ai-je donné quoi ».
 */
@Component({
  selector: 'app-accounts-page',
  imports: [
    CommonModule,
    FormsModule,
    ApiErrorMessagePipe,
    AppAlert,
    ButtonModule,
    InputTextModule,
    PageHeader,
    TableModule,
    TagModule,
    ToggleSwitchModule,
  ],
  templateUrl: './accounts-page.html',
  styleUrl: './accounts-page.scss',
})
export class AccountsPage implements OnInit {
  private readonly staff = inject(StaffService);
  private readonly consoleCopy = inject(ConsoleCopyService);

  readonly copy = computed(() => this.consoleCopy.current().accounts);

  readonly users = signal<StaffUser[]>([]);
  readonly loading = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly notice = signal('');
  /** Id du compte dont une bascule est en vol, pour ne pas double-cliquer. */
  readonly busy = signal<number | null>(null);

  query = '';

  /** Notes en cours d'édition, par compte : on n'écrit qu'à la validation. */
  private readonly draftNotes = signal<Record<number, string>>({});

  ngOnInit(): void {
    this.search();
  }

  search(): void {
    this.error.set(null);
    this.reload();
  }

  /**
   * Recharge sans toucher au message d'erreur courant.
   *
   * `search()` l'efface, ce qui est juste quand c'est l'utilisateur qui relance
   * une recherche — mais pas quand on recharge *parce qu'*une bascule a échoué :
   * on effacerait le message qu'on vient d'afficher.
   */
  private reload(): void {
    this.loading.set(true);
    this.staff.users(this.query.trim()).subscribe({
      next: (users) => {
        this.users.set(users);
        this.draftNotes.set(Object.fromEntries(users.map((u) => [u.id, u.bypass_note])));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(coerceApiError(err));
        this.loading.set(false);
      },
    });
  }

  noteFor(userId: number): string {
    return this.draftNotes()[userId] ?? '';
  }

  setNote(userId: number, note: string): void {
    this.draftNotes.update((current) => ({ ...current, [userId]: note }));
  }

  /**
   * Bascule l'accès offert. La note part avec la bascule : c'est le moment où
   * elle a du sens, et le journal serveur l'enregistre avec l'octroi.
   */
  toggle(user: StaffUser, granted: boolean): void {
    this.apply(user, { subscription_bypass: granted, bypass_note: this.noteFor(user.id) });
  }

  /** Corriger une note seule ne touche pas à l'accès et n'écrit aucun journal. */
  saveNote(user: StaffUser): void {
    this.apply(user, { bypass_note: this.noteFor(user.id) });
  }

  private apply(user: StaffUser, patch: Record<string, unknown>): void {
    this.busy.set(user.id);
    this.error.set(null);
    this.staff.update(user.id, patch).subscribe({
      next: (updated) => {
        // On remplace la ligne par ce que le serveur a réellement enregistré,
        // plutôt que par ce qu'on lui a demandé : c'est lui qui horodate.
        this.users.update((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
        this.setNote(updated.id, updated.bypass_note);
        this.busy.set(null);
        this.notice.set(this.copy().saved);
      },
      error: (err) => {
        this.busy.set(null);
        this.error.set(coerceApiError(err));
        // La ligne n'a pas bougé côté serveur : on force un rechargement pour
        // que l'interrupteur ne reste pas sur une position qui n'existe pas.
        this.reload();
      },
    });
  }
}
