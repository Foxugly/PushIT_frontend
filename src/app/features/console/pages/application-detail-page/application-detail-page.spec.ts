import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap, ParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
import { vi } from 'vitest';

import frCatalog from '../../../../../../public/i18n/fr.json';

import {
  makeApplication,
  makeDevice,
  makeNotification,
} from '../../../../../testing/console-fixtures';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { AppConfirmService } from '../../../../shared/app-confirm-dialog/app-confirm.service';
import { ApplicationDetailPage, normalizeAppDetailTab } from './application-detail-page';
import { InboundSenderPolicyPanel } from '../../components/inbound-sender-policy-panel/inbound-sender-policy-panel';
import { By } from '@angular/platform-browser';
import { provideTestCatalogs } from '../../../../../testing/catalog-store.testing';

/** Overlay the spec's short copy on the real FR catalog, so keys the spec does
 * not care about (tab labels, settings, danger zone...) still resolve. */
function deepMerge<T>(base: T, overlay: unknown): T {
  if (typeof overlay !== 'object' || overlay === null || Array.isArray(overlay)) {
    return overlay as T;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(overlay)) {
    out[key] = deepMerge(out[key], value);
  }
  return out as T;
}

describe('normalizeAppDetailTab', () => {
  it('keeps known tabs and falls back to overview', () => {
    expect(normalizeAppDetailTab('email')).toBe('email');
    expect(normalizeAppDetailTab('api')).toBe('api');
    expect(normalizeAppDetailTab('quiet-periods')).toBe('quiet-periods');
    expect(normalizeAppDetailTab('nope')).toBe('overview');
    expect(normalizeAppDetailTab(null)).toBe('overview');
    expect(normalizeAppDetailTab(undefined)).toBe('overview');
  });

  it('maps the former « Envoi » tab to the E-mail tab (old links keep working)', () => {
    expect(normalizeAppDetailTab('sending')).toBe('email');
    // Only own keys: an inherited property name is not a legacy tab.
    expect(normalizeAppDetailTab('toString')).toBe('overview');
  });
});

describe('ApplicationDetailPage', () => {
  let fixture: ComponentFixture<ApplicationDetailPage>;
  let component: ApplicationDetailPage;
  let api: jasmine.SpyObj<PushitApiService>;
  let shell: {
    apps: ReturnType<typeof signal<ReturnType<typeof makeApplication>[]>>;
    loadShell: jasmine.Spy<(preferredAppId?: number) => void>;
    toggleAppState: ReturnType<typeof vi.fn>;
    regenerateToken: ReturnType<typeof vi.fn>;
    revokeToken: ReturnType<typeof vi.fn>;
    lastGeneratedToken: ReturnType<
      typeof signal<{ appId: number; token: string; prefix: string } | null>
    >;
  };
  let routeStub: {
    snapshot: {
      paramMap: ReturnType<typeof convertToParamMap>;
    };
    queryParamMap: BehaviorSubject<ParamMap>;
  };
  let router: Router;
  let messages: { add: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    api = jasmine.createSpyObj<PushitApiService>('PushitApiService', [
      'getApp',
      'listDevices',
      'listNotifications',
      'listFutureNotifications',
      'listAppQuietPeriods',
      'updateApp',
      'uploadAppLogo',
      'deleteAppLogo',
      'regenerateAppEmail',
      'getAliasStatus',
      'getInboundEmailLogs',
      'evictDeviceFromApp',
      'getEnrolmentQrCode',
      'rotateEnrolmentCode',
      'listSendTokens',
      'deleteApp',
      'sendNotificationNow',
    ]);
    api.evictDeviceFromApp.and.returnValue(of(void 0));
    api.getEnrolmentQrCode.and.returnValue(of(new Blob(['qr'], { type: 'image/png' })));
    api.listSendTokens.and.returnValue(of([]));
    api.getInboundEmailLogs.and.returnValue(of([]));
    api.getApp.and.returnValue(of(makeApplication()));
    api.listDevices.and.returnValue(
      of([
        makeDevice({ id: 201, application_ids: [101] }),
        makeDevice({ id: 202, application_ids: [102] }),
      ]),
    );
    api.listNotifications.and.returnValue(of([makeNotification({ application_id: 101 })]));
    api.listFutureNotifications.and.returnValue(
      of([
        makeNotification({
          id: 302,
          application_id: 101,
          status: 'scheduled',
          scheduled_for: '2026-03-28T20:00:00Z',
          effective_scheduled_for: '2026-03-28T20:00:00Z',
        }),
      ]),
    );
    api.listAppQuietPeriods.and.returnValue(of([]));
    api.updateApp.and.returnValue(of(makeApplication({ name: 'PushIT Mobile V2' })));

    shell = {
      apps: signal([makeApplication(), makeApplication({ id: 102, name: 'Backoffice' })]),
      loadShell: jasmine.createSpy('loadShell'),
      toggleAppState: vi.fn(),
      regenerateToken: vi.fn(),
      revokeToken: vi.fn(),
      lastGeneratedToken: signal<{ appId: number; token: string; prefix: string } | null>(null),
    };

    routeStub = {
      snapshot: {
        paramMap: convertToParamMap({ appId: '101' }),
      },
      queryParamMap: new BehaviorSubject<ParamMap>(convertToParamMap({})),
    };

    messages = { add: vi.fn() };

    const consoleCopy = {
      current: signal(deepMerge(frCatalog.console, {
        applications: {
          qr: {
            title: 'QR code du token',
            scanHint: 'Scannez ce QR.',
            downloadQr: 'Telecharger le QR',
            downloadToken: 'Telecharger le token',
            copyToken: 'Copier le token',
            copied: 'Token copie.',
            copyFailed: 'Copie impossible.',
            saveNotice: 'Token affiche une seule fois.',
            error: 'QR impossible.',
            loading: 'Generation...',
          },
          alerts: {
            created: 'Application creee. Ouvrez le QR code pour voir le token.',
          },
        },
        enrolment: {
          intro: 'Ce code circule.',
          copy: 'Copier le code',
          copied: 'Code copie.',
          copyFailed: 'Copie impossible.',
          qrAlt: 'QR du code',
          qrLoading: 'Generation...',
          qrError: 'QR impossible.',
          scanHint: 'Faites scanner ce QR.',
          downloadQr: 'Telecharger le QR',
          rotate: 'Nouveau code',
          rotatePending: 'Generation...',
          rotateWarning: 'Un nouveau code ne retire personne.',
          rotateConfirm: 'Nouveau code pour {name} ?',
          rotated: 'Nouveau code genere.',
          rotateError: 'Generation impossible.',
        },
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
        codeExamples: {
          intro: 'Envoyer depuis votre code.',
          envNotice: 'Le jeton vient de PUSHIT_TOKEN.',
          copy: 'Copier',
          copied: 'Copie',
        },
        applicationDetail: {
          back: 'Retour',
          enrolmentTitle: 'Enrolement',
          sendTokensTitle: 'Jetons d emission',
          examplesTitle: 'Exemples',
          legacyWarning: 'Cette application emet encore avec l ancien jeton.',
          eyebrow: 'Application',
          fallbackTitle: 'Application',
          editTooltip: 'Editer',
          loading: 'Chargement...',
          descriptionTitle: 'Description',
          descriptionEmpty: 'Aucune description',
          inboundEmailTitle: 'Adresse email',
          inboundEmailLabel: 'Adresse',
          inboundEmailCopy: 'Copier',
          inboundEmailCopied: 'Adresse copiee.',
          inboundEmailCopyFailed: 'Copie impossible.',
          inboundEmailHelpTitle: 'Email',
          inboundEmailHelp: {
            intro: 'Envoyez un email.',
            subject: 'Sujet',
            body: 'Corps',
            schedule: 'Planification',
            sender: 'Expediteur',
          },
          devicesTitle: 'Devices',
          devicesEmpty: 'Aucun device',
          evict: {
            button: 'Retirer',
            hint: 'Retirer ne suffit pas : changez aussi le code.',
            confirm: 'Retirer {device} de {name} ?',
            success: 'Terminal retire.',
            error: 'Retrait impossible.',
          },
          notificationsTitle: 'Notifications',
          notificationsEmpty: 'Aucune notification',
          quietPeriodsTitle: 'Periodes blanches',
          quietPeriodsEmpty: 'Aucune periode',
          statusTitle: 'Statut',
          actions: { view: 'Voir' },
          table: {
            name: 'Nom',
            platform: 'Plateforme',
            pushStatus: 'Push',
            lastActivity: 'Activite',
            actions: 'Actions',
            title: 'Titre',
            type: 'Type',
            status: 'Statut',
            effective: 'Effectif',
          },
          notificationTypes: {
            future: 'Future',
            history: 'Historique',
          },
          dialog: {
            title: 'Modifier',
            save: 'Enregistrer',
            saving: 'Enregistrement...',
          },
          logo: { label: 'Logo', none: 'Aucun logo', remove: 'Supprimer le logo', updated: 'Logo mis a jour.', removed: 'Logo supprime.', choose: 'Choisir une image', hint: 'Glissez une image ici.' },
          regenerateEmail: {
            label: 'Adresse email',
            button: 'Regenerer',
            pending: 'Regeneration...',
            hint: 'Nouvelle adresse.',
            confirm: 'Regenerer {name} ?',
            success: 'Nouvelle adresse generee.',
            error: 'Regeneration impossible.',
          },
          aliasStatus: {
            title: 'Verifier alias',
            button: 'Verifier',
            pending: 'Verification...',
            active: 'Alias actif',
            missing: 'Alias absent',
            missingHint: 'Regenerez ou contactez ops.',
            unavailable: 'Verification indisponible',
            unverifiable: 'Impossible de verifier',
            error: 'Verification impossible.',
          },
          errors: { invalidId: 'ID application invalide.', logo: 'Logo impossible.' },
          facts: {
            id: 'ID',
            name: 'Nom',
            tokenPrefix: 'Prefixe token',
            status: 'Statut',
            lastUsed: 'Derniere utilisation',
            revokedToken: 'Token revoque',
            createdAt: 'Creation',
          },
          statusLabels: {
            never: 'Jamais',
            no: 'Non',
            immediate: 'Immediate',
          },
        },
      })),
    };

    await TestBed.configureTestingModule({
      imports: [ApplicationDetailPage],
      providers: [provideTestCatalogs(), 
        provideRouter([]),
        provideNoopAnimations(),
        provideHttpClient(),
        { provide: ActivatedRoute, useValue: routeStub },
        { provide: PushitApiService, useValue: api },
        { provide: ConsoleShellService, useValue: shell },
        { provide: ConsoleCopyService, useValue: consoleCopy },
        { provide: AppConfirmService, useValue: { ask: () => Promise.resolve(true) } },
        { provide: MessageService, useValue: messages },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ApplicationDetailPage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  it('loads application-related resources on init', () => {
    fixture.detectChanges();

    expect(api.getApp).toHaveBeenCalledWith(101);
    expect(component.application()?.id).toBe(101);
    expect(component.devices().map((device) => device.id)).toEqual([201]);
    expect(component.notifications().length).toBe(1);
    expect(component.futureNotifications().length).toBe(1);
  });

  it('reports an error for an invalid application id', () => {
    routeStub.snapshot.paramMap = convertToParamMap({ appId: 'nope' });

    fixture.detectChanges();

    expect(component.error()?.detail).toBe('ID application invalide.');
    expect(api.getApp).not.toHaveBeenCalled();
  });

  it('reveals the one-time token after create (regression: token must stay reachable)', () => {
    // Simulate the post-create state: the shell holds the freshly-minted token
    // for this app and the form page has navigated here.
    shell.lastGeneratedToken.set({ appId: 101, token: 'apt_freshsecret123', prefix: 'apt_fresh' });

    fixture.detectChanges();

    // The token is reachable via the reveal gate...
    expect(component.revealToken()).toBe('apt_freshsecret123');

    // ...and the reveal surface shows the raw token (no send-token QR any more).
    const reveal = fixture.nativeElement.querySelector('app-token-reveal');
    expect(reveal).not.toBeNull();
    expect(reveal.textContent).toContain('apt_freshsecret123');

    // The created guidance is shown so the user knows to copy/download it now.
    expect(fixture.nativeElement.textContent).toContain(
      'Application creee. Ouvrez le QR code pour voir le token.',
    );
  });

  it('does not reveal a token for an unrelated app', () => {
    shell.lastGeneratedToken.set({ appId: 999, token: 'apt_other', prefix: 'apt_o' });

    fixture.detectChanges();

    expect(component.revealToken()).toBeNull();
    expect(fixture.nativeElement.querySelector('app-token-reveal')).toBeNull();
  });

  describe('tabs and the tab query param', () => {
    it('defaults to the overview', () => {
      fixture.detectChanges();

      expect(component.activeTab()).toBe('overview');
      expect(fixture.nativeElement.querySelectorAll('p-tab[data-testid^="app-tab-"]').length).toBe(6);
    });

    it('opens the tab named in the query param', () => {
      routeStub.queryParamMap.next(convertToParamMap({ tab: 'quiet-periods' }));
      fixture.detectChanges();

      expect(component.activeTab()).toBe('quiet-periods');
    });

    it('falls back to the overview for an unknown tab', () => {
      routeStub.queryParamMap.next(convertToParamMap({ tab: 'bogus' }));
      fixture.detectChanges();

      expect(component.activeTab()).toBe('overview');
    });

    it('follows later query param changes (links, back/forward)', () => {
      fixture.detectChanges();

      routeStub.queryParamMap.next(convertToParamMap({ tab: 'notifications' }));

      expect(component.activeTab()).toBe('notifications');
    });

    it('writes the selected tab to the URL, and drops it for the overview', () => {
      fixture.detectChanges();

      component.selectTab('recipients');
      expect(component.activeTab()).toBe('recipients');
      expect(router.navigate).toHaveBeenLastCalledWith(
        [],
        expect.objectContaining({ queryParams: { tab: 'recipients' }, replaceUrl: true }),
      );

      component.selectTab('overview');
      expect(router.navigate).toHaveBeenLastCalledWith([], expect.objectContaining({ queryParams: { tab: null } }));
    });

    it('does not navigate when the tab is already active', () => {
      fixture.detectChanges();

      component.selectTab('overview');

      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('opens the API tab when a token was just minted for this app and no tab is given', () => {
      shell.lastGeneratedToken.set({ appId: 101, token: 'apt_freshsecret123', prefix: 'apt_fresh' });

      fixture.detectChanges();

      expect(component.activeTab()).toBe('api');
    });

    it('opens the E-mail tab for an old ?tab=sending link', () => {
      routeStub.queryParamMap.next(convertToParamMap({ tab: 'sending' }));
      fixture.detectChanges();

      expect(component.activeTab()).toBe('email');
    });

    it('an explicit tab wins over the token auto-open', () => {
      shell.lastGeneratedToken.set({ appId: 101, token: 'apt_freshsecret123', prefix: 'apt_fresh' });
      routeStub.queryParamMap.next(convertToParamMap({ tab: 'recipients' }));

      fixture.detectChanges();

      expect(component.activeTab()).toBe('recipients');
    });

    it('stays on the overview when the minted token belongs to another app', () => {
      shell.lastGeneratedToken.set({ appId: 999, token: 'apt_other', prefix: 'apt_o' });

      fixture.detectChanges();

      expect(component.activeTab()).toBe('overview');
    });
  });

  it('opens the notification create flow pre-selected on this app', () => {
    fixture.detectChanges();

    component.newNotification();

    expect(router.navigate).toHaveBeenCalledWith(['/dashboard/notifications'], {
      queryParams: { app: 101, create: 1 },
    });
  });

  it('opens the quiet-period create flow pre-selected on this app', () => {
    fixture.detectChanges();

    component.newQuietPeriod();

    expect(router.navigate).toHaveBeenCalledWith(['/dashboard/quiet-periods'], {
      queryParams: { app: 101, create: 1 },
    });
  });

  it('offers « Ajouter une période blanche » in the Périodes blanches tab', () => {
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="add-quiet-period"]');

    expect(button?.textContent).toContain('Ajouter une période blanche');
  });

  describe('overview « Prochaines étapes »', () => {
    it('replaces the facts table and the token tag with next steps', () => {
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('app-console-facts-table')).toBeNull();
      expect(el.querySelector('app-page-header')?.textContent).not.toContain('apt_12345678');
      const steps = el.querySelector('[data-testid="next-steps"]');
      expect(steps?.textContent).toContain('Prochaines étapes');
      expect(steps?.querySelector('[data-testid="next-step-email"]')?.textContent).toContain(
        makeApplication().inbound_email_address,
      );
    });

    it('the enrol step opens the Appareils (recipients) tab (enrolment QR)', () => {
      fixture.detectChanges();
      const button = (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="next-step-enrol"] button',
      ) as HTMLButtonElement;

      button.click();

      expect(component.activeTab()).toBe('recipients');
    });

    it('sends a test notification to every reachable subscribed device in one call', () => {
      api.listDevices.and.returnValue(
        of([
          makeDevice({ id: 201, application_ids: [101] }),
          makeDevice({ id: 203, application_ids: [101, 102] }),
          makeDevice({ id: 204, application_ids: [101], push_token_status: 'invalid' }),
          makeDevice({ id: 202, application_ids: [102] }),
        ]),
      );
      api.sendNotificationNow.and.returnValue(of(makeNotification({ id: 900, application_id: 101 })));
      fixture.detectChanges();
      expect(component.testBlockedReason()).toBeNull();

      component.sendTestNotification();

      expect(api.sendNotificationNow).toHaveBeenCalledOnceWith({
        application_id: 101,
        device_ids: [201, 203],
        title: 'Notification de test',
        message: expect.stringContaining('PushIT Mobile'),
      });
      expect(messages.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'success',
          detail: 'Notification de test envoyée à 2 appareil(s).',
        }),
      );
      // The counters / notification list are refreshed.
      expect(api.listNotifications).toHaveBeenCalledTimes(2);
      expect(component.testSending()).toBe(false);
    });

    it('is disabled, with the reason, while no subscribed device can receive it', () => {
      api.listDevices.and.returnValue(
        of([makeDevice({ id: 204, application_ids: [101], push_token_status: 'invalid' })]),
      );
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;

      expect(component.testBlockedReason()).toContain('Aucun appareil abonné');
      expect(el.querySelector('[data-testid="test-notification-hint"]')?.textContent).toContain(
        'Aucun appareil abonné',
      );
      expect(
        (el.querySelector('[data-testid="send-test-notification"] button') as HTMLButtonElement).disabled,
      ).toBe(true);

      component.sendTestNotification();
      expect(api.sendNotificationNow).not.toHaveBeenCalled();
    });

    it('is disabled on a deactivated application', () => {
      api.getApp.and.returnValue(of(makeApplication({ is_active: false })));
      fixture.detectChanges();

      expect(component.testBlockedReason()).toContain('désactivée');
    });

    it('keeps a refusal on the card and shows no success toast', () => {
      api.sendNotificationNow.and.returnValue(
        throwError(() => ({ error: { code: 'subscription_required', detail: 'Abonnement requis.' }, status: 402 })),
      );
      fixture.detectChanges();

      component.sendTestNotification();
      fixture.detectChanges();

      expect(component.testError()).not.toBeNull();
      expect(messages.add).not.toHaveBeenCalled();
      expect(component.testSending()).toBe(false);
    });
  });

  describe('overview editing (former settings tab)', () => {
    it('prefills the form and saves name/description inline', () => {
      fixture.detectChanges();
      expect(component.settingsForm.getRawValue()).toEqual({
        name: 'PushIT Mobile',
        description: 'Application mobile',
      });

      component.settingsForm.patchValue({ name: 'PushIT Mobile V2' });
      component.settingsForm.markAsDirty();
      component.saveSettings();

      expect(api.updateApp).toHaveBeenCalledWith(101, {
        name: 'PushIT Mobile V2',
        description: 'Application mobile',
      });
      expect(component.application()?.name).toBe('PushIT Mobile V2');
      expect(component.settingsForm.dirty).toBe(false);
      expect(shell.loadShell).toHaveBeenCalledWith(101);
    });

    it('does not save an invalid form', () => {
      fixture.detectChanges();
      component.settingsForm.patchValue({ name: '' });

      component.saveSettings();

      expect(api.updateApp).not.toHaveBeenCalled();
    });

    it('toggles the activation through the shell', () => {
      shell.toggleAppState.mockImplementation((_app: unknown, onDone?: () => void) => onDone?.());
      fixture.detectChanges();

      component.toggleState();

      expect(shell.toggleAppState).toHaveBeenCalled();
      expect(component.application()?.is_active).toBe(false);
    });

    it('uploads and removes the logo', () => {
      api.uploadAppLogo.and.returnValue(of(makeApplication({ logo: 'https://cdn/logo.png' })));
      api.deleteAppLogo.and.returnValue(of(void 0));
      fixture.detectChanges();

      component.onLogoCropped(new File(['x'], 'logo.png', { type: 'image/png' }));
      expect(component.application()?.logo).toBe('https://cdn/logo.png');

      component.removeLogo();
      expect(api.deleteAppLogo).toHaveBeenCalledWith(101);
      expect(component.application()?.logo).toBeNull();
    });

    it('deletes the application after confirmation and returns to the list', async () => {
      api.deleteApp.and.returnValue(of(void 0));
      fixture.detectChanges();

      await component.deleteApplication();

      expect(api.deleteApp).toHaveBeenCalledWith(101);
      expect(shell.loadShell).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/applications']);
    });

    it('keeps the application when the deletion is declined', async () => {
      fixture.detectChanges();
      vi.spyOn(TestBed.inject(AppConfirmService), 'ask').mockResolvedValue(false);

      await component.deleteApplication();

      expect(api.deleteApp).not.toHaveBeenCalled();
    });
  });

  it('regenerates and revokes the legacy token from the API tab', async () => {
    shell.regenerateToken.mockImplementation((_app: unknown, onDone?: () => void) => onDone?.());
    shell.revokeToken.mockImplementation((_app: unknown, onDone?: () => void) => onDone?.());
    fixture.detectChanges();

    await component.regenerateLegacyToken();
    expect(shell.regenerateToken).toHaveBeenCalled();
    expect(component.bannerTone()).toBe('success');

    await component.revokeLegacyToken();
    expect(shell.revokeToken).toHaveBeenCalled();
    // Each action reloads the application (initial load + 2).
    expect(api.getApp).toHaveBeenCalledTimes(3);
  });

  it('copies the inbound email address and shows a success banner', async () => {
    fixture.detectChanges();
    const clipboard = jasmine.createSpyObj<Clipboard>('Clipboard', ['writeText']);
    clipboard.writeText.and.resolveTo();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: clipboard,
    });

    await component.copyInboundEmail('apt_fc4471fe12345678@pushit.com');

    expect(clipboard.writeText).toHaveBeenCalledWith('apt_fc4471fe12345678@pushit.com');
    expect(component.banner()).toBe('Adresse copiee.');
    expect(component.bannerTone()).toBe('success');
  });

  it('regenerates the inbound email address and shows a success banner', async () => {
    fixture.detectChanges();
    api.regenerateAppEmail.and.returnValue(
      of({
        app_id: 101,
        inbound_email_alias: 'app_pushit_abcd1234',
        inbound_email_address: 'app_pushit_abcd1234@pushit.com',
      }),
    );

    await component.regenerateInboundEmail();

    expect(api.regenerateAppEmail).toHaveBeenCalledWith(101);
    expect(component.application()?.inbound_email_address).toBe('app_pushit_abcd1234@pushit.com');
    expect(component.application()?.inbound_email_alias).toBe('app_pushit_abcd1234');
    expect(component.banner()).toBe('Nouvelle adresse generee.');
    expect(component.bannerTone()).toBe('success');
    expect(shell.loadShell).toHaveBeenCalledWith(101);
  });

  it('evicts a subscriber and drops it from the list', async () => {
    fixture.detectChanges();
    expect(component.devices().map((device) => device.id)).toEqual([201]);

    await component.evictDevice(component.devices()[0]);

    expect(api.evictDeviceFromApp).toHaveBeenCalledWith(101, 201);
    expect(component.devices()).toEqual([]);
    expect(component.banner()).toBe('Terminal retire.');
    expect(component.bannerTone()).toBe('success');
  });

  it('keeps the subscriber when the confirmation is declined', async () => {
    fixture.detectChanges();
    const confirmService = TestBed.inject(AppConfirmService);
    spyOn(confirmService, 'ask').and.resolveTo(false);

    await component.evictDevice(component.devices()[0]);

    expect(api.evictDeviceFromApp).not.toHaveBeenCalled();
    expect(component.devices().length).toBe(1);
  });

  it('warns only while the application still sends with the legacy token', () => {
    fixture.detectChanges();
    expect(component.stillSendsWithLegacyToken()).toBeFalse();
    expect(fixture.nativeElement.textContent).not.toContain(
      "Cette application emet encore avec l ancien jeton.",
    );

    component.application.set(
      makeApplication({ legacy_send_last_used_at: '2026-07-29T10:00:00Z' }),
    );
    fixture.detectChanges();

    expect(component.stillSendsWithLegacyToken()).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain(
      "Cette application emet encore avec l ancien jeton.",
    );
  });

  it('keeps the displayed enrolment code in sync after a rotation', () => {
    fixture.detectChanges();

    component.onEnrolmentCodeRotated('apk_Zz99Yy88Xx77');

    expect(component.application()?.enrolment_code).toBe('apk_Zz99Yy88Xx77');
    expect(component.application()?.enrolment_code_rotated_at).not.toBeNull();
  });

  it('shows an active alias when provisioned is true', () => {
    fixture.detectChanges();
    api.getAliasStatus.and.returnValue(
      of({ alias: 'apt_x', configured: true, provisioned: true, detail: 'ok' }),
    );

    component.verifyAlias();

    expect(api.getAliasStatus).toHaveBeenCalledWith(101);
    expect(component.aliasStatusView()?.severity).toBe('success');
    expect(component.aliasStatusView()?.label).toBe('Alias actif');
  });

  it('flags a missing alias when provisioned is false', () => {
    fixture.detectChanges();
    api.getAliasStatus.and.returnValue(
      of({ alias: 'apt_x', configured: true, provisioned: false, detail: 'absent' }),
    );

    component.verifyAlias();

    expect(component.aliasStatusView()?.severity).toBe('danger');
    expect(component.aliasStatusView()?.hint).toBe('Regenerez ou contactez ops.');
  });

  it('reports unavailable when Exchange is not configured', () => {
    fixture.detectChanges();
    api.getAliasStatus.and.returnValue(
      of({ alias: 'apt_x', configured: false, provisioned: null, detail: '' }),
    );

    component.verifyAlias();

    expect(component.aliasStatusView()?.severity).toBe('secondary');
    expect(component.aliasStatusView()?.label).toBe('Verification indisponible');
  });

  it('warns when the alias cannot be verified despite being configured', () => {
    fixture.detectChanges();
    api.getAliasStatus.and.returnValue(
      of({ alias: 'apt_x', configured: true, provisioned: null, detail: 'timeout' }),
    );

    component.verifyAlias();

    expect(component.aliasStatusView()?.severity).toBe('warn');
    expect(component.aliasStatusView()?.hint).toBe('timeout');
  });

  it('hosts the inbound sender policy in the E-mail tab and adopts its save', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="inbound-sender-policy"]')).not.toBeNull();

    const updated = makeApplication({ inbound_sender_mode: 'anyone', inbound_sender_blocklist: ['@spam.io'] });
    component.onSenderPolicySaved(updated);

    expect(component.application()?.inbound_sender_mode).toBe('anyone');
    expect(component.application()?.inbound_sender_blocklist).toEqual(['@spam.io']);
  });

  it('loads the inbound e-mail journal only once the E-mail tab is shown', () => {
    fixture.detectChanges();
    expect(api.getInboundEmailLogs).not.toHaveBeenCalled();

    routeStub.queryParamMap.next(convertToParamMap({ tab: 'api' }));
    fixture.detectChanges();
    expect(api.getInboundEmailLogs).not.toHaveBeenCalled();

    routeStub.queryParamMap.next(convertToParamMap({ tab: 'email' }));
    fixture.detectChanges();
    expect(api.getInboundEmailLogs).toHaveBeenCalledOnceWith(101);

    // Leaving and coming back does not reload it (« Actualiser » does).
    routeStub.queryParamMap.next(convertToParamMap({ tab: 'overview' }));
    fixture.detectChanges();
    routeStub.queryParamMap.next(convertToParamMap({ tab: 'email' }));
    fixture.detectChanges();
    expect(api.getInboundEmailLogs).toHaveBeenCalledTimes(1);
  });

  describe('unsaved changes', () => {
    function policyPanel(): InboundSenderPolicyPanel {
      const debug = fixture.debugElement.query(By.directive(InboundSenderPolicyPanel));
      return debug.componentInstance as InboundSenderPolicyPanel;
    }

    it('saving the overview keeps the dirty sender-policy form (regression)', () => {
      fixture.detectChanges();
      const panel = policyPanel();
      panel.blocklistText.set('spam@x.org');
      panel.mode.set('anyone');
      fixture.detectChanges();
      expect(panel.dirty()).toBe(true);
      expect(component.hasUnsavedChanges()).toBe(true);

      component.settingsForm.patchValue({ name: 'PushIT Mobile V2' });
      component.settingsForm.markAsDirty();
      component.saveSettings();
      fixture.detectChanges();

      expect(component.application()?.name).toBe('PushIT Mobile V2');
      expect(component.settingsForm.dirty).toBe(false);
      expect(panel.mode()).toBe('anyone');
      expect(panel.blocklistText()).toBe('spam@x.org');
      expect(panel.dirty()).toBe(true);
      expect(component.hasUnsavedChanges()).toBe(true);
    });

    it('a toggle (application reload) keeps the dirty sender-policy form', () => {
      shell.toggleAppState.mockImplementation((_app: unknown, onDone?: () => void) => onDone?.());
      fixture.detectChanges();
      const panel = policyPanel();
      panel.allowlistText.set('ally@partner.io');
      fixture.detectChanges();

      component.toggleState();
      fixture.detectChanges();

      expect(component.application()?.is_active).toBe(false);
      expect(panel.allowlistText()).toBe('ally@partner.io');
    });

    it('a pristine sender-policy form follows the reloaded application', () => {
      fixture.detectChanges();
      const panel = policyPanel();

      component.onSenderPolicySaved(makeApplication({ inbound_sender_blocklist: ['@spam.io'] }));
      fixture.detectChanges();

      expect(panel.blocklistText()).toBe('@spam.io');
      expect(panel.dirty()).toBe(false);
    });

    it('saving the sender policy keeps the dirty overview form', () => {
      fixture.detectChanges();
      component.settingsForm.patchValue({ name: 'Brouillon' });
      component.settingsForm.markAsDirty();

      component.onSenderPolicySaved(makeApplication({ inbound_sender_mode: 'anyone' }));
      fixture.detectChanges();

      expect(component.settingsForm.getRawValue().name).toBe('Brouillon');
      expect(component.hasUnsavedChanges()).toBe(true);
    });

    it('shows a hint next to each dirty section', () => {
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('[data-testid="app-settings-unsaved"]')).toBeNull();
      expect(el.querySelector('[data-testid="sender-policy-unsaved"]')).toBeNull();

      component.settingsForm.markAsDirty();
      policyPanel().notifyPush.set(true);
      fixture.detectChanges();

      expect(el.querySelector('[data-testid="app-settings-unsaved"]')?.textContent).toContain(
        'Modifications non enregistrées',
      );
      expect(el.querySelector('[data-testid="sender-policy-unsaved"]')).not.toBeNull();
    });

    it('blocks beforeunload only while something is dirty', () => {
      fixture.detectChanges();
      const clean = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
      component.onBeforeUnload(clean);
      expect(clean.defaultPrevented).toBe(false);

      component.settingsForm.markAsDirty();
      const dirty = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
      component.onBeforeUnload(dirty);
      expect(dirty.defaultPrevented).toBe(true);
    });

    it('does not report unsaved changes once the application is deleted', async () => {
      api.deleteApp.and.returnValue(of(void 0));
      fixture.detectChanges();
      component.settingsForm.markAsDirty();

      await component.deleteApplication();

      expect(component.hasUnsavedChanges()).toBe(false);
    });
  });
});
