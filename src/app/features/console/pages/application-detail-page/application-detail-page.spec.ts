import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import {
  makeApplication,
  makeDevice,
  makeNotification,
} from '../../../../../testing/console-fixtures';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { ApplicationDetailPage } from './application-detail-page';

describe('ApplicationDetailPage', () => {
  let fixture: ComponentFixture<ApplicationDetailPage>;
  let component: ApplicationDetailPage;
  let api: jasmine.SpyObj<PushitApiService>;
  let shell: {
    apps: ReturnType<typeof signal<ReturnType<typeof makeApplication>[]>>;
    loadShell: jasmine.Spy<(preferredAppId?: number) => void>;
  };
  let routeStub: {
    snapshot: {
      paramMap: ReturnType<typeof convertToParamMap>;
    };
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj<PushitApiService>('PushitApiService', [
      'getApp',
      'listDevices',
      'listNotifications',
      'listFutureNotifications',
      'listAppQuietPeriods',
      'updateApp',
    ]);
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
    };

    routeStub = {
      snapshot: {
        paramMap: convertToParamMap({ appId: '101' }),
      },
    };

    const consoleCopy = {
      current: signal({
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
          errors: { invalidId: 'ID application invalide.' },
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
        { provide: ActivatedRoute, useValue: routeStub },
        { provide: PushitApiService, useValue: api },
        { provide: ConsoleShellService, useValue: shell },
        { provide: ConsoleCopyService, useValue: consoleCopy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ApplicationDetailPage);
    component = fixture.componentInstance;
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

  it('updates the application and refreshes the console shell', () => {
    fixture.detectChanges();
    component.openEditModal();
    component.editForm.patchValue({
      name: 'PushIT Mobile V2',
    });

    component.saveApplication();

    expect(api.updateApp).toHaveBeenCalledWith(101, {
      name: 'PushIT Mobile V2',
      description: 'Application mobile',
    });
    expect(component.application()?.name).toBe('PushIT Mobile V2');
    expect(shell.loadShell).toHaveBeenCalledWith(101);
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
});
