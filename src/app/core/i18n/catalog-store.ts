import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { LanguageCode, UI_LANGS } from '../services/public-i18n.service';

/**
 * Shape of one language catalog, inferred from the FR reference.
 *
 * Type-only import: it costs nothing at runtime (no bundled JSON), it just
 * keeps the typed façades (`AppCopyService`, `ConsoleCopyService`) and their
 * ~60 consumers typed exactly as before the move to `public/i18n/`.
 */
export type Catalog = typeof import('../../../../public/i18n/fr.json');

/**
 * Charge les catalogues i18n depuis `public/i18n/<lang>.json`
 * (STANDARD-frontend-layout.md §5bis) et les expose en lecture SYNCHRONE.
 *
 * Pourquoi un store et pas simplement un loader HTTP : les façades typées de
 * cette app lisent le catalogue de façon synchrone (`computed(() =>
 * CATALOGS[lang].app)`), et `PublicI18nService.setLanguage()` est synchrone lui
 * aussi — y compris sur son chemin de rollback. Un loader HTTP nu aurait rendu
 * ces lectures asynchrones et fait remonter la contrainte jusqu'aux ~60
 * fichiers consommateurs.
 *
 * On precharge donc les 5 langues au bootstrap, via `preload()` appele depuis un
 * APP_INITIALIZER. Apres cela `get()` ne peut plus echouer et tout le code
 * appelant reste synchrone, inchange.
 *
 * Ce n'est pas un cout net : ces memes catalogues etaient jusqu'ici embarques
 * dans le bundle JS (~240 Ko). Ils partent maintenant en assets statiques, que
 * nginx sert compresses et que le navigateur met en cache.
 */
@Injectable({ providedIn: 'root' })
export class CatalogStore {
  private readonly http = inject(HttpClient);
  private readonly catalogs = new Map<LanguageCode, Catalog>();

  /** Charge les 5 langues en parallele. A appeler une fois, au bootstrap. */
  async preload(): Promise<void> {
    await Promise.all(
      UI_LANGS.map(async (lang) => {
        const catalog = await firstValueFrom(this.http.get<Catalog>(`/i18n/${lang}.json`));
        this.catalogs.set(lang, catalog);
      }),
    );
  }

  /**
   * Lecture synchrone. Leve si `preload()` n'a pas ete attendu : mieux vaut une
   * erreur nette au demarrage qu'une UI muette dont on cherchera la cause.
   */
  get(lang: LanguageCode): Catalog {
    const catalog = this.catalogs.get(lang);
    if (!catalog) {
      throw new Error(
        `Catalogue i18n "${lang}" non charge — CatalogStore.preload() doit etre attendu au bootstrap.`,
      );
    }
    return catalog;
  }
}
