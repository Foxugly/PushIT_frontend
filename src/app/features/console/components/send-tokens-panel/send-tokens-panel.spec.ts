import { signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { makeApplication } from '../../../../../testing/console-fixtures';
import { SendToken } from '../../../../core/models/api.models';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { AppConfirmService } from '../../../../shared/app-confirm-dialog/app-confirm.service';
import { SendTokensPanel } from './send-tokens-panel';

function makeToken(overrides: Partial<SendToken> = {}): SendToken {
  return {
    id: 7,
    name: 'prod',
    prefix: 'apt_1234',
    created_at: '2026-07-01T10:00:00Z',
    last_used_at: null,
    revoked_at: null,
    is_active: true,
    ...overrides,
  };
}

describe('SendTokensPanel', () => {
  let fixture: ComponentFixture<SendTokensPanel>;
  let component: SendTokensPanel;
  let api: jasmine.SpyObj<PushitApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<PushitApiService>('PushitApiService', [
      'listSendTokens',
      'createSendToken',
      'revokeSendToken',
      'revealSendToken',
    ]);
    api.listSendTokens.and.returnValue(of([makeToken()]));
    api.revokeSendToken.and.returnValue(of(void 0));

    const consoleCopy = {
      current: signal({
        sendTokens: {
          intro: 'Un jeton d emission autorise l envoi.',
          loading: 'Chargement...',
          empty: 'Aucun jeton',
          nameLabel: 'Nom',
          namePlaceholder: 'prod',
          create: 'Creer',
          createPending: 'Creation...',
          createdNotice: 'Copiez ce jeton maintenant.',
          createdDone: 'J ai copie',
          table: { name: 'Nom', prefix: 'Prefixe', lastUsed: 'Dernier usage', status: 'Statut', actions: 'Actions' },
          activeLabel: 'actif',
          revokedLabel: 'revoque',
          never: 'Jamais',
          reveal: 'Revoir',
          revealHint: 'Re-saisissez votre mot de passe.',
          revealSubmit: 'Afficher',
          revealPending: 'Verification...',
          revealTtl: 'Masquage automatique.',
          passwordLabel: 'Mot de passe',
          passwordPlaceholder: 'Mot de passe',
          cancel: 'Annuler',
          hide: 'Masquer',
          revoke: 'Revoquer',
          revokeConfirm: 'Revoquer {name} ?',
          revokedBanner: 'Jeton revoque.',
        },
      }),
    };

    await TestBed.configureTestingModule({
      imports: [SendTokensPanel],
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        { provide: PushitApiService, useValue: api },
        { provide: ConsoleCopyService, useValue: consoleCopy },
        { provide: AppConfirmService, useValue: { ask: () => Promise.resolve(true) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SendTokensPanel);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('app', makeApplication());
    fixture.detectChanges();
  });

  it('lists the application tokens', () => {
    expect(api.listSendTokens).toHaveBeenCalledWith(101);
    expect(component.tokens().length).toBe(1);
  });

  it('shows a created token once, and only on creation', () => {
    api.createSendToken.and.returnValue(of({ ...makeToken({ id: 8, name: 'ci' }), token: 'apt_freshsecret1234567' }));
    component.newName.set('ci');

    component.create();

    expect(api.createSendToken).toHaveBeenCalledWith(101, 'ci');
    expect(component.createdToken()).toBe('apt_freshsecret1234567');
    // The list itself never carries the raw value.
    expect(JSON.stringify(component.tokens())).not.toContain('apt_freshsecret1234567');
  });

  it('hides a revealed token by itself', fakeAsync(() => {
    // A token left on screen ends up in a screenshot or a shared window.
    api.revealSendToken.and.returnValue(of({ token: 'apt_revealed1234567890' }));
    component.openReveal(makeToken());
    component.revealPassword.set('hunter2');

    component.reveal();
    expect(component.revealedToken()).toBe('apt_revealed1234567890');

    tick(20_000);
    expect(component.revealedToken()).toBeNull();
  }));

  it('forgets the typed password as soon as the reveal succeeds', () => {
    api.revealSendToken.and.returnValue(of({ token: 'apt_revealed1234567890' }));
    component.openReveal(makeToken());
    component.revealPassword.set('hunter2');

    component.reveal();

    expect(component.revealPassword()).toBe('');
  });

  it('surfaces a refused password instead of pretending', () => {
    api.revealSendToken.and.returnValue(
      throwError(() => ({ status: 403, error: { code: 'invalid_password', detail: 'Mot de passe incorrect.' } })),
    );
    component.openReveal(makeToken());
    component.revealPassword.set('mauvais');

    component.reveal();

    expect(component.revealedToken()).toBeNull();
    expect(component.revealError()).not.toBeNull();
  });

  it('marks a revoked token without dropping it from the list', async () => {
    // Keeping the row is what lets the owner see what was revoked, and when.
    await component.revoke(makeToken());

    expect(api.revokeSendToken).toHaveBeenCalledWith(101, 7);
    expect(component.tokens().length).toBe(1);
    expect(component.tokens()[0].is_active).toBeFalse();
  });
});
