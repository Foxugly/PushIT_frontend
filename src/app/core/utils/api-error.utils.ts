import { HttpErrorResponse } from '@angular/common/http';

import { ApiErrorResponse } from '../models/api.models';

// Les `detail` de repli sont des sentinelles techniques : l'UI n'affiche jamais le
// detail brut mais le message traduit de `localizeApiError` (pipe `apiError`).
export function coerceApiError(error: unknown): ApiErrorResponse {
  if (error instanceof HttpErrorResponse) {
    if (error.error && typeof error.error === 'object') {
      const body = error.error as Partial<ApiErrorResponse>;

      return {
        code: body.code ?? `http_${error.status}`,
        detail: body.detail ?? error.message,
        errors: body.errors ?? {},
        incident_id: body.incident_id,
      };
    }

    return {
      code: `http_${error.status}`,
      detail: error.message || 'Request failed.',
      errors: {},
    };
  }

  if (error instanceof Error) {
    return {
      code: 'unexpected_error',
      detail: error.message,
      errors: {},
    };
  }

  return {
    code: 'unexpected_error',
    detail: 'Unexpected error.',
    errors: {},
  };
}

export function errorFieldMessages(
  error: ApiErrorResponse | null,
  fieldName: string,
): string[] {
  return error?.errors?.[fieldName] ?? [];
}
