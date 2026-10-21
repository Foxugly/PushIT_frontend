import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { SessionService } from '../../../../core/services/session.service';
import { provideTestCatalogs } from '../../../../../testing/catalog-store.testing';
import frCatalog from '../../../../../../public/i18n/fr.json';
import { ConsoleNavigation } from './console-navigation';

const NAV = frCatalog.app.console.navigation;

describe('ConsoleNavigation', () => {
  let fixture: ComponentFixture<ConsoleNavigation>;
  const isAdmin = signal(false);
  const isSuperuser = signal(false);

  beforeEach(async () => {
    isAdmin.set(false);
    isSuperuser.set(false);
    await TestBed.configureTestingModule({
      imports: [ConsoleNavigation],
      providers: [
        provideRouter([]),
        provideTestCatalogs(),
        { provide: SessionService, useValue: { isAdmin, isSuperuser } },
        {
          provide: ConsoleShellService,
          useValue: {
            apps: signal([{ id: 1 }, { id: 2 }]),
            devicesCount: signal(3),
            notificationsCount: signal(4),
            quietPeriodsCount: signal(0),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ConsoleNavigation);
  });

  function links(): string[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a')).map(
      (a) => a.getAttribute('href') ?? '',
    );
  }

  it('lists « Mon compte » with the other console entries', () => {
    fixture.detectChanges();
    expect(links()).toEqual([
      '/dashboard/applications',
      '/dashboard/devices',
      '/dashboard/notifications',
      '/dashboard/quiet-periods',
      '/dashboard/billing',
      '/dashboard/settings',
    ]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(NAV.account.label);
  });

  it('adds the staff entries only for staff users', () => {
    isSuperuser.set(true);
    isAdmin.set(true);
    fixture.detectChanges();
    expect(links().slice(-2)).toEqual(['/dashboard/accounts', '/dashboard/admin']);
  });

  it('renders the compact drawer variant with counts but no descriptions', () => {
    fixture.componentRef.setInput('variant', 'drawer');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="console-drawer-nav"]')).not.toBeNull();
    expect(el.querySelector('app-console-menu-item')).toBeNull();
    expect(el.querySelectorAll('.console-drawer-nav__link')).toHaveLength(6);
    const badges = Array.from(el.querySelectorAll('.console-drawer-nav__badge')).map((b) =>
      b.textContent?.trim(),
    );
    expect(badges).toEqual(['2', '3', '4', '0']);
    expect(el.textContent).not.toContain(NAV.account.description);
  });
});
