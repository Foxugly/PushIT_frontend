import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import {
  makeApplication,
  makeDevice,
  makeNotification,
  makeNotificationStat,
} from '../../../../../testing/console-fixtures';
import { DeviceRead, NotificationRead } from '../../../../core/models/api.models';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { NotificationsPage } from './notifications-page';

describe('NotificationsPage', () => {
  let fixture: ComponentFixture<NotificationsPage>;
  let component: NotificationsPage;
  let api: jasmine.SpyObj<PushitApiService>;
  let router: Router;
  let shell: {
    apps: ReturnType<typeof signal<ReturnType<typeof makeApplication>[]>>;
    selectedAppId: ReturnType<typeof signal<number | null>>;
    setNotificationsCount: jasmine.Spy<(count: number) => void>;
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj<PushitApiService>('PushitApiService', [
      'listDevices',
      'listNotifications',
      'listFutureNotifications',
      'listNotificationStats',
      'createNotification',
      'updateFutureNotification',
      'deleteFutureNotification',
      'sendNotification',
    ]);

    api.listDevices.and.returnValue(
      of<DeviceRead[]>([
        makeDevice({ id: 201, application_ids: [101], push_token_status: 'active' }),
        makeDevice({ id: 202, application_ids: [102], push_token_status: 'active' }),
        makeDevice({ id: 203, application_ids: [101], push_token_status: 'invalid' }),
      ]),
    );
    api.listNotifications.and.returnValue(
      of<NotificationRead[]>([
        makeNotification({ id: 301, status: 'draft', scheduled_for: null }),
      ]),
    );
    api.listFutureNotifications.and.returnValue(
      of<NotificationRead[]>([
        makeNotification({
          id: 302,
          status: 'scheduled',
          scheduled_for: '2026-03-28T20:00:00Z',
          effective_scheduled_for: '2026-03-28T20:00:00Z',
        }),
      ]),
    );
    api.listNotificationStats.and.returnValue(
      of([
        makeNotificationStat('draft', 1),
        makeNotificationStat('scheduled', 1),
      ]),
    );
    api.createNotification.and.returnValue(
      of(
        makeNotification({
          id: 303,
          title: 'Nouvelle promo',
          scheduled_for: '2026-03-28T20:00:00Z',
          effective_scheduled_for: '2026-03-28T20:00:00Z',
        }),
      ),
    );
    api.updateFutureNotification.and.returnValue(
      of(
        makeNotification({
          id: 302,
          title: 'Maj notif',
          status: 'scheduled',
          scheduled_for: '2026-03-29T10:00:00Z',
          effective_scheduled_for: '2026-03-29T10:00:00Z',
        }),
      ),
    );
    api.deleteFutureNotification.and.returnValue(of(void 0));
    api.sendNotification.and.returnValue(of({ status: 'queued', notification_id: 301, task_id: 'task-1' }));

    shell = {
      apps: signal([makeApplication(), makeApplication({ id: 102, name: 'Backoffice' })]),
      selectedAppId: signal<number | null>(101),
      setNotificationsCount: jasmine.createSpy('setNotificationsCount'),
    };

    const consoleCopy = {
      current: signal({
        notifications: {
          title: 'Notifications',
          history: 'Historique',
          future: 'Futures',
          shifted: 'Decalees',
          refresh: 'Rafraichir',
          add: 'Ajouter',
          loading: 'Chargement...',
          empty: 'Aucune notification.',
          immediate: 'Immediate',
          scheduledSubtext: 'Notification planifiee',
          filters: {
            application: 'Application',
            allApps: 'Toutes',
            status: 'Statut',
            allStatuses: 'Tous',
            from: 'A partir de',
            to: 'Jusqu a',
            apply: 'Appliquer',
            reset: 'Reinitialiser',
          },
          table: {
            name: 'Titre',
            application: 'Application',
            message: 'Message',
            status: 'Statut',
            effective: 'Effectif',
            actions: 'Actions',
          },
          dialog: {
            createTitle: 'Creer une notification',
            editTitle: 'Modifier une notification',
            create: 'Creer',
            creating: 'Creation...',
            save: 'Enregistrer',
            saving: 'Enregistrement...',
          },
          form: {
            application: 'Application',
            applicationPlaceholder: 'Choisir...',
            devices: 'Devices cibles',
            devicesHelp: 'Selectionnez un ou plusieurs devices.',
            devicesPlaceholder: 'Choisir...',
            title: 'Titre',
            titlePlaceholder: 'Promo flash',
            message: 'Message',
            messagePlaceholder: 'Contenu',
            schedule: 'Planifier',
            newDate: 'Nouvelle date',
          },
          actions: {
            view: 'Voir',
            send: 'Envoyer',
            edit: 'Editer',
            delete: 'Supprimer',
          },
          alerts: {
            createdImmediate: 'Notification immediate creee.',
            createdScheduled: 'Notification planifiee creee.',
            updated: 'Notification future mise a jour.',
            deleted: 'Notification {title} supprimee.',
            queued: 'Notification {notificationId} en file ({taskId}).',
          },
          confirmDelete: 'Supprimer {title} ?',
          statusLabels: {
            draft: 'draft',
            scheduled: 'scheduled',
            queued: 'queued',
            processing: 'processing',
            sent: 'sent',
            partial: 'partial',
            failed: 'failed',
            no_target: 'no_target',
            shifted: 'shifted',
          },
          typeLabels: {
            future: 'Future',
            history: 'Historique',
          },
        },
      }),
    };

    await TestBed.configureTestingModule({
      imports: [NotificationsPage],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: PushitApiService, useValue: api },
        { provide: ConsoleShellService, useValue: shell },
        { provide: ConsoleCopyService, useValue: consoleCopy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationsPage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  it('loads notifications on init and updates the navigation count', () => {
    fixture.detectChanges();

    expect(api.listDevices).toHaveBeenCalled();
    expect(api.listNotifications).toHaveBeenCalled();
    expect(api.listFutureNotifications).toHaveBeenCalled();
    expect(api.listNotificationStats).toHaveBeenCalled();
    expect(component.notifications().length).toBe(1);
    expect(component.futureNotifications().length).toBe(1);
    expect(shell.setNotificationsCount).toHaveBeenCalledWith(2);
  });

  it('does not expose any target device until an application is selected', () => {
    shell.selectedAppId.set(null);
    fixture.detectChanges();

    expect(component.availableDeviceOptions()).toEqual([]);

    component.notificationForm.controls.application_id.setValue('101');
    fixture.detectChanges();

    expect(component.availableDeviceOptions()).toEqual([
      {
        label: 'iPhone de Renaud (ios)',
        value: 201,
      },
    ]);
  });

  it('keeps only devices linked to the selected application', () => {
    fixture.detectChanges();
    component.openCreateModal();
    component.notificationForm.patchValue({
      application_id: '101',
      device_ids: [201, 202],
    });

    component.notificationForm.controls.application_id.setValue('102');

    expect(component.notificationForm.controls.device_ids.value).toEqual([202]);
  });

  it('creates a targeted notification with numeric ids and an ISO schedule', () => {
    fixture.detectChanges();
    component.openCreateModal();
    const scheduledFor = new Date('2026-03-28T20:00:00Z');
    component.notificationForm.setValue({
      application_id: '101',
      device_ids: [201],
      title: 'Nouvelle promo',
      message: 'Disponible maintenant.',
      scheduled_for: scheduledFor,
    });

    component.createNotification();

    expect(api.createNotification).toHaveBeenCalledWith({
      application_id: 101,
      device_ids: [201],
      title: 'Nouvelle promo',
      message: 'Disponible maintenant.',
      scheduled_for: scheduledFor.toISOString(),
    });
    expect(component.banner()).toBe('Notification planifiee creee.');
    expect(component.modalMode()).toBeNull();
  });

  it('updates a future notification in place', () => {
    fixture.detectChanges();
    component.openEditModal(
      makeNotification({
        id: 302,
        status: 'scheduled',
        title: 'Ancien titre',
        scheduled_for: '2026-03-28T20:00:00Z',
      }),
    );
    const nextDate = new Date('2026-03-29T10:00:00Z');
    component.futureEditForm.setValue({
      id: 302,
      title: 'Maj notif',
      message: 'Nouveau message',
      scheduled_for: nextDate,
    });

    component.saveFutureNotification();

    expect(api.updateFutureNotification).toHaveBeenCalledWith(302, {
      title: 'Maj notif',
      message: 'Nouveau message',
      scheduled_for: nextDate.toISOString(),
    });
    expect(component.banner()).toBe('Notification future mise a jour.');
    expect(component.modalMode()).toBeNull();
  });

  it('clears filters and reloads the default collections', () => {
    fixture.detectChanges();
    component.filtersForm.patchValue({
      application_id: '101',
      status: 'draft',
      effective_scheduled_from: new Date('2026-03-27T10:00:00Z'),
      effective_scheduled_to: new Date('2026-03-28T10:00:00Z'),
    });

    component.clearFilters();

    expect(component.filtersForm.getRawValue()).toEqual({
      application_id: '',
      status: '',
      effective_scheduled_from: null,
      effective_scheduled_to: null,
    });
    expect(api.listNotifications).toHaveBeenCalledWith({
      application_id: null,
      status: null,
      effective_scheduled_from: null,
      effective_scheduled_to: null,
      has_quiet_period_shift: null,
      ordering: '-effective_scheduled_for',
    });
  });
});
