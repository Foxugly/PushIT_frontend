import { Pipe, PipeTransform, inject } from '@angular/core';

import { PublicI18nService } from '../services/public-i18n.service';

/** Singular/plural forms of a count label; `{count}` is replaced by the number. */
export interface CountForms {
  one: string;
  other: string;
}

/**
 * Picks the plural form with the language's own rules (`Intl.PluralRules`:
 * French puts 0 in `one` — « 0 appareil » — English in `other` — "0 devices").
 */
export function countLabel(forms: CountForms | null | undefined, count: number, language: string): string {
  if (!forms) {
    return String(count);
  }
  const form = new Intl.PluralRules(language).select(count) === 'one' ? forms.one : forms.other;
  return form.replace('{count}', String(count));
}

/** `{{ devices().length | countLabel: copy().counts.devices }}` → « 3 appareils ». */
@Pipe({ name: 'countLabel', pure: false })
export class CountLabelPipe implements PipeTransform {
  private readonly i18n = inject(PublicI18nService);

  transform(count: number, forms: CountForms | null | undefined): string {
    return countLabel(forms, count, this.i18n.language());
  }
}
