import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';

import { makeApplication } from '../../../../../testing/console-fixtures';
import { ApplicationRead } from '../../../../core/models/api.models';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { ApplicationsPage } from './applications-page';

describe('ApplicationsPage', () => {
  let fixture: ComponentFixture<ApplicationsPage>;
  let component: ApplicationsPage;
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
            open: 'Ouvrir',
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
        { provide: ConsoleShellService, useValue: shell },
        { provide: ConsoleCopyService, useValue: consoleCopy },
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

  it('navigates to the detail page', () => {
    component.openDetails(makeApplication({ id: 102 }));

    expect(router.navigate).toHaveBeenCalledWith(['/dashboard/applications', 102]);
  });

  it('toggles an application state via the shell and surfaces a banner', () => {
    shell.toggleAppState.and.callFake(
      (_app: ApplicationRead, onDone?: () => void) => onDone?.(),
    );

    component.toggleState(makeApplication({ is_active: true }));

    expect(shell.toggleAppState).toHaveBeenCalled();
    // Deactivating an active app says so (the banner used to be inverted).
    expect(component.banner()).toBe('Application desactivee.');

    component.toggleState(makeApplication({ is_active: false }));
    expect(component.banner()).toBe('Application activee.');
  });

  it('offers exactly three row actions: enrolment QR, activate/deactivate, open', () => {
    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="app-row"]'));
    expect(rows.length).toBe(2);

    const labels = Array.from(rows[0].querySelectorAll('.console-icon-actions button')).map((button) =>
      button.getAttribute('aria-label'),
    );
    expect(labels).toEqual(['QR code', 'Desactiver', 'Ouvrir']);
    // The inactive app offers "Activer" instead.
    const inactiveLabels = Array.from(rows[1].querySelectorAll('.console-icon-actions button')).map((button) =>
      button.getAttribute('aria-label'),
    );
    expect(inactiveLabels).toEqual(['QR code', 'Activer', 'Ouvrir']);
  });

  it('opens the application when its row is clicked', () => {
    const row: HTMLElement = fixture.nativeElement.querySelector('[data-testid="app-row"]');
    row.querySelector<HTMLElement>('td:nth-child(2)')!.click();

    expect(router.navigate).toHaveBeenCalledWith(['/dashboard/applications', 101]);
  });

  it('row actions do not also trigger the row navigation', () => {
    const row: HTMLElement = fixture.nativeElement.querySelector('[data-testid="app-row"]');
    const qrButton = row.querySelector<HTMLElement>('button[aria-label="QR code"]')!;

    qrButton.click();

    expect(component.qrApp()?.id).toBe(101);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('keeps the application name as a keyboard-focusable link', () => {
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('[data-testid="app-row"] a.console-table__link');

    expect(link.getAttribute('href')).toBe('/dashboard/applications/101');
  });

  it('refreshes applications with the selected app id', () => {
    component.refreshApplications();

    expect(shell.loadShell).toHaveBeenCalledWith(101);
  });
});
