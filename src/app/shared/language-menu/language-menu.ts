import { UpperCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChildren,
} from '@angular/core';

import { LanguagePreferenceService } from '../../core/services/language-preference.service';
import { LanguageCode, PublicI18nService } from '../../core/services/public-i18n.service';

interface LanguageOption {
  code: LanguageCode;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'fr' },
  { code: 'nl' },
  { code: 'en' },
  { code: 'it' },
  { code: 'es' },
];

/**
 * Dropdown language switcher, mirroring TrainingManager's `app-language-switcher`:
 * a compact trigger showing the active code, a `role="menu"` popup with arrow-key
 * navigation, click-outside / Escape close. Wired to PushIT's PublicI18nService.
 */
@Component({
  selector: 'app-language-menu',
  imports: [UpperCasePipe],
  templateUrl: './language-menu.html',
  styleUrl: './language-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'close()',
    '(keydown.arrowdown)': 'onArrowDown($event)',
    '(keydown.arrowup)': 'onArrowUp($event)',
    '(keydown.home)': 'onHome($event)',
    '(keydown.end)': 'onEnd($event)',
  },
})
export class LanguageMenu {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly i18n = inject(PublicI18nService);
  private readonly languagePreference = inject(LanguagePreferenceService);

  protected readonly languages = LANGUAGES;
  protected readonly current = this.i18n.language;
  protected readonly open = signal(false);
  protected readonly focusedIndex = signal<number | null>(null);

  private readonly menuItems = viewChildren<ElementRef<HTMLButtonElement>>('menuitem');

  protected toggle(): void {
    const willOpen = !this.open();
    this.open.set(willOpen);
    if (willOpen) {
      const idx = this.languages.findIndex((l) => l.code === this.current());
      this.focusedIndex.set(idx >= 0 ? idx : 0);
      queueMicrotask(() => this.focusCurrent());
    } else {
      this.focusedIndex.set(null);
    }
  }

  protected close(): void {
    this.open.set(false);
    this.focusedIndex.set(null);
  }

  protected select(code: LanguageCode): void {
    this.languagePreference.updateLanguage(code);
    this.close();
  }

  protected onDocumentClick(event: Event): void {
    if (this.open() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  protected onArrowDown(event: Event): void {
    if (!this.open()) return;
    event.preventDefault();
    const next = ((this.focusedIndex() ?? -1) + 1) % this.languages.length;
    this.focusedIndex.set(next);
    this.focusCurrent();
  }

  protected onArrowUp(event: Event): void {
    if (!this.open()) return;
    event.preventDefault();
    const len = this.languages.length;
    const next = ((this.focusedIndex() ?? 0) - 1 + len) % len;
    this.focusedIndex.set(next);
    this.focusCurrent();
  }

  protected onHome(event: Event): void {
    if (!this.open()) return;
    event.preventDefault();
    this.focusedIndex.set(0);
    this.focusCurrent();
  }

  protected onEnd(event: Event): void {
    if (!this.open()) return;
    event.preventDefault();
    this.focusedIndex.set(this.languages.length - 1);
    this.focusCurrent();
  }

  private focusCurrent(): void {
    const idx = this.focusedIndex();
    if (idx == null) return;
    this.menuItems()[idx]?.nativeElement.focus();
  }
}
