import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { Menu } from 'primeng/menu';

import { AppCopyService } from '../../services/app-copy.service';
import { PushitApiService } from '../../services/pushit-api.service';
import { SessionService } from '../../services/session.service';

/**
 * Polymorphic user slot (fleet standard §6) — dernier des actions du topmenu.
 * Déconnecté → lien « Se connecter ». Connecté → dropdown (Paramètres / Changer
 * le mot de passe / Déconnexion). La bascule auth est gérée ICI (le topmenu n'a
 * pas de `@if(auth)` pour cette zone).
 */
@Component({
  selector: 'app-user-menu',
  imports: [RouterLink, ButtonModule, Menu],
  templateUrl: './user-menu.html',
  styleUrl: './user-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserMenu {
  private readonly appCopy = inject(AppCopyService);
  private readonly api = inject(PushitApiService);
  readonly session = inject(SessionService);

  readonly settingsLink = input('/dashboard/settings');
  readonly changePasswordLink = input('/dashboard/change-password');
  readonly settingsSummary = input('');

  readonly labels = computed(() => this.appCopy.current().header);
  readonly displayUsername = computed(
    () => this.session.user()?.email || 'Compte',
  );

  readonly userMenuItems = computed<MenuItem[]>(() => {
    const items: MenuItem[] = [
      { label: this.labels().settings, icon: 'pi pi-cog', routerLink: this.settingsLink() },
    ];
    if (this.settingsSummary()) {
      items.push({
        label: this.settingsSummary(),
        icon: 'pi pi-link',
        disabled: true,
        styleClass: 'user-menu__meta',
      });
    }
    items.push(
      { label: this.labels().changePassword, icon: 'pi pi-key', routerLink: this.changePasswordLink() },
      { separator: true },
      { label: this.labels().logout, icon: 'pi pi-sign-out', command: () => this.requestLogout() },
    );
    return items;
  });

  requestLogout(): void {
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
}
