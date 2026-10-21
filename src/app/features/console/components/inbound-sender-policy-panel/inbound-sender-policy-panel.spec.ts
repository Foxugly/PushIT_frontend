import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import frCatalog from '../../../../../../public/i18n/fr.json';
import { makeApplication } from '../../../../../testing/console-fixtures';
import { ApplicationRead } from '../../../../core/models/api.models';
import { CatalogStore } from '../../../../core/i18n/catalog-store';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { InboundSenderPolicyPanel, isValidSenderEntry, parseSenderList } from './inbound-sender-policy-panel';

describe('parseSenderList / isValidSenderEntry', () => {
  it('splits per line, trims, lowercases and dedupes', () => {
    expect(parseSenderList(' Alice@Example.com \n\n@Corp.io\nalice@example.com;bob@x.org')).toEqual([
      'alice@example.com',
      '@corp.io',
      'bob@x.org',
    ]);
  });

  it('accepts addresses and @domains only', () => {
    expect(isValidSenderEntry('alice@example.com')).toBe(true);
    expect(isValidSenderEntry('@example.com')).toBe(true);
    expect(isValidSenderEntry('example.com')).toBe(false);
    expect(isValidSenderEntry('@nodot')).toBe(false);
    expect(isValidSenderEntry('a@b@c.com')).toBe(false);
  });
});

describe('InboundSenderPolicyPanel', () => {
  let fixture: ComponentFixture<InboundSenderPolicyPanel>;
  let component: InboundSenderPolicyPanel;
  let updateApp: ReturnType<typeof vi.fn>;

  function render(app: ApplicationRead = makeApplication()): void {
    fixture = TestBed.createComponent(InboundSenderPolicyPanel);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('app', app);
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  beforeEach(async () => {
    updateApp = vi.fn();
    await TestBed.configureTestingModule({
      imports: [InboundSenderPolicyPanel],
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        { provide: PushitApiService, useValue: { updateApp } },
        { provide: ConsoleCopyService, useValue: { current: signal(frCatalog.console) } },
        { provide: CatalogStore, useValue: { get: () => frCatalog } },
      ],
    }).compileComponents();
  });

  it('loads the policy from the application', () => {
    render(
      makeApplication({
        inbound_sender_mode: 'owner',
        inbound_sender_allowlist: ['ally@partner.io', '@corp.io'],
        inbound_sender_blocklist: ['spam@x.org'],
        inbound_rejection_notify_push: true,
      }),
    );

    expect(component.mode()).toBe('owner');
    expect(component.allowlistText()).toBe('ally@partner.io\n@corp.io');
    expect(component.blocklistText()).toBe('spam@x.org');
    expect(component.notifyEmail()).toBe(true);
    expect(component.notifyPush()).toBe(true);
    expect(component.replyToSender()).toBe(false);
    expect(text()).toContain('Qui peut envoyer par e-mail');
    expect(text()).toContain('Expéditeurs autorisés');
    expect(text()).toContain('backscatter');
  });

  it('hides the allowlist in « anyone » mode', () => {
    render(makeApplication({ inbound_sender_mode: 'anyone' }));
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="sender-allowlist-field"]')).toBeNull();

    component.mode.set('owner');
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="sender-allowlist-field"]')).not.toBeNull();
  });

  it('PATCHes the normalized policy and emits the updated application', () => {
    render();
    const updated = makeApplication({ inbound_sender_mode: 'anyone', inbound_sender_blocklist: ['@spam.io'] });
    updateApp.mockReturnValue(of(updated));
    const emitted: ApplicationRead[] = [];
    component.saved.subscribe((app) => emitted.push(app));

    component.mode.set('anyone');
    component.allowlistText.set('Ally@Partner.io\n');
    component.blocklistText.set('@SPAM.io');
    component.notifyEmail.set(false);
    component.notifyPush.set(true);
    component.replyToSender.set(true);
    component.save();

    expect(updateApp).toHaveBeenCalledWith(101, {
      inbound_sender_mode: 'anyone',
      inbound_sender_allowlist: ['ally@partner.io'],
      inbound_sender_blocklist: ['@spam.io'],
      inbound_rejection_notify_email: false,
      inbound_rejection_notify_push: true,
      inbound_rejection_reply_to_sender: true,
    });
    expect(emitted).toEqual([updated]);
    expect(component.banner()).toBe(frCatalog.console.inboundSenderPolicy.saved);
    expect(component.saving()).toBe(false);
  });

  it('refuses to save invalid entries and names them', () => {
    render();
    component.allowlistText.set('ok@example.com\nnot-an-address');
    fixture.detectChanges();

    component.save();

    expect(updateApp).not.toHaveBeenCalled();
    expect(component.invalidEntries()).toEqual(['not-an-address']);
    expect(text()).toContain('Entrées invalides : not-an-address');
  });

  it('shows the server field errors on failure', () => {
    render();
    updateApp.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: {
              code: 'validation_error',
              detail: 'Validation error.',
              errors: { inbound_sender_allowlist: ['At most 200 entries are allowed.'] },
            },
          }),
      ),
    );

    component.save();
    fixture.detectChanges();

    expect(component.error()?.code).toBe('validation_error');
    expect(component.fieldErrors('inbound_sender_allowlist')).toEqual(['At most 200 entries are allowed.']);
    expect(text()).toContain('At most 200 entries are allowed.');
    expect(component.banner()).toBeNull();
  });

  it('falls back to safe defaults when the API omits the policy', () => {
    const legacy = makeApplication() as Partial<ApplicationRead>;
    delete legacy.inbound_sender_mode;
    delete legacy.inbound_rejection_notify_email;
    render(legacy as ApplicationRead);

    expect(component.mode()).toBe('owner');
    expect(component.notifyEmail()).toBe(true);
    expect(component.replyToSender()).toBe(false);
  });
});
