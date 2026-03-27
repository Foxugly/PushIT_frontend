import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PublicI18nService } from '../../../core/services/public-i18n.service';
import { RegisterPanel } from '../../../shared/register-panel/register-panel';
import { SiteHeader } from '../../../shared/site-header/site-header';

const COPY = {
  fr: {
    badge: 'PushIT pour les equipes produit',
    title: 'Une interface bleu clair, plus douce et plus nette.',
    description:
      'Centralisez vos campagnes push dans un espace moderne, plus calme a parcourir et plus simple a prendre en main.',
    primary: 'Voir les features',
    secondary: 'Se connecter',
    register: {
      title: 'Creer un compte',
      subtitle: 'Inscrivez-vous directement depuis la home.',
    },
    previewTitle: 'Un espace clair pour vos operations push',
    preview: [
      'Connexion et inscription dediees',
      'Workflows backend deplaces dans la page Features',
      'Navigation publique separee entre Home, Features et Donate',
    ],
  },
  nl: {
    badge: 'PushIT voor productteams',
    title: 'Een lichtblauwe interface die rustiger en helderder aanvoelt.',
    description:
      'Centraliseer pushcampagnes in een moderne ruimte die rustiger leest en eenvoudiger in gebruik is.',
    primary: 'Bekijk de features',
    secondary: 'Inloggen',
    register: {
      title: 'Account aanmaken',
      subtitle: 'Registreer je rechtstreeks vanaf de homepagina.',
    },
    previewTitle: 'Een heldere ruimte voor pushoperaties',
    preview: [
      "Aparte pagina's voor login en registratie",
      'Backendinformatie verplaatst naar Features',
      'Publieke navigatie tussen Home, Features en Donate',
    ],
  },
  en: {
    badge: 'PushIT for product teams',
    title: 'A light blue interface that feels cleaner and calmer.',
    description:
      'Centralize push campaigns in a modern workspace designed to feel lighter and easier to operate.',
    primary: 'See features',
    secondary: 'Log in',
    register: {
      title: 'Create an account',
      subtitle: 'Sign up directly from the homepage.',
    },
    previewTitle: 'A clearer space for push operations',
    preview: [
      'Dedicated login and registration pages',
      'Backend information moved to Features',
      'Public navigation split across Home, Features and Donate',
    ],
  },
} as const;

@Component({
  selector: 'app-home-page',
  imports: [CommonModule, RouterLink, RegisterPanel, SiteHeader],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  private readonly i18n = inject(PublicI18nService);
  readonly copy = computed(() => COPY[this.i18n.language()]);
}
