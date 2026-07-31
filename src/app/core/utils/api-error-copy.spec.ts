import { ApiErrorMessages, localizeApiError } from './api-error-copy';
import frCatalog from '../../../../public/i18n/fr.json';

// Le spec teste `localizeApiError`, pas le chargement : il lit donc le namespace
// `errors` directement dans le fichier de catalogue (public/i18n/, cf.
// STANDARD-frontend-layout.md §5bis) plutot que de monter un CatalogStore.
const fr = frCatalog.errors as unknown as ApiErrorMessages;

describe('localizeApiError', () => {
  it('maps known HTTP statuses to a localized message (ignoring the raw detail)', () => {
    expect(localizeApiError({ code: 'http_500', detail: 'Http failure 500', errors: {} }, fr)).toBe(
      fr.http[500],
    );
    expect(localizeApiError({ code: 'http_0', detail: 'Unknown Error', errors: {} }, fr)).toBe(
      fr.http[0],
    );
  });

  it('falls back to the server-family message for an unmapped 5xx', () => {
    expect(localizeApiError({ code: 'http_507', detail: 'x', errors: {} }, fr)).toBe(fr.http[500]);
  });

  it('localizes validation and unexpected errors', () => {
    expect(localizeApiError({ code: 'validation_error', detail: 'Validation error.', errors: {} }, fr)).toBe(
      fr.validation,
    );
    expect(localizeApiError({ code: 'unexpected_error', detail: 'TypeError: boom', errors: {} }, fr)).toBe(
      fr.generic,
    );
  });

  it('keeps the backend detail for a specific backend code', () => {
    expect(
      localizeApiError({ code: 'notification_not_found', detail: 'Notification not found.', errors: {} }, fr),
    ).toBe('Notification not found.');
  });

  it('uses the generic message when there is no usable detail', () => {
    expect(localizeApiError({ code: 'weird_code', detail: '', errors: {} }, fr)).toBe(fr.generic);
  });
});
