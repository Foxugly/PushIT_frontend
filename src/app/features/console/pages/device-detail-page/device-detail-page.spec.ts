import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { makeApplication, makeDevice } from '../../../../../testing/console-fixtures';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { DeviceDetailPage } from './device-detail-page';

describe('DeviceDetailPage', () => {
  let fixture: ComponentFixture<DeviceDetailPage>;
  let component: DeviceDetailPage;
  let api: jasmine.SpyObj<PushitApiService>;
  let shell: {
    apps: ReturnType<typeof signal<ReturnType<typeof makeApplication>[]>>;
    refreshNavigationCounts: jasmine.Spy<() => void>;
  };
  let routeStub: {
    snapshot: {
      paramMap: ReturnType<typeof convertToParamMap>;
    };
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj<PushitApiService>('PushitApiService', ['getDevice', 'updateDevice']);
    api.getDevice.and.returnValue(
      of(makeDevice({ id: 201, application_ids: [101, 102], push_token_status: 'invalid' })),
    );
    api.updateDevice.and.returnValue(
      of(makeDevice({ id: 201, device_name: 'Pixel QA', platform: 'android' })),
    );

    shell = {
      apps: signal([makeApplication(), makeApplication({ id: 102, name: 'Backoffice' })]),
      refreshNavigationCounts: jasmine.createSpy('refreshNavigationCounts'),
    };

    routeStub = {
      snapshot: {
        paramMap: convertToParamMap({ deviceId: '201' }),
      },
    };

    const consoleCopy = {
      current: signal({
        deviceDetail: {
          back: 'Retour',
          eyebrow: 'Device',
          fallbackTitle: 'Device',
          editTooltip: 'Editer',
          loading: 'Chargement...',
          applicationsTitle: 'Applications',
          applicationsEmpty: 'Aucune application',
          statusTitle: 'Statut',
          actions: { view: 'Voir' },
          table: {
            name: 'Nom',
            prefix: 'Prefixe',
            status: 'Statut',
            createdAt: 'Creation',
            actions: 'Actions',
          },
          dialog: {
            title: 'Modifier',
            save: 'Enregistrer',
            saving: 'Enregistrement...',
          },
          errors: { invalidId: 'ID device invalide.' },
          facts: {
            id: 'ID',
            name: 'Nom',
            platform: 'Plateforme',
            tokenStatus: 'Push',
            lastActivity: 'Derniere activite',
            createdAt: 'Creation',
          },
          labels: { never: 'Jamais', active: 'active', inactive: 'inactive' },
        },
      }),
    };

    await TestBed.configureTestingModule({
      imports: [DeviceDetailPage],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: ActivatedRoute, useValue: routeStub },
        { provide: PushitApiService, useValue: api },
        { provide: ConsoleShellService, useValue: shell },
        { provide: ConsoleCopyService, useValue: consoleCopy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceDetailPage);
    component = fixture.componentInstance;
  });

  it('loads the device and resolves linked applications from the shell', () => {
    fixture.detectChanges();

    expect(api.getDevice).toHaveBeenCalledWith(201);
    expect(component.device()?.id).toBe(201);
    expect(component.linkedApplications().map((app) => app.name)).toEqual([
      'PushIT Mobile',
      'Backoffice',
    ]);
  });

  it('reports an error for an invalid device id', () => {
    routeStub.snapshot.paramMap = convertToParamMap({ deviceId: 'bad' });

    fixture.detectChanges();

    expect(component.error()?.detail).toBe('ID device invalide.');
    expect(api.getDevice).not.toHaveBeenCalled();
  });

  it('updates the device and refreshes navigation counts', () => {
    fixture.detectChanges();
    component.openEditModal();
    component.editForm.patchValue({
      device_name: 'Pixel QA',
      platform: 'android',
      push_token_status: 'active',
    });

    component.saveDevice();

    expect(api.updateDevice).toHaveBeenCalledWith(201, {
      device_name: 'Pixel QA',
      platform: 'android',
      push_token_status: 'active',
    });
    expect(component.device()?.device_name).toBe('Pixel QA');
    expect(shell.refreshNavigationCounts).toHaveBeenCalled();
  });
});
