import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { SelectButtonModule } from 'primeng/selectbutton';

import { LanguagePreferenceService } from '../../core/services/language-preference.service';
import { SessionService } from '../../core/services/session.service';
import { LanguageCode, PublicI18nService } from '../../core/services/public-i18n.service';

const LABELS: Record<
  LanguageCode,
  {
    home: string;
    dashboard: string;
    features: string;
    donate: string;
    login: string;
    settings: string;
    changePassword: string;
    logout: string;
  }
> = {
  fr: {
    home: 'Home',
    dashboard: 'Dashboard',
    features: 'Fonctionnalites',
    donate: 'Faire un don',
    login: 'Se connecter',
    settings: 'Settings',
    changePassword: 'Changer de mot de passe',
    logout: 'Deconnexion',
  },
  nl: {
    home: 'Home',
    dashboard: 'Dashboard',
    features: 'Functies',
    donate: 'Doneren',
    login: 'Inloggen',
    settings: 'Settings',
    changePassword: 'Wachtwoord wijzigen',
    logout: 'Uitloggen',
  },
  en: {
    home: 'Home',
    dashboard: 'Dashboard',
    features: 'Features',
    donate: 'Donate',
    login: 'Log in',
    settings: 'Settings',
    changePassword: 'Change password',
    logout: 'Log out',
  },
};

@Component({
  selector: 'app-site-header',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    ButtonModule,
    Menu,
    SelectButtonModule,
  ],
  templateUrl: './site-header.html',
  styleUrl: './site-header.scss',
})
export class SiteHeader {
  private readonly i18n = inject(PublicI18nService);
  private readonly languagePreference = inject(LanguagePreferenceService);
  readonly session = inject(SessionService);

  readonly showLoginButton = input(true);
  readonly showUserMenu = input(false);
  readonly sticky = input(false);
  readonly username = input('');
  readonly settingsSummary = input('');
  readonly settingsLink = input('/dashboard/settings');
  readonly changePasswordLink = input('/dashboard/change-password');
  readonly logoutRequested = output<void>();
  readonly languages = [
    { code: 'fr' as LanguageCode, label: 'FR' },
    { code: 'nl' as LanguageCode, label: 'NL' },
    { code: 'en' as LanguageCode, label: 'EN' },
  ];
  readonly labels = computed(() => LABELS[this.i18n.language()]);
  readonly userMenuItems = computed<MenuItem[]>(() => [
    {
      label: this.labels().settings,
      icon: 'pi pi-cog',
      routerLink: this.settingsLink(),
      badge: this.settingsSummary() || undefined,
    },
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
  ]);

  activeLanguage(): LanguageCode {
    return this.i18n.language();
  }

  setLanguage(language: LanguageCode): void {
    this.languagePreference.updateLanguage(language);
  }

  requestLogout(): void {
    this.logoutRequested.emit();
  }
}
