import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
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
  let shell: {
    apps: ReturnType<typeof signal<ApplicationRead[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    selectedAppId: ReturnType<typeof signal<number | null>>;
    lastGeneratedToken: ReturnType<typeof signal<{ appId: number; token: string; prefix: string } | null>>;
    loadShell: jasmine.Spy;
    toggleAppState: jasmine.Spy;
    regenerateToken: jasmine.Spy;
    revokeToken: jasmine.Spy;
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj<PushitApiService>('PushitApiService', ['deleteApp']);
    api.deleteApp.and.returnValue(of(void 0));
    confirm = jasmine.createSpyObj<AppConfirmService>('AppConfirmService', ['ask']);
    confirm.ask.and.resolveTo(true);

    shell = {
      apps: signal<ApplicationRead[]>([
        makeApplication(),
        makeApplication({ id: 102, name: 'Backoffice', is_active: false }),
      ]),
      loading: signal<boolean>(false),
      selectedAppId: signal<number | null>(101),
      lastGeneratedToken: signal<{ appId: number; token: string; prefix: string } | null>(null),
      loadShell: jasmine.createSpy('loadShell'),
      toggleAppState: jasmine.createSpy('toggleAppState'),
      regenerateToken: jasmine.createSpy('regenerateToken'),
      revokeToken: jasmine.createSpy('revokeToken'),
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
          actions: {
            view: 'Voir',
            edit: 'Editer',
            deactivate: 'Desactiver',
            activate: 'Activer',
            regenerate: 'Regenerer',
            revoke: 'Revoquer',
            delete: 'Supprimer',
            qrCode: 'QR code',
          },
          qr: {
            title: 'QR code',
            scanHint: 'Scan',
            tokenOnce: 'Once',
            regenerate: 'Regen',
            error: 'Erreur QR',
            loading: 'Generation...',
            copied: 'Token copie.',
            copyFailed: 'Copie impossible.',
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
          confirmRegenerate: 'Regenerer {name} ?',
          confirmRevoke: 'Revoquer {name} ?',
        },
      }),
    };

    await TestBed.configureTestingModule({
      imports: [ApplicationsPage],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        provideHttpClient(),
        { provide: PushitApiService, useValue: api },
        { provide: ConsoleShellService, useValue: shell },
        { provide: ConsoleCopyService, useValue: consoleCopy },
        { provide: AppConfirmService, useValue: confirm },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ApplicationsPage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
  });

  it('navigates to the create page from the add action', () => {
    component.openCreate();

    expect(router.navigate).toHaveBeenCalledWith(['/dashboard/applications/new']);
  });

  it('navigates to the edit page for a row', () => {
    component.openEdit(makeApplication({ id: 102 }));

    expect(router.navigate).toHaveBeenCalledWith(['/dashboard/applications', 102, 'edit']);
  });

  it('navigates to the detail page', () => {
    component.openDetails(makeApplication({ id: 102 }));

    expect(router.navigate).toHaveBeenCalledWith(['/dashboard/applications', 102]);
  });

  it('deletes a confirmed application and refreshes the shell', async () => {
    await component.deleteApp(makeApplication({ id: 102, name: 'Backoffice' }));

    expect(api.deleteApp).toHaveBeenCalledWith(102);
    expect(shell.loadShell).toHaveBeenCalled();
    expect(component.banner()).toBe('Application Backoffice supprimee.');
  });

  it('toggles an application state via the shell and surfaces a banner', () => {
    shell.toggleAppState.and.callFake(
      (_app: ApplicationRead, onDone?: () => void) => onDone?.(),
    );

    component.toggleState(makeApplication({ is_active: true }));

    expect(shell.toggleAppState).toHaveBeenCalled();
    expect(component.banner()).toBe('Application activee.');
  });

  it('refreshes applications with the selected app id', () => {
    component.refreshApplications();

    expect(shell.loadShell).toHaveBeenCalledWith(101);
  });
});
