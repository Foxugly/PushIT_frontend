import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AdminStatus } from '../../../../core/models/api.models';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { SettingsService } from '../../../../core/services/settings.service';
import { AdminStatusPage } from './admin-status-page';

const ADMIN_STATUS_COPY = {
  back: 'Retour',
  eyebrow: 'Administration',
  title: 'Etat backend',
  description: 'Supervision.',
  refresh: 'Rafraichir',
  loading: 'Chargement...',
  error: 'Erreur de chargement.',
  overallTitle: 'Etat global',
  overallStatus: { ok: 'Operationnel', degraded: 'Degrade', unknown: 'Inconnu' },
  djangoAdmin: 'Ouvrir admin Django',
  checksTitle: 'Controles',
  checkStatus: { ok: 'ok', degraded: 'degrade', error: 'erreur', unknown: 'inconnu' },
  checks: { database: 'Base', celery_broker: 'Broker', celery_workers: 'Workers', exchange: 'Exchange' },
  noDetail: 'Aucun detail.',
  metricsTitle: 'Metriques',
  metrics: {
    applications: 'Applications',
    applicationsActive: 'Actives',
    devices: 'Devices',
    notifications: 'Notifications',
    processingStuck: 'Bloquees',
    none: 'Aucune metrique.',
  },
};

function makeStatus(overrides: Partial<AdminStatus> = {}): AdminStatus {
  return {
    status: 'ok',
    checks: {
      database: { status: 'ok', detail: 'OK' },
      celery_broker: { status: 'degraded', detail: 'slow' },
      celery_workers: { status: 'error', detail: 'down' },
      exchange: { status: 'ok', detail: 'reachable', configured: true },
    },
    metrics: {
      applications: { total: 5, active: 3 },
      devices: { total: 12 },
      notifications: { sent: 100, failed: 2 },
      processing_stuck: 4,
    },
    ...overrides,
  };
}

describe('AdminStatusPage', () => {
  let fixture: ComponentFixture<AdminStatusPage>;
  let component: AdminStatusPage;
  let api: jasmine.SpyObj<PushitApiService>;

  async function setup(apiBaseUrl: string): Promise<void> {
    api = jasmine.createSpyObj<PushitApiService>('PushitApiService', ['getAdminStatus']);
    api.getAdminStatus.and.returnValue(of(makeStatus()));

    const consoleCopy = { current: signal({ adminStatus: ADMIN_STATUS_COPY }) };
    const settings = { apiBaseUrl: () => apiBaseUrl };

    await TestBed.configureTestingModule({
      imports: [AdminStatusPage],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PushitApiService, useValue: api },
        { provide: ConsoleCopyService, useValue: consoleCopy },
        { provide: SettingsService, useValue: settings },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminStatusPage);
    component = fixture.componentInstance;
  }

  it('loads and renders the admin status on init', async () => {
    await setup('https://pushit-api.foxugly.com/api/v1');
    fixture.detectChanges();

    expect(api.getAdminStatus).toHaveBeenCalled();
    expect(component.overallSeverity()).toBe('success');
    expect(component.checkRows().length).toBe(4);
    expect(component.checkRows()[0].severity).toBe('success');
    expect(component.checkRows()[1].severity).toBe('warn');
    expect(component.checkRows()[2].severity).toBe('danger');
    expect(component.notificationMetrics().length).toBe(2);
    expect(component.processingStuck()).toBe(4);
  });

  it('derives the Django admin URL by stripping the /api/v1 prefix', async () => {
    await setup('https://pushit-api.foxugly.com/api/v1');
    fixture.detectChanges();

    expect(component.djangoAdminUrl()).toBe('https://pushit-api.foxugly.com/admin/');
  });

  it('falls back to /admin/ for the relative dev default', async () => {
    await setup('/api/v1');
    fixture.detectChanges();

    expect(component.djangoAdminUrl()).toBe('/admin/');
  });

  it('renders gracefully with a partial payload', async () => {
    await setup('/api/v1');
    api.getAdminStatus.and.returnValue(of({ status: 'degraded' }));
    fixture.detectChanges();

    expect(component.overallSeverity()).toBe('warn');
    expect(component.checkRows().length).toBe(4);
    expect(component.checkRows()[0].severity).toBe('secondary');
    expect(component.notificationMetrics().length).toBe(0);
    expect(component.processingStuck()).toBe(0);
  });

  it('surfaces an error when the status request fails', async () => {
    await setup('/api/v1');
    api.getAdminStatus.and.returnValue(
      throwError(() => ({ status: 500, error: { detail: 'boom' } })),
    );
    fixture.detectChanges();

    expect(component.error()).not.toBeNull();
    expect(component.status()).toBeNull();
  });
});
