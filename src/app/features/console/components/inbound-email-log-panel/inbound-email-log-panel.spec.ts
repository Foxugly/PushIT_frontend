import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import frCatalog from '../../../../../../public/i18n/fr.json';
import { InboundEmailLog } from '../../../../core/models/api.models';
import { CatalogStore } from '../../../../core/i18n/catalog-store';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { InboundEmailLogPanel, inboundLogReason } from './inbound-email-log-panel';

const reasons = frCatalog.console.inboundEmailLog.reasons;

function makeLog(overrides: Partial<InboundEmailLog> = {}): InboundEmailLog {
  return {
    id: 1,
    processed_at: '2026-10-21T09:30:00Z',
    status: 'created',
    sender: 'alice@example.com',
    subject: 'Coupure réseau',
    error_message: '',
    notification_id: 42,
    ...overrides,
  };
}

describe('inboundLogReason', () => {
  it('maps the stable refusal codes to readable text', () => {
    expect(inboundLogReason('sender_not_allowed: x@y.com is not allowed', reasons)).toBe(
      'Expéditeur non autorisé',
    );
    expect(inboundLogReason('sender_blocked: blocklisted', reasons)).toBe('Expéditeur bloqué');
    expect(inboundLogReason('dmarc_failed: spf=fail', reasons)).toBe(
      'Échec du contrôle anti-usurpation (DMARC)',
    );
  });

  it('shows any other message as written, and nothing for an accepted mail', () => {
    expect(inboundLogReason('Duplicate message id with different content', reasons)).toBe(
      'Duplicate message id with different content',
    );
    expect(inboundLogReason('unknown_code: something', reasons)).toBe('unknown_code: something');
    expect(inboundLogReason('', reasons)).toBe('');
  });
});

describe('InboundEmailLogPanel', () => {
  let fixture: ComponentFixture<InboundEmailLogPanel>;
  let getInboundEmailLogs: ReturnType<typeof vi.fn>;

  function render(active = true): void {
    fixture = TestBed.createComponent(InboundEmailLogPanel);
    fixture.componentRef.setInput('appId', 7);
    fixture.componentRef.setInput('active', active);
    fixture.detectChanges();
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    getInboundEmailLogs = vi.fn().mockReturnValue(of([]));
    await TestBed.configureTestingModule({
      imports: [InboundEmailLogPanel],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: PushitApiService, useValue: { getInboundEmailLogs } },
        { provide: ConsoleCopyService, useValue: { current: signal(frCatalog.console) } },
        { provide: CatalogStore, useValue: { get: () => frCatalog } },
      ],
    }).compileComponents();
  });

  it('waits until it is active before loading, then loads once', () => {
    render(false);
    expect(getInboundEmailLogs).not.toHaveBeenCalled();

    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();
    fixture.componentRef.setInput('active', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('active', true);
    fixture.detectChanges();

    expect(getInboundEmailLogs).toHaveBeenCalledTimes(1);
    expect(getInboundEmailLogs).toHaveBeenCalledWith(7);
  });

  it('shows a loading state, then the empty state', () => {
    const pending = new Subject<InboundEmailLog[]>();
    getInboundEmailLogs.mockReturnValue(pending);
    render();
    expect(el().querySelector('[data-testid="inbound-log-loading"]')?.textContent).toContain(
      'Chargement des e-mails reçus',
    );

    pending.next([]);
    pending.complete();
    fixture.detectChanges();

    expect(el().querySelector('[data-testid="inbound-log-loading"]')).toBeNull();
    expect(el().querySelector('[data-testid="inbound-log-empty"]')?.textContent).toContain(
      "Aucun e-mail reçu pour l'instant",
    );
  });

  it('lists the mails with their status and readable reason', () => {
    getInboundEmailLogs.mockReturnValue(
      of([
        makeLog(),
        makeLog({
          id: 2,
          status: 'rejected',
          sender: 'mallory@evil.io',
          subject: '',
          error_message: 'sender_blocked: mallory@evil.io is on the blocklist',
          notification_id: null,
        }),
        makeLog({ id: 3, status: 'existing', notification_id: null }),
        makeLog({ id: 4, status: 'error', error_message: 'SMTP parse failure', notification_id: null }),
      ]),
    );
    render();

    const created = el().querySelector('[data-testid="inbound-log-row-1"]')!;
    expect(created.textContent).toContain('alice@example.com');
    expect(created.textContent).toContain('Notification créée');
    expect(created.querySelector('a')?.getAttribute('href')).toBe('/dashboard/notifications/42');

    const rejected = el().querySelector('[data-testid="inbound-log-row-2"]')!;
    expect(rejected.textContent).toContain('Refusé');
    expect(rejected.textContent).toContain('Expéditeur bloqué');
    expect(rejected.textContent).toContain('(sans objet)');
    expect(rejected.querySelector('a')).toBeNull();

    expect(el().querySelector('[data-testid="inbound-log-row-3"]')?.textContent).toContain('Doublon ignoré');
    const error = el().querySelector('[data-testid="inbound-log-row-4"]')!;
    expect(error.textContent).toContain('Erreur');
    expect(error.textContent).toContain('SMTP parse failure');
  });

  it('shows the error and reloads on « Actualiser »', () => {
    getInboundEmailLogs.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404, error: { detail: 'Application introuvable.' } })),
    );
    render();
    expect(fixture.componentInstance.error()).not.toBeNull();
    expect(el().textContent).toContain('Ressource introuvable.');
    expect(el().querySelector('[data-testid="inbound-log-empty"]')).toBeNull();

    getInboundEmailLogs.mockReturnValue(of([makeLog()]));
    const refresh = Array.from(el().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Actualiser'),
    )!;
    refresh.click();
    fixture.detectChanges();

    expect(getInboundEmailLogs).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.error()).toBeNull();
    expect(el().querySelector('[data-testid="inbound-log-row-1"]')).not.toBeNull();
  });
});
