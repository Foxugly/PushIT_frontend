import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { makeDevice, makeNotification } from '../../../../../testing/console-fixtures';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { NotificationDetailPage } from './notification-detail-page';

describe('NotificationDetailPage', () => {
  let fixture: ComponentFixture<NotificationDetailPage>;
  let component: NotificationDetailPage;
  let api: jasmine.SpyObj<PushitApiService>;
  let routeStub: {
    snapshot: {
      paramMap: ReturnType<typeof convertToParamMap>;
    };
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj<PushitApiService>('PushitApiService', [
      'getNotification',
      'getFutureNotification',
      'listDevices',
      'updateFutureNotification',
    ]);
    api.getNotification.and.returnValue(of(makeNotification({ id: 301, device_ids: [201, 202] })));
    api.getFutureNotification.and.returnValue(
      of(
        makeNotification({
          id: 301,
          status: 'scheduled',
          scheduled_for: '2026-03-28T20:00:00Z',
          effective_scheduled_for: '2026-03-28T20:00:00Z',
          device_ids: [201, 202],
        }),
      ),
    );
    api.listDevices.and.returnValue(
      of([
        makeDevice({ id: 201 }),
        makeDevice({ id: 202, device_name: 'Pixel QA', platform: 'android' }),
        makeDevice({ id: 203 }),
      ]),
    );
    api.updateFutureNotification.and.returnValue(
      of(
        makeNotification({
          id: 301,
          title: 'Promo mise a jour',
          status: 'scheduled',
          scheduled_for: '2026-03-29T09:00:00Z',
          effective_scheduled_for: '2026-03-29T09:00:00Z',
        }),
      ),
    );

    routeStub = {
      snapshot: {
        paramMap: convertToParamMap({ notificationId: '301' }),
      },
    };

    const consoleCopy = {
      current: signal({
        notificationDetail: {
          back: 'Retour',
          eyebrow: 'Notification',
          fallbackTitle: 'Notification',
          editTooltip: 'Editer',
          loading: 'Chargement...',
          messageTitle: 'Message',
          devicesTitle: 'Devices cibles',
          devicesEmpty: 'Aucun device',
          statusTitle: 'Statut',
          note: 'Note',
          actions: { view: 'Voir' },
          table: {
            name: 'Titre',
            platform: 'Plateforme',
            pushStatus: 'Push',
            lastActivity: 'Activite',
            actions: 'Actions',
          },
          dialog: {
            title: 'Modifier',
            message: 'Message',
            newDate: 'Nouvelle date',
            save: 'Enregistrer',
            saving: 'Enregistrement...',
          },
          errors: { invalidId: 'ID notification invalide.' },
          facts: {
            application: 'Application',
            status: 'Statut',
            future: 'Future',
            sentAt: 'Envoyee',
            createdAt: 'Creation',
            scheduledFor: 'Planifiee',
            effective: 'Effective',
            targetedDevices: 'Devices',
          },
          labels: {
            shifted: 'shifted',
            yes: 'Oui',
            no: 'Non',
            notYet: 'Pas encore',
            immediate: 'Immediate',
            scheduled: 'scheduled',
          },
        },
      }),
    };

    await TestBed.configureTestingModule({
      imports: [NotificationDetailPage],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: ActivatedRoute, useValue: routeStub },
        { provide: PushitApiService, useValue: api },
        { provide: ConsoleCopyService, useValue: consoleCopy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationDetailPage);
    component = fixture.componentInstance;
  });

  it('loads a future notification and resolves only targeted devices', () => {
    fixture.detectChanges();

    expect(api.getNotification).toHaveBeenCalledWith(301);
    expect(api.getFutureNotification).toHaveBeenCalledWith(301);
    expect(component.isFuture()).toBeTrue();
    expect(component.targetedDevices().map((device) => device.id)).toEqual([201, 202]);
  });

  it('falls back to the regular notification when the future endpoint is missing', () => {
    api.getFutureNotification.and.returnValue(throwError(() => new Error('missing')));

    fixture.detectChanges();

    expect(component.isFuture()).toBeFalse();
    expect(component.notification()?.status).toBe('draft');
  });

  it('updates a future notification from the detail modal', () => {
    fixture.detectChanges();
    component.openEditModal();
    const nextDate = new Date('2026-03-29T09:00:00Z');
    component.editForm.setValue({
      title: 'Promo mise a jour',
      message: 'Nouveau contenu',
      scheduled_for: nextDate,
    });

    component.saveNotification();

    expect(api.updateFutureNotification).toHaveBeenCalledWith(301, {
      title: 'Promo mise a jour',
      message: 'Nouveau contenu',
      scheduled_for: nextDate.toISOString(),
    });
    expect(component.notification()?.title).toBe('Promo mise a jour');
    expect(component.isEditModalOpen()).toBeFalse();
  });
});
