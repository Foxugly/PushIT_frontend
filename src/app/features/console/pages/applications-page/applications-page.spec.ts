import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { makeApplication } from '../../../../../testing/console-fixtures';
import { ApplicationRead } from '../../../../core/models/api.models';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { AppConfirmService } from '../../../../shared/app-confirm-dialog/app-confirm.service';
import { ApplicationsPage } from './applications-page';

describe('ApplicationsPage', () => {
  let fixture: ComponentFixture<ApplicationsPage>;
  let component: ApplicationsPage;
  let api: jasmine.SpyObj<PushitApiService>;
  let confirm: jasmine.SpyObj<AppConfirmService>;
  let router: Router;
  let routeStub: {
    snapshot: {
      queryParamMap: ReturnType<typeof convertToParamMap>;
    };
  };
  let shell: {
    apps: ReturnType<typeof signal<ApplicationRead[]>>;
    selectedAppId: ReturnType<typeof signal<number | null>>;
    createApp: jasmine.Spy;
    loadShell: jasmine.Spy;
    toggleAppState: jasmine.Spy;
    regenerateToken: jasmine.Spy;
    revokeToken: jasmine.Spy;
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj<PushitApiService>('PushitApiService', ['updateApp', 'deleteApp']);
    api.updateApp.and.returnValue(of(makeApplication({ name: 'PushIT Mobile V2' })));
    api.deleteApp.and.returnValue(of(void 0));
    confirm = jasmine.createSpyObj<AppConfirmService>('AppConfirmService', ['ask']);
    confirm.ask.and.resolveTo(true);

    shell = {
      apps: signal<ApplicationRead[]>([
        makeApplication(),
        makeApplication({ id: 102, name: 'Backoffice', is_active: false }),
      ]),
      selectedAppId: signal<number | null>(101),
      createApp: jasmine.createSpy('createApp').and.callFake(
        (_payload: unknown, onDone?: () => void) => onDone?.(),
      ),
      loadShell: jasmine.createSpy('loadShell'),
      toggleAppState: jasmine.createSpy('toggleAppState'),
      regenerateToken: jasmine.createSpy('regenerateToken'),
      revokeToken: jasmine.createSpy('revokeToken'),
    };

    routeStub = {
      snapshot: {
        queryParamMap: convertToParamMap({}),
      },
    };

    const consoleCopy = {
      current: signal({
        applications: {
          title: 'Applications',
          total: 'Total',
          active: 'Actives',
          refresh: 'Rafraichir',
          add: 'Ajouter',
          empty: 'Aucune application.',
          noDescription: 'Aucune description',
          table: {
            name: 'Nom',
            description: 'Description',
            prefix: 'Prefixe',
            status: 'Statut',
            createdAt: 'Creation',
            actions: 'Actions',
          },
          dialog: {
            createTitle: 'Nouvelle application',
            editTitle: 'Modifier l application',
            create: 'Creer',
            save: 'Enregistrer',
            creating: 'Creation...',
            saving: 'Enregistrement...',
          },
          actions: {
            view: 'Voir',
            edit: 'Editer',
            deactivate: 'Desactiver',
            activate: 'Activer',
            regenerate: 'Regenerer',
            revoke: 'Revoquer',
            delete: 'Supprimer',
          },
          alerts: {
            created: 'Application creee.',
            updated: 'Application {name} mise a jour.',
            deleted: 'Application {name} supprimee.',
            activated: 'Application activee.',
            deactivated: 'Application desactivee.',
            regenerated: 'Token regenere.',
            revoked: 'Token revoque.',
          },
          errors: {
            create: 'Creation impossible.',
            toggle: 'Changement de statut impossible.',
            regenerate: 'Regeneration impossible.',
            revoke: 'Revocation impossible.',
          },
          statuses: {
            active: 'active',
            inactive: 'inactive',
          },
          confirmDelete: 'Supprimer {name} ?',
        },
      }),
    };

    await TestBed.configureTestingModule({
      imports: [ApplicationsPage],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: PushitApiService, useValue: api },
        { provide: ConsoleShellService, useValue: shell },
        { provide: ConsoleCopyService, useValue: consoleCopy },
        { provide: AppConfirmService, useValue: confirm },
        { provide: ActivatedRoute, useValue: routeStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ApplicationsPage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  it('opens the edit modal from the edit query param', () => {
    routeStub.snapshot.queryParamMap = convertToParamMap({ edit: '101' });

    fixture.detectChanges();

    expect(component.isModalOpen()).toBeTrue();
    expect(component.modalMode()).toBe('edit');
    expect(component.editingAppId()).toBe(101);
    expect(component.form.controls.name.value).toBe('PushIT Mobile');
  });

  it('delegates application creation to the shell service and shows a banner', () => {
    fixture.detectChanges();
    component.openCreateModal();
    component.form.setValue({
      name: 'Nouvelle app',
      description: 'Description',
    });

    component.saveApp();

    expect(shell.createApp).toHaveBeenCalledWith(
      { name: 'Nouvelle app', description: 'Description' },
      jasmine.any(Function),
      jasmine.any(Function),
    );
    expect(component.banner()).toBe('Application creee.');
    expect(component.isModalOpen()).toBeFalse();
  });

  it('updates an application and reloads the shell on success', () => {
    fixture.detectChanges();
    component.openEditModal(makeApplication());
    component.form.patchValue({ name: 'PushIT Mobile V2' });

    component.saveApp();

    expect(api.updateApp).toHaveBeenCalledWith(101, {
      name: 'PushIT Mobile V2',
      description: 'Application mobile',
    });
    expect(shell.loadShell).toHaveBeenCalledWith(101);
    expect(component.banner()).toBe('Application PushIT Mobile V2 mise a jour.');
    expect(component.isModalOpen()).toBeFalse();
  });

  it('deletes a confirmed application and refreshes the shell', async () => {
    fixture.detectChanges();

    await component.deleteApp(makeApplication({ id: 102, name: 'Backoffice' }));

    expect(api.deleteApp).toHaveBeenCalledWith(102);
    expect(shell.loadShell).toHaveBeenCalled();
    expect(component.banner()).toBe('Application Backoffice supprimee.');
  });

  it('refreshes applications with the selected app id', () => {
    fixture.detectChanges();

    component.refreshApplications();

    expect(shell.loadShell).toHaveBeenCalledWith(101);
  });
});
