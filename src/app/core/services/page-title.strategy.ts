import { Injectable, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';

import { AppCopyService } from './app-copy.service';

/** Nom de l'application : suffixe de tous les titres d'onglet, et titre de la page d'accueil. */
export const APP_TITLE = 'PushIT';
const SEPARATOR = ' — ';

/** Lit une clé pointée (`header.features`, `console.sections.0.label`) dans le catalogue `app`. */
export function resolveTitleKey(copy: unknown, key: string): string | null {
  let node: unknown = copy;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') {
      return null;
    }
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' && node ? node : null;
}

/**
 * Titre d'onglet « {titre traduit de la page} — PushIT », composé à partir de
 * `data.titleKey` (clé relative au catalogue `app`) de la route active. Recalculé
 * à chaque changement de langue. Sans `titleKey` (accueil), le titre est le nom
 * de l'application seul.
 */
@Injectable({ providedIn: 'root' })
export class PageTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly appCopy = inject(AppCopyService);
  private readonly titleKey = signal<string | null>(null);

  constructor() {
    super();
    effect(() => {
      const key = this.titleKey();
      const page = key ? resolveTitleKey(this.appCopy.current(), key) : null;
      this.title.setTitle(page ? `${page}${SEPARATOR}${APP_TITLE}` : APP_TITLE);
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    let route: ActivatedRouteSnapshot = snapshot.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    const key = route.data['titleKey'];
    this.titleKey.set(typeof key === 'string' ? key : null);
  }
}
