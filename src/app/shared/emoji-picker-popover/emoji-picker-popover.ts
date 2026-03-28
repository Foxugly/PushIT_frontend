import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { ButtonModule } from 'primeng/button';
import { PopoverModule } from 'primeng/popover';
import { TooltipModule } from 'primeng/tooltip';

import { PublicI18nService } from '../../core/services/public-i18n.service';

type EmojiPickerEvent = {
  emoji?: {
    native?: string;
  };
};

@Component({
  selector: 'app-emoji-picker-popover',
  imports: [CommonModule, PickerComponent, ButtonModule, PopoverModule, TooltipModule],
  templateUrl: './emoji-picker-popover.html',
  styleUrl: './emoji-picker-popover.scss',
})
export class EmojiPickerPopover {
  private readonly i18n = inject(PublicI18nService);

  readonly tooltip = input('Inserer un emoji');
  readonly icon = input('pi pi-face-smile');
  readonly emojiSelected = output<string>();
  protected readonly pickerRequested = signal(false);
  protected readonly includedCategories = ['people', 'symbols', 'objects', 'activity'];
  protected readonly loadingLabel = computed(() => {
    switch (this.i18n.language()) {
      case 'nl':
        return 'Emoji laden...';
      case 'en':
        return 'Loading emojis...';
      default:
        return 'Chargement des emojis...';
    }
  });

  readonly pickerI18n = computed(() => {
    switch (this.i18n.language()) {
      case 'nl':
        return {
          search: 'Zoeken',
          emojilist: 'Emoji-lijst',
          notfound: 'Geen emoji gevonden',
          clear: 'Wissen',
          categories: {
            search: 'Zoekresultaten',
            recent: 'Recent gebruikt',
            people: 'Smileys en personen',
            nature: 'Dieren en natuur',
            foods: 'Eten en drinken',
            activity: 'Activiteit',
            places: 'Reizen en plaatsen',
            objects: 'Objecten',
            symbols: 'Symbolen',
            flags: 'Vlaggen',
            custom: 'Aangepast',
          },
        };
      case 'en':
        return {
          search: 'Search',
          emojilist: 'Emoji list',
          notfound: 'No emoji found',
          clear: 'Clear',
          categories: {
            search: 'Search Results',
            recent: 'Frequently Used',
            people: 'Smileys & People',
            nature: 'Animals & Nature',
            foods: 'Food & Drink',
            activity: 'Activity',
            places: 'Travel & Places',
            objects: 'Objects',
            symbols: 'Symbols',
            flags: 'Flags',
            custom: 'Custom',
          },
        };
      default:
        return {
          search: 'Recherche',
          emojilist: 'Liste des emojis',
          notfound: 'Aucun emoji trouve',
          clear: 'Effacer',
          categories: {
            search: 'Resultats',
            recent: 'Recents',
            people: 'Smileys et personnes',
            nature: 'Animaux et nature',
            foods: 'Nourriture et boissons',
            activity: 'Activites',
            places: 'Voyages et lieux',
            objects: 'Objets',
            symbols: 'Symboles',
            flags: 'Drapeaux',
            custom: 'Personnalise',
          },
        };
    }
  });

  protected onEmojiSelect(event: EmojiPickerEvent, popover: { hide: () => void }): void {
    const emoji = event.emoji?.native;
    if (!emoji) {
      return;
    }

    this.emojiSelected.emit(emoji);
    popover.hide();
  }

  protected openPopover(event: Event, popover: { toggle: (event: Event) => void }): void {
    popover.toggle(event);
  }

  protected onPopoverShow(): void {
    if (!this.pickerRequested()) {
      this.pickerRequested.set(true);
    }
  }
}
