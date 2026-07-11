import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { Menu } from 'primeng/menu';

import { AppCopyService } from '../../core/services/app-copy.service';
import { PushitApiService } from '../../core/services/pushit-api.service';
import { SessionService } from '../../core/services/session.service';
import { LanguageMenu } from '../language-menu/language-menu';

@Component({
  selector: 'app-site-header',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    ButtonModule,
    Menu,
    LanguageMenu,
  ],
  templateUrl: './site-header.html',
  styleUrl: './site-header.scss',
})
export class SiteHeader {
  private readonly appCopy = inject(AppCopyService);
  private readonly api = inject(PushitApiService);
  readonly session = inject(SessionService);

  readonly sticky = input(false);
  readonly maxWidth = input('var(--content-max)');
  readonly username = input('');
  readonly settingsSummary = input('');
  readonly settingsLink = input('/dashboard/settings');
  readonly changePasswordLink = input('/dashboard/change-password');
  readonly labels = computed(() => this.appCopy.current().header);
  readonly displayUsername = computed(
    () => this.username() || this.session.user()?.email || 'Compte',
  );
  readonly userMenuItems = computed<MenuItem[]>(() => {
    const items: MenuItem[] = [
      {
        label: this.labels().settings,
        icon: 'pi pi-cog',
        routerLink: this.settingsLink(),
      },
    ];

    if (this.settingsSummary()) {
      items.push({
        label: this.settingsSummary(),
        icon: 'pi pi-link',
        disabled: true,
        styleClass: 'site-header__menu-meta',
      });
    }

    items.push(
      {
        label: this.labels().changePassword,
        icon: 'pi pi-key',
        routerLink: this.changePasswordLink(),
      },
      {
        separator: true,
      },
      {
        label: this.labels().logout,
        icon: 'pi pi-sign-out',
        command: () => this.requestLogout(),
      },
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
