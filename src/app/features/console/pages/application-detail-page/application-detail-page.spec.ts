import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import {
  makeApplication,
  makeDevice,
  makeNotification,
} from '../../../../../testing/console-fixtures';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { AppConfirmService } from '../../../../shared/app-confirm-dialog/app-confirm.service';
import { ApplicationDetailPage } from './application-detail-page';

describe('ApplicationDetailPage', () => {
  let fixture: ComponentFixture<ApplicationDetailPage>;
  let component: ApplicationDetailPage;
  let api: jasmine.SpyObj<PushitApiService>;
  let shell: {
    apps: ReturnType<typeof signal<ReturnType<typeof makeApplication>[]>>;
    loadShell: jasmine.Spy<(preferredAppId?: number) => void>;
    lastGeneratedToken: ReturnType<
      typeof signal<{ appId: number; token: string; prefix: string } | null>
    >;
  };
  let routeStub: {
    snapshot: {
      paramMap: ReturnType<typeof convertToParamMap>;
    };
  };
  let router: Router;

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
      'getAppQrCode',
    ]);
    api.getAppQrCode.and.returnValue(of(new Blob(['qr'], { type: 'image/png' })));
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
      lastGeneratedToken: signal<{ appId: number; token: string; prefix: string } | null>(null),
    };

    routeStub = {
      snapshot: {
        paramMap: convertToParamMap({ appId: '101' }),
      },
    };

    const consoleCopy = {
      current: signal({
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
        applicationDetail: {
          back: 'Retour',
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
            active: 'active',
            inactive: 'inactive',
            never: 'Jamais',
            no: 'Non',
            immediate: 'Immediate',
            once: 'once',
            recurring: 'recurring',
          },
        },
      }),
    };

    await TestBed.configureTestingModule({
      imports: [ApplicationDetailPage],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        provideHttpClient(),
        { provide: ActivatedRoute, useValue: routeStub },
        { provide: PushitApiService, useValue: api },
        { provide: ConsoleShellService, useValue: shell },
        { provide: ConsoleCopyService, useValue: consoleCopy },
        { provide: AppConfirmService, useValue: { ask: () => Promise.resolve(true) } },
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

    // ...and the reveal surface is rendered with the QR request fired for it.
    const reveal = fixture.nativeElement.querySelector('app-token-reveal');
    expect(reveal).not.toBeNull();
    expect(api.getAppQrCode).toHaveBeenCalledWith(101, 'apt_freshsecret123');

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

  it('navigates to the dedicated edit page from the edit action', () => {
    fixture.detectChanges();

    component.openEdit();

    expect(router.navigate).toHaveBeenCalledWith(['/dashboard/applications', 101, 'edit']);
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
});
