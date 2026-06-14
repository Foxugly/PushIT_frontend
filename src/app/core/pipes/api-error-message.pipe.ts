import { Pipe, PipeTransform, inject } from '@angular/core';

import { ApiErrorResponse } from '../models/api.models';
import { PublicI18nService } from '../services/public-i18n.service';
import { API_ERROR_COPY, localizeApiError } from '../utils/api-error-copy';

/**
 * Turns a coerced ApiErrorResponse into a localized, user-facing message.
 * Impure so it re-localizes if the language changes while an error is shown
 * (error alerts are few — the cost is negligible).
 */
@Pipe({ name: 'apiError', pure: false })
export class ApiErrorMessagePipe implements PipeTransform {
  private readonly i18n = inject(PublicI18nService);

  transform(error: ApiErrorResponse | null | undefined): string {
    if (!error) {
      return '';
    }
    return localizeApiError(error, API_ERROR_COPY[this.i18n.language()]);
  }
}
