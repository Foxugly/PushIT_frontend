import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';

import { PublicI18nService } from '../../../core/services/public-i18n.service';
import { SiteFooter } from '../../../shared/site-footer/site-footer';
import { SiteHeader } from '../../../shared/site-header/site-header';

const COPY = {
  fr: {
    badge: 'Donate',
    title: 'Soutenir une console plus simple.',
    description:
      "Si le projet vous aide, cette page sert de point d'ancrage pour un futur vrai flux de donation.",
    cards: [
      'Soutien ponctuel pour le maintien du projet',
      'Participation aux evolutions UX et i18n',
      'Aide au financement des iterations produit',
    ],
    button: 'Bientot disponible',
  },
  nl: {
    badge: 'Donate',
    title: 'Steun een eenvoudigere console.',
    description:
      'Als het project nuttig is, dient deze pagina als basis voor een toekomstige donatiestroom.',
    cards: [
      'Eenmalige steun voor onderhoud van het project',
      'Bijdrage aan UX- en i18n-verbeteringen',
      'Ondersteuning voor productiteraties',
    ],
    button: 'Binnenkort beschikbaar',
  },
  en: {
    badge: 'Donate',
    title: 'Support a simpler console.',
    description:
      'If the project helps you, this page acts as a placeholder for a future real donation flow.',
    cards: [
      'One-off support for project maintenance',
      'Contribution to UX and i18n improvements',
      'Help fund product iterations',
    ],
    button: 'Coming soon',
  },
} as const;

@Component({
  selector: 'app-donate-page',
  imports: [CommonModule, SiteHeader, SiteFooter],
  templateUrl: './donate-page.html',
  styleUrl: './donate-page.scss',
})
export class DonatePage {
  private readonly i18n = inject(PublicI18nService);
  readonly copy = computed(() => COPY[this.i18n.language()]);
}
