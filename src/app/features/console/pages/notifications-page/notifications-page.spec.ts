import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  convertToParamMap,
  ParamMap,
  provideRouter,
  Router,
} from '@angular/router';
import { MessageService } from 'primeng/api';
import { HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

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
import { AppConfirmService } from '../../../../shared/app-confirm-dialog/app-confirm.service';
import { provideTestCatalogs } from '../../../../../testing/catalog-store.testing';
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
      'listNotificationsPage',
      'listFutureNotifications',
      'listNotificationStats',
      'createNotification',
      'updateFutureNotification',
      'deleteFutureNotification',
      'deleteNotification',
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
    api.listNotificationsPage.and.returnValue(
      of({
        count: 1,
        next: null,
        previous: null,
        results: [makeNotification({ id: 301, status: 'draft', scheduled_for: null })],
      }),
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
    api.deleteNotification.and.returnValue(of(void 0));
    api.sendNotification.and.returnValue(of({ status: 'queued', notification_id: 301, task_id: 'task-1' }));

    shell = {
      apps: signal([makeApplication(), makeApplication({ id: 102, name: 'Backoffice' })]),
      selectedAppId: signal<number | null>(101),
      setNotificationsCount: jasmine.createSpy('setNotificationsCount'),
    };

    const consoleCopy = {
      current: signal({
        // Shared enum labels (StatusLabelService), read from the console root.
        statusLabels: {
          notification: { draft: 'Brouillon', sent: 'Envoyée', failed: 'Échec', scheduled: 'Planifiée', shifted: 'Reportée' },
          platform: { android: 'Android', ios: 'iPhone' },
        },
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
            statusChips: 'Filtrer par statut',
            allStatusesChip: 'Toutes',
          },
          emptyState: {
            title: 'Aucune notification envoyee',
            message: 'Vos notifications apparaitront ici.',
            cta: 'Envoyer une notification',
            noAppMessage: 'Creez d abord une application.',
            noAppCta: 'Creer une application',
          },
          emptyFiltered: {
            title: 'Aucune notification pour ces filtres',
            message: 'Modifiez les filtres.',
            cta: 'Reinitialiser les filtres',
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
            hidden: 'Notification {title} masquee.',
            queued: 'Notification {notificationId} en file ({taskId}).',
            inactiveApp: 'Application desactivee.',
            goToBilling: 'Aller a la facturation',
          },
          confirmDelete: 'Supprimer {title} ?',
          confirmHide: 'Masquer {title} ?',
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
        MessageService,
        provideTestCatalogs(),
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
    expect(api.listNotificationsPage).toHaveBeenCalled();
    expect(api.listFutureNotifications).toHaveBeenCalled();
    expect(api.listNotificationStats).toHaveBeenCalled();
    expect(component.notifications().length).toBe(1);
    expect(component.notificationsTotal()).toBe(1);
    expect(component.futureNotifications().length).toBe(1);
    expect(shell.setNotificationsCount).toHaveBeenCalledWith(2);
  });

  it('does not open the create modal without ?create=1', () => {
    fixture.detectChanges();

    expect(component.modalMode()).toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('opens the create modal pre-selected on ?app= when ?create=1 (deep link from an app)', () => {
    const route = TestBed.inject(ActivatedRoute);
    route.snapshot = {
      queryParamMap: convertToParamMap({ create: '1', app: '102' }),
    } as unknown as ActivatedRouteSnapshot;

    fixture.detectChanges();
    fixture.detectChanges();

    expect(component.modalMode()).toBe('create');
    // The explicit app wins over the shell selection (101), even after the
    // selection sync has run.
    expect(component.notificationForm.controls.application_id.value).toBe('102');
    expect(component.availableDeviceOptions().map((option) => option.value)).toEqual([202]);
    // Every reachable subscribed device of that app is pre-selected.
    expect(component.notificationForm.controls.device_ids.value).toEqual([202]);
    // ...and the select can actually display it (option values match the control).
    expect(component.appOptions().map((option) => option.value)).toContain('102');
    // The one-shot params are dropped so a reload does not reopen the modal.
    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: route,
      queryParams: { create: null, app: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });

  it('does not expose any target device until an application is selected', () => {
    shell.selectedAppId.set(null);
    fixture.detectChanges();

    expect(component.availableDeviceOptions()).toEqual([]);

    component.notificationForm.controls.application_id.setValue('101');
    fixture.detectChanges();

    expect(component.availableDeviceOptions()).toEqual([
      {
        label: 'iPhone de Renaud (iPhone)',
        value: 201,
      },
    ]);
  });

  describe('target devices pre-selection', () => {
    it('pre-selects every active device subscribed to the app when the modal opens', () => {
      fixture.detectChanges();

      component.openCreateModal(101);

      // 203 is linked to 101 but its push token is invalid: not reachable.
      expect(component.notificationForm.controls.device_ids.value).toEqual([201]);
      expect(component.notificationForm.controls.device_ids.valid).toBe(true);
    });

    it('follows an application change while the selection is untouched', () => {
      fixture.detectChanges();
      component.openCreateModal(101);

      component.notificationForm.controls.application_id.setValue('102');

      expect(component.notificationForm.controls.device_ids.value).toEqual([202]);
    });

    it('only prunes a selection the user edited', () => {
      api.listDevices.and.returnValue(
        of<DeviceRead[]>([
          makeDevice({ id: 201, application_ids: [101, 102], push_token_status: 'active' }),
          makeDevice({ id: 204, application_ids: [101], push_token_status: 'active' }),
          makeDevice({ id: 202, application_ids: [102], push_token_status: 'active' }),
        ]),
      );
      fixture.detectChanges();
      component.openCreateModal(101);
      expect(component.notificationForm.controls.device_ids.value).toEqual([201, 204]);
      component.notificationForm.controls.device_ids.setValue([201, 204]);
      component.notificationForm.controls.device_ids.markAsDirty();

      component.notificationForm.controls.application_id.setValue('102');

      expect(component.notificationForm.controls.device_ids.value).toEqual([201]);
    });

    it('pre-selects the devices that arrive after the modal opened', () => {
      const devices$ = new Subject<DeviceRead[]>();
      api.listDevices.and.returnValue(devices$);
      fixture.detectChanges();
      component.openCreateModal(101);
      expect(component.notificationForm.controls.device_ids.value).toEqual([]);

      devices$.next([makeDevice({ id: 201, application_ids: [101], push_token_status: 'active' })]);
      devices$.complete();

      expect(component.notificationForm.controls.device_ids.value).toEqual([201]);
    });
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

  it('shows the billing refusal (402) inside the create modal with a link to billing', () => {
    api.createNotification.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 402,
            error: { code: 'subscription_required', detail: 'Subscription required.' },
          }),
      ),
    );
    fixture.detectChanges();
    component.openCreateModal();
    component.notificationForm.setValue({
      application_id: '101',
      device_ids: [201],
      title: 'Promo',
      message: 'Texte',
      scheduled_for: new Date('2026-03-28T20:00:00Z'),
    });

    component.createNotification();
    fixture.detectChanges();

    expect(component.error()?.code).toBe('subscription_required');
    expect(component.billingRefused()).toBe(true);
    expect(component.modalMode()).toBe('create');
    expect(document.body.textContent).toContain('Aller a la facturation');
  });

  it('flags a billing refusal when sending an existing draft', () => {
    api.sendNotification.and.returnValue(
      throwError(
        () => new HttpErrorResponse({ status: 402, error: { code: 'quota_exceeded', detail: 'Quota.' } }),
      ),
    );
    fixture.detectChanges();

    component.sendNotification(makeNotification({ id: 301, status: 'draft', scheduled_for: null }));

    expect(component.error()?.code).toBe('quota_exceeded');
    expect(component.billingRefused()).toBe(true);
  });

  it('refuses to submit on a deactivated application, with a clear message', () => {
    shell.apps.set([makeApplication({ is_active: false })]);
    fixture.detectChanges();
    component.openCreateModal();
    component.notificationForm.setValue({
      application_id: '101',
      device_ids: [201],
      title: 'Promo',
      message: 'Texte',
      scheduled_for: null,
    });

    expect(component.selectedAppInactive()).toBe(true);
    component.createNotification();

    expect(api.createNotification).not.toHaveBeenCalled();
    expect(component.error()?.code).toBe('application_inactive');
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

  describe('soft delete', () => {
    it('offers the trash only on history rows that are no longer pending', () => {
      fixture.detectChanges();

      expect(component.canDelete(makeNotification({ id: 301, status: 'sent' }))).toBe(true);
      expect(component.canDelete(makeNotification({ id: 301, status: 'failed' }))).toBe(true);
      expect(component.canDelete(makeNotification({ id: 310, status: 'queued' }))).toBe(false);
      expect(component.canDelete(makeNotification({ id: 310, status: 'processing' }))).toBe(false);
      // 302 is in the future list: it keeps its own (hard) delete.
      expect(component.canDelete(makeNotification({ id: 302, status: 'scheduled' }))).toBe(false);
    });

    it('hides a notification once confirmed, then reloads the lists', async () => {
      vi.spyOn(TestBed.inject(AppConfirmService), 'ask').mockResolvedValue(true);
      fixture.detectChanges();
      api.listNotificationsPage.calls.reset();

      await component.deleteNotification(makeNotification({ id: 301, title: 'Promo', status: 'sent' }));

      expect(api.deleteNotification).toHaveBeenCalledOnceWith(301);
      expect(component.banner()).toBe('Notification Promo masquee.');
      expect(api.listNotificationsPage).toHaveBeenCalled();
    });

    it('does nothing when the confirmation is declined', async () => {
      vi.spyOn(TestBed.inject(AppConfirmService), 'ask').mockResolvedValue(false);
      fixture.detectChanges();

      await component.deleteNotification(makeNotification({ id: 301, status: 'sent' }));

      expect(api.deleteNotification).not.toHaveBeenCalled();
    });

    it('shows the API error when the backend refuses', async () => {
      vi.spyOn(TestBed.inject(AppConfirmService), 'ask').mockResolvedValue(true);
      api.deleteNotification.and.returnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: { code: 'notification_pending', detail: 'Pending.' },
            }),
        ),
      );
      fixture.detectChanges();

      await component.deleteNotification(makeNotification({ id: 301, status: 'sent' }));

      expect(component.error()?.code).toBe('notification_pending');
    });
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
      device_id: '',
      status: '',
      effective_scheduled_from: null,
      effective_scheduled_to: null,
    });
    expect(api.listNotificationsPage).toHaveBeenCalledWith(
      {
        application_id: null,
        device_id: null,
        status: null,
        effective_scheduled_from: null,
        effective_scheduled_to: null,
        has_quiet_period_shift: null,
        ordering: '-effective_scheduled_for',
      },
      1,
      25,
    );
  });

  describe('filters', () => {
    let queryParams$: BehaviorSubject<ParamMap>;

    /** Drive the route's query params (the page reads its filters from them). */
    function useQueryParams(params: Record<string, string>): void {
      queryParams$ = new BehaviorSubject(convertToParamMap(params));
      Object.defineProperty(TestBed.inject(ActivatedRoute), 'queryParamMap', { value: queryParams$ });
    }

    afterEach(() => {
      vi.useRealTimers();
    });

    it('restores the filters from the query params and loads with them', () => {
      useQueryParams({ status: 'failed', application: '102', from: '2026-03-27T10:00:00.000Z', device: 'x' });

      fixture.detectChanges();

      expect(component.filtersForm.getRawValue()).toEqual({
        application_id: '102',
        device_id: '',
        status: 'failed',
        effective_scheduled_from: new Date('2026-03-27T10:00:00.000Z'),
        effective_scheduled_to: null,
      });
      expect(component.hasActiveFilters()).toBe(true);
      expect(api.listNotificationsPage).toHaveBeenCalledWith(
        expect.objectContaining({ application_id: 102, status: 'failed', device_id: null }),
        1,
        25,
      );
      expect(api.listNotificationStats).toHaveBeenCalledWith({ application_id: 102 });
      // Reading the URL does not rewrite it.
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('ignores an unknown status in the URL', () => {
      useQueryParams({ status: 'bogus' });

      fixture.detectChanges();

      expect(component.filtersForm.controls.status.value).toBe('');
      expect(component.hasActiveFilters()).toBe(false);
    });

    it('follows a later query change (link to the same page) and reloads', () => {
      useQueryParams({});
      fixture.detectChanges();
      api.listNotificationsPage.calls.reset();

      queryParams$.next(convertToParamMap({ status: 'failed' }));

      expect(component.appliedFilters().status).toBe('failed');
      expect(api.listNotificationsPage).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
        1,
        25,
      );
    });

    it('toggles a status filter from its chip, at once, and writes it to the URL', () => {
      useQueryParams({});
      fixture.detectChanges();

      component.toggleStatusFilter('scheduled');

      expect(component.appliedFilters().status).toBe('scheduled');
      expect(api.listNotificationsPage).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'scheduled' }),
        1,
        25,
      );
      expect(router.navigate).toHaveBeenCalledWith([], {
        relativeTo: TestBed.inject(ActivatedRoute),
        queryParams: { application: null, device: null, status: 'scheduled', from: null, to: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });

      // Clicking the active chip clears it.
      component.toggleStatusFilter('scheduled');
      expect(component.appliedFilters().status).toBe('');
    });

    it('renders one clickable chip per status that has notifications', () => {
      useQueryParams({});
      fixture.detectChanges();

      const chips = Array.from(
        fixture.nativeElement.querySelectorAll('.notifications-chip') as NodeListOf<HTMLButtonElement>,
      );
      expect(chips.map((chip) => chip.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
        'Toutes 2',
        'Brouillon 1',
        'Planifiée 1',
      ]);
      expect(chips[0].getAttribute('aria-pressed')).toBe('true');

      chips[1].click();
      fixture.detectChanges();

      expect(component.appliedFilters().status).toBe('draft');
      expect(chips[1].getAttribute('aria-pressed')).toBe('true');
    });

    it('applies select / date filters live, debounced', async () => {
      vi.useFakeTimers();
      useQueryParams({});
      fixture.detectChanges();
      api.listNotificationsPage.calls.reset();

      component.filtersForm.controls.application_id.setValue('101');
      component.filtersForm.controls.device_id.setValue('201');
      expect(api.listNotificationsPage).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(300);

      expect(api.listNotificationsPage).toHaveBeenCalledOnceWith(
        expect.objectContaining({ application_id: 101, device_id: 201 }),
        1,
        25,
      );
    });

    it('filters the future list client-side (its endpoint only filters on dates)', () => {
      api.listFutureNotifications.and.returnValue(
        of([
          makeNotification({ id: 401, application_id: 101, status: 'scheduled', device_ids: [201] }),
          makeNotification({ id: 402, application_id: 102, status: 'scheduled', device_ids: [202] }),
        ]),
      );
      useQueryParams({ application: '102' });
      fixture.detectChanges();

      expect(component.visibleFutureNotifications().map((item) => item.id)).toEqual([402]);

      queryParams$.next(convertToParamMap({ status: 'failed' }));
      expect(component.visibleFutureNotifications()).toEqual([]);
    });
  });

  describe('empty states', () => {
    function emptyLists(): void {
      api.listNotificationsPage.and.returnValue(of({ count: 0, next: null, previous: null, results: [] }));
      api.listFutureNotifications.and.returnValue(of([]));
      api.listNotificationStats.and.returnValue(of([]));
    }

    it('offers to send a first notification when there is nothing yet', () => {
      emptyLists();
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(component.isEmpty()).toBe(true);
      expect(element.textContent).toContain('Aucune notification envoyee');
      expect(element.querySelector('.notifications-filters')).toBeNull();
      expect(element.querySelector('.notifications-chip')).toBeNull();

      const cta = Array.from(element.querySelectorAll('app-empty-state button')).find((button) =>
        button.textContent?.includes('Envoyer une notification'),
      ) as HTMLButtonElement;
      cta.click();
      expect(component.modalMode()).toBe('create');
    });

    it('sends a new account to create an application first', () => {
      emptyLists();
      shell.apps.set([]);
      fixture.detectChanges();

      const text = (fixture.nativeElement as HTMLElement).textContent;
      expect(text).toContain('Creez d abord une application.');
      expect(text).toContain('Creer une application');
    });

    it('offers to reset the filters when they match nothing', () => {
      emptyLists();
      api.listNotificationStats.and.returnValue(of([makeNotificationStat('sent', 3)]));
      Object.defineProperty(TestBed.inject(ActivatedRoute), 'queryParamMap', {
        value: new BehaviorSubject(convertToParamMap({ status: 'failed' })),
      });
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.textContent).toContain('Aucune notification pour ces filtres');
      // The filters stay reachable.
      expect(element.querySelector('.notifications-filters')).not.toBeNull();

      component.clearFilters();
      expect(component.hasActiveFilters()).toBe(false);
    });
  });
});
