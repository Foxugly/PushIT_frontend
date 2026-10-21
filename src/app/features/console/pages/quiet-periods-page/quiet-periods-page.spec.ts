import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, ParamMap, provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { of } from 'rxjs';

import { ApplicationQuietPeriod, DeviceQuietPeriod } from '../../../../core/models/api.models';
import { makeDevice } from '../../../../../testing/console-fixtures';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { QuietPeriodsPage } from './quiet-periods-page';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';

describe('QuietPeriodsPage', () => {
  let fixture: ComponentFixture<QuietPeriodsPage>;
  let component: QuietPeriodsPage;
  let api: jasmine.SpyObj<PushitApiService>;
  let shell: {
    apps: ReturnType<typeof signal<any[]>>;
    refreshNavigationCounts: jasmine.Spy<() => void>;
    invalidateQuietPeriodsCount: jasmine.Spy<() => void>;
  };
  let routeStub: { snapshot: { queryParamMap: ParamMap } };
  let router: Router;

  beforeEach(async () => {
    api = jasmine.createSpyObj<PushitApiService>('PushitApiService', [
      'listDevices',
      'listAppQuietPeriods',
      'listDeviceQuietPeriods',
      'createAppQuietPeriod',
      'createDeviceQuietPeriod',
      'updateAppQuietPeriod',
      'updateDeviceQuietPeriod',
      'deleteAppQuietPeriod',
      'deleteDeviceQuietPeriod',
    ]);
    api.listDevices.and.returnValue(of([]));
    api.listAppQuietPeriods.and.returnValue(of([]));
    api.listDeviceQuietPeriods.and.returnValue(of([]));
    api.createAppQuietPeriod.and.returnValue(of({} as ApplicationQuietPeriod));
    api.createDeviceQuietPeriod.and.returnValue(of({} as DeviceQuietPeriod));
    api.updateAppQuietPeriod.and.returnValue(of({} as ApplicationQuietPeriod));
    api.updateDeviceQuietPeriod.and.returnValue(of({} as DeviceQuietPeriod));
    api.deleteAppQuietPeriod.and.returnValue(of(void 0));
    api.deleteDeviceQuietPeriod.and.returnValue(of(void 0));

    shell = {
      apps: signal<any[]>([]),
      refreshNavigationCounts: jasmine.createSpy('refreshNavigationCounts'),
      invalidateQuietPeriodsCount: jasmine.createSpy('invalidateQuietPeriodsCount'),
    };
    const consoleCopy = {
      current: signal({
        quietPeriods: {
          title: 'Gestion des fenetres de silence',
          refresh: 'Rafraichir',
          add: 'Ajouter',
          empty: 'Aucune periode blanche configuree.',
          emptyState: {
            title: 'Aucune periode blanche',
            message: 'Une periode blanche suspend les envois.',
            cta: 'Ajouter une periode blanche',
            noAppCta: 'Creer une application',
          },
          loading: 'Chargement des periodes blanches...',
          targetNone: 'Aucune cible',
          targetUnknownApplication: 'Application inconnue',
          targetUnknownDevice: 'Device inconnu',
          missingTargets:
            'Aucune application ou aucun device disponible pour creer une periode blanche.',
          missingParent: 'Selectionnez une cible valide avant de creer une periode blanche.',
          table: { target: 'Cible', name: 'Nom', type: 'Type', rule: 'Regle', status: 'Statut', actions: 'Actions' },
          dialog: { createTitle: 'Nouvelle periode blanche', editTitle: 'Modifier une periode blanche', create: 'Creer la periode', update: 'Mettre a jour', saving: 'Enregistrement...' },
          scopeLabels: { application: 'Application', device: 'Device' },
          typeLabels: { once: 'Ponctuelle', recurring: 'Recurrente', badgeOnce: 'once', badgeRecurring: 'recurring' },
          statusLabels: { active: 'active', inactive: 'inactive' },
          form: { target: 'Cible', device: 'Device', application: 'Application', selectPlaceholder: 'Choisir...', name: 'Nom', namePlaceholder: 'Nuit marketing', type: 'Type', recurrenceDays: 'Jours de recurrence', startTime: 'Heure de debut', endTime: 'Heure de fin', startAt: 'Debut', endAt: 'Fin', active: 'Periode active' },
          weekdays: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
          defaultNames: { application: 'Silence application', device: 'Silence device' },
          alerts: { created: 'Periode blanche creee.', updated: 'Periode blanche mise a jour.', deleted: 'Periode blanche "{name}" supprimee.' },
          actions: { edit: 'Editer', delete: 'Supprimer' },
          readOnly: 'Lecture seule',
          readOnlyHint: "Fenetre de silence du device d'un abonne.",
          confirmDelete: 'Supprimer la periode blanche "{name}" ?',
          validation: { onceRequired: 'Une periode ponctuelle demande une date de debut et une date de fin.', recurringRequired: 'Une periode recurrente demande des jours et une plage horaire.', required: 'Ce champ est obligatoire.', selectOneDay: 'Selectionnez au moins un jour.', endAfterStart: 'La fin de la periode blanche doit etre apres le debut.', differentEndTime: "L'heure de fin doit etre differente de l'heure de debut." },
        },
      }),
    };

    routeStub = { snapshot: { queryParamMap: convertToParamMap({}) } };

    await TestBed.configureTestingModule({
      imports: [QuietPeriodsPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: routeStub },
        provideNoopAnimations(),
        { provide: PushitApiService, useValue: api },
        { provide: ConsoleShellService, useValue: shell },
        { provide: ConsoleCopyService, useValue: consoleCopy },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(QuietPeriodsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('?create=1&app=<id> (from the application detail page)', () => {
    function createWithQuery(params: Record<string, string>): ComponentFixture<QuietPeriodsPage> {
      routeStub.snapshot.queryParamMap = convertToParamMap(params);
      const pageFixture = TestBed.createComponent(QuietPeriodsPage);
      pageFixture.detectChanges();
      return pageFixture;
    }

    it('opens the create modal on that app once the shell has loaded it, then drops the params', () => {
      const pageFixture = createWithQuery({ create: '1', app: '11' });
      const page = pageFixture.componentInstance;
      expect(page.isModalOpen()).toBe(false);
      expect(router.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ queryParams: { create: null, app: null }, replaceUrl: true }),
      );

      shell.apps.set([
        { id: 10, name: 'PushIT Mobile' },
        { id: 11, name: 'Backoffice' },
      ]);
      pageFixture.detectChanges();

      expect(page.isModalOpen()).toBe(true);
      expect(page.modalScope()).toBe('application');
      expect(page.modalApplicationId()).toBe(11);
      expect(page.modalTargetLabel()).toContain('Backoffice');
    });

    it('ignores the page without the create flag', () => {
      shell.apps.set([{ id: 11, name: 'Backoffice' }]);
      const page = createWithQuery({ app: '11' }).componentInstance;

      expect(page.isModalOpen()).toBe(false);
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  it('shows an error when creating a quiet period without any available target', () => {
    component.openCreateModal();

    expect(component.error()?.detail).toContain('Aucune application ou aucun device disponible');
    expect(component.isModalOpen()).toBeFalse();
  });

  it('pre-fills a default application quiet period name', () => {
    shell.apps.set([
      {
        id: 10,
        name: 'PushIT Mobile',
      },
    ]);
    component.openCreateModal();

    expect(component.isModalOpen()).toBeTrue();
    expect(component.form.controls.name.value).toBe('Silence application');
  });

  it('blocks saving a one-time period without start and end dates', () => {
    shell.apps.set([{ id: 10, name: 'PushIT Mobile' }]);
    component.openCreateModal();
    component.form.patchValue({
      name: 'Maintenance',
      period_type: 'ONCE',
      start_at: null,
      end_at: null,
    });

    component.saveQuietPeriod();

    expect(api.createAppQuietPeriod).not.toHaveBeenCalled();
    expect(component.error()?.errors?.['start_at']).toBeDefined();
    expect(component.error()?.errors?.['end_at']).toBeDefined();
  });

  it('sends a clean ONCE payload for application quiet periods', () => {
    shell.apps.set([{ id: 10, name: 'PushIT Mobile' }]);
    component.openCreateModal();
    component.form.patchValue({
      name: 'Maintenance',
      period_type: 'ONCE',
      start_at: new Date('2026-03-27T21:00:00Z'),
      end_at: new Date('2026-03-27T22:00:00Z'),
      recurrence_days: [1, 2],
      start_time: new Date('2026-03-27T08:00:00Z'),
      end_time: new Date('2026-03-27T09:00:00Z'),
      is_active: true,
    });

    component.saveQuietPeriod();

    expect(api.createAppQuietPeriod).toHaveBeenCalledOnceWith(
      10,
      jasmine.objectContaining({
        name: 'Maintenance',
        period_type: 'ONCE',
        is_active: true,
      }),
    );
    const payload = api.createAppQuietPeriod.calls.mostRecent().args[1] as unknown as Record<
      string,
      unknown
    >;
    expect(payload['recurrence_days']).toBeUndefined();
    expect(payload['start_time']).toBeUndefined();
    expect(payload['end_time']).toBeUndefined();
  });

  it('blocks recurring periods when start and end times are identical', () => {
    shell.apps.set([{ id: 10, name: 'PushIT Mobile' }]);
    component.openCreateModal();
    const identicalTime = new Date('2026-03-27T22:00:00Z');
    component.form.patchValue({
      name: 'Night silence',
      period_type: 'RECURRING',
      recurrence_days: [0, 1],
      start_time: identicalTime,
      end_time: identicalTime,
      is_active: true,
    });

    component.saveQuietPeriod();

    expect(api.createAppQuietPeriod).not.toHaveBeenCalled();
    expect(component.error()?.errors?.['end_time']).toEqual([
      "L'heure de fin doit etre differente de l'heure de debut.",
    ]);
  });

  describe("subscriber devices (is_mine=false) are read-only", () => {
    const deviceQuietPeriod = (device: number) =>
      ({ id: 900 + device, device, name: 'Nuit' }) as unknown as DeviceQuietPeriod;

    beforeEach(() => {
      component.devices.set([
        makeDevice({ id: 1, device_name: 'Mine', is_mine: true }),
        makeDevice({ id: 2, device_name: 'Subscriber', is_mine: false }),
      ]);
    });

    it('offers only the user own devices as quiet-period targets', () => {
      expect(component.deviceOptions().map((option) => option.value)).toEqual([1]);
      expect(component.scopeOptions().map((option) => option.value)).toEqual([
        'application',
        'device',
      ]);
    });

    it('drops the device scope and blocks creation when no device is the user own', () => {
      component.devices.set([makeDevice({ id: 2, is_mine: false })]);

      expect(component.scopeOptions().map((option) => option.value)).toEqual(['application']);
      expect(component.hasTargets()).toBe(false);
      component.openCreateModal();
      expect(component.isModalOpen()).toBe(false);
    });

    it('allows managing own-device and app quiet periods only', () => {
      expect(component.canManage(deviceQuietPeriod(1))).toBe(true);
      expect(component.canManage(deviceQuietPeriod(2))).toBe(false);
      expect(
        component.canManage({ id: 5, application: 10 } as unknown as ApplicationQuietPeriod),
      ).toBe(true);
    });

    it('ignores edit and delete on a subscriber device quiet period', async () => {
      component.editQuietPeriod(deviceQuietPeriod(2));
      expect(component.isModalOpen()).toBe(false);

      await component.deleteQuietPeriod(deviceQuietPeriod(2));
      expect(api.deleteDeviceQuietPeriod).not.toHaveBeenCalled();
    });
  });
});
