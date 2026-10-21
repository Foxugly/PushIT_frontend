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

  it('accepts @*.domain (domain + subdomains), with * only as the whole first label', () => {
    expect(isValidSenderEntry('@*.example.com')).toBe(true);
    expect(isValidSenderEntry('@*.mail.example.co.uk')).toBe(true);
    expect(isValidSenderEntry('@*.com')).toBe(false);
    expect(isValidSenderEntry('@*example.com')).toBe(false);
    expect(isValidSenderEntry('@mail.*.example.com')).toBe(false);
    expect(isValidSenderEntry('@**.example.com')).toBe(false);
    expect(isValidSenderEntry('*@example.com')).toBe(false);
    expect(isValidSenderEntry('alice@*.example.com')).toBe(false);
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

  it('explains the accepted list formats on a focusable info icon by each list', () => {
    render();
    const el = fixture.nativeElement as HTMLElement;
    for (const id of ['sender-allowlist-help', 'sender-blocklist-help']) {
      const icon = el.querySelector(`[data-testid="${id}"]`)!;
      expect(icon.getAttribute('tabindex')).toBe('0');
      const label = icon.getAttribute('aria-label') ?? '';
      expect(label).toContain('@*.exemple.com : le domaine et tous ses sous-domaines');
      expect(label).toContain('@exemple.com : tout le domaine exemple.com (sans les sous-domaines)');
    }
    expect(text()).toContain('@*.exemple.com');
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

  describe('unsaved state', () => {
    it('is pristine on load and dirty once edited, back to pristine when reverted', () => {
      render(makeApplication({ inbound_sender_blocklist: ['spam@x.org'] }));
      expect(component.dirty()).toBe(false);

      component.blocklistText.set('spam@x.org\nother@x.org');
      expect(component.dirty()).toBe(true);
      fixture.detectChanges();
      expect(text()).toContain('Modifications non enregistrées');

      // Same list once normalized: not a change.
      component.blocklistText.set(' SPAM@x.org \n');
      expect(component.dirty()).toBe(false);
    });

    it('keeps edits when the parent hands a new application while dirty', () => {
      render();
      component.mode.set('anyone');
      component.blocklistText.set('@spam.io');

      fixture.componentRef.setInput('app', makeApplication({ name: 'Renamed', inbound_sender_mode: 'owner' }));
      fixture.detectChanges();

      expect(component.mode()).toBe('anyone');
      expect(component.blocklistText()).toBe('@spam.io');
      expect(component.dirty()).toBe(true);
    });

    it('follows a new application while pristine', () => {
      render();
      fixture.componentRef.setInput('app', makeApplication({ inbound_sender_blocklist: ['@spam.io'] }));
      fixture.detectChanges();

      expect(component.blocklistText()).toBe('@spam.io');
      expect(component.dirty()).toBe(false);
    });

    it('is pristine again after its own successful save', () => {
      render();
      const updated = makeApplication({ inbound_sender_mode: 'anyone' });
      updateApp.mockReturnValue(of(updated));
      component.mode.set('anyone');
      expect(component.dirty()).toBe(true);

      component.save();

      expect(component.dirty()).toBe(false);
      expect(component.mode()).toBe('anyone');
    });

    it('stays dirty when the save fails', () => {
      render();
      updateApp.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      component.mode.set('anyone');

      component.save();

      expect(component.dirty()).toBe(true);
    });
  });
});
