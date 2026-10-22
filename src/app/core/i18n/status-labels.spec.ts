import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

// Suffixe `Catalog` obligatoire : un `import it from ...` masquerait `it()`.
import enCatalog from '../../../../public/i18n/en.json';
import esCatalog from '../../../../public/i18n/es.json';
import frCatalog from '../../../../public/i18n/fr.json';
import itCatalog from '../../../../public/i18n/it.json';
import nlCatalog from '../../../../public/i18n/nl.json';
import { ConsoleCopyService } from '../services/console-copy.service';
import { countLabel } from './count-label';
import { STATUS_VALUES, StatusKind, StatusLabelPipe, StatusLabelService } from './status-labels';

const CATALOGS = { fr: frCatalog, en: enCatalog, nl: nlCatalog, es: esCatalog, it: itCatalog };
const KINDS = Object.keys(STATUS_VALUES) as StatusKind[];

describe('shared status labels', () => {
  for (const [lang, catalog] of Object.entries(CATALOGS)) {
    describe(`${lang.toUpperCase()} catalog`, () => {
      const labels = catalog.console.statusLabels as Record<string, Record<string, string>>;

      for (const kind of KINDS) {
        it(`labels every ${kind} value`, () => {
          const missing = STATUS_VALUES[kind].filter(
            (value) => typeof labels[kind]?.[value] !== 'string' || !labels[kind][value].trim(),
          );
          expect(missing).toEqual([]);
          // No stale entry either: the catalog and STATUS_VALUES describe the same values.
          expect(Object.keys(labels[kind]).sort()).toEqual([...STATUS_VALUES[kind]].sort());
        });
      }

      it('has no kind that STATUS_VALUES does not know', () => {
        expect(Object.keys(labels).sort()).toEqual([...KINDS].sort());
      });
    });
  }

  it('never shows a raw lower-case API value in French', () => {
    const labels = frCatalog.console.statusLabels as Record<string, Record<string, string>>;
    const raw = KINDS.flatMap((kind) =>
      STATUS_VALUES[kind].filter((value) => labels[kind][value] === value).map((value) => `${kind}.${value}`),
    );
    expect(raw).toEqual([]);
  });
});

describe('StatusLabelService / statusLabel pipe', () => {
  const copy = signal(frCatalog.console);
  let service: StatusLabelService;

  beforeEach(() => {
    copy.set(frCatalog.console);
    TestBed.configureTestingModule({
      providers: [{ provide: ConsoleCopyService, useValue: { current: copy } }],
    });
    service = TestBed.inject(StatusLabelService);
  });

  it('translates through the active catalog', () => {
    expect(service.label('pushToken', 'invalid')).toBe('Jeton invalide');
    expect(service.label('platform', 'ios')).toBe('iPhone');
    expect(service.label('notification', 'no_target')).toBe('Aucun appareil ciblé');
    expect(service.activeLabel('application', false)).toBe('Inactive');
  });

  it('follows a language switch', () => {
    copy.set(enCatalog.console as unknown as typeof frCatalog.console);
    expect(service.label('notification', 'sent')).toBe('Sent');
  });

  it('shows an unknown value as is and an empty value as nothing', () => {
    expect(service.label('notification', 'brand_new_status')).toBe('brand_new_status');
    expect(service.label('delivery', null)).toBe('');
    expect(service.label('delivery', undefined)).toBe('');
  });

  it('pipe delegates to the service', () => {
    const pipe = TestBed.runInInjectionContext(() => new StatusLabelPipe());
    expect(pipe.transform('RECURRING', 'quietPeriodType')).toBe('Récurrente');
  });
});

describe('countLabel', () => {
  const forms = frCatalog.console.counts.devices;

  it('uses each language plural rules', () => {
    expect(countLabel(forms, 0, 'fr')).toBe('0 appareil');
    expect(countLabel(forms, 1, 'fr')).toBe('1 appareil');
    expect(countLabel(forms, 3, 'fr')).toBe('3 appareils');
    expect(countLabel(enCatalog.console.counts.devices, 0, 'en')).toBe('0 devices');
    expect(countLabel(enCatalog.console.counts.devices, 1, 'en')).toBe('1 device');
  });

  it('falls back to the bare number without forms', () => {
    expect(countLabel(undefined, 4, 'fr')).toBe('4');
  });
});
