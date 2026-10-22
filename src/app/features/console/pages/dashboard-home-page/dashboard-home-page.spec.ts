import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { makeApplication, makeNotification } from '../../../../../testing/console-fixtures';
import { provideTestCatalogs } from '../../../../../testing/catalog-store.testing';
import { ApplicationRead, NotificationRead, Paginated } from '../../../../core/models/api.models';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { DashboardHomePage } from './dashboard-home-page';

function page(results: NotificationRead[], count = results.length): Paginated<NotificationRead> {
  return { count, next: null, previous: null, results };
}

describe('DashboardHomePage', () => {
  let fixture: ComponentFixture<DashboardHomePage>;
  let component: DashboardHomePage;
  let listNotificationsPage: ReturnType<typeof vi.fn>;
  let shell: {
    apps: ReturnType<typeof signal<ApplicationRead[]>>;
    devicesCount: ReturnType<typeof signal<number>>;
    notificationsCount: ReturnType<typeof signal<number>>;
    quietPeriodsCount: ReturnType<typeof signal<number>>;
    loaded: ReturnType<typeof signal<boolean>>;
  };

  const recent = [
    makeNotification({ id: 1, title: 'Porte ouverte', status: 'sent', sent_at: '2026-03-27T10:00:00Z' }),
    makeNotification({ id: 2, title: 'Batterie faible', status: 'failed' }),
  ];

  function setUp(feed: { recent: Paginated<NotificationRead>; failures: Paginated<NotificationRead> }): void {
    listNotificationsPage.mockImplementation((filters: { status?: string }) =>
      of(filters.status === 'failed' ? feed.failures : feed.recent),
    );
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function step(key: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="step-${key}"]`);
  }

  beforeEach(async () => {
    listNotificationsPage = vi.fn();
    shell = {
      apps: signal<ApplicationRead[]>([]),
      devicesCount: signal(0),
      notificationsCount: signal(0),
      quietPeriodsCount: signal(0),
      loaded: signal(true),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardHomePage],
      providers: [
        provideRouter([]),
        provideTestCatalogs(),
        { provide: PushitApiService, useValue: { listNotificationsPage } },
        { provide: ConsoleShellService, useValue: shell },
      ],
    }).compileComponents();
  });

  function create(): void {
    fixture = TestBed.createComponent(DashboardHomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('shows the « Pour commencer » checklist to a new account, nothing ticked', () => {
    setUp({ recent: page([]), failures: page([]) });
    create();

    expect(text()).toContain('Pour commencer');
    expect(text()).toContain('0 sur 3 terminées');
    expect(step('app')?.dataset['done']).toBe('false');
    expect(step('device')?.dataset['done']).toBe('false');
    expect(step('notification')?.dataset['done']).toBe('false');
    // The first step not done carries the primary call-to-action.
    expect(component.nextStepKey()).toBe('app');
    const appCta = step('app')?.querySelector('a');
    expect(appCta?.getAttribute('href')).toBe('/dashboard/applications/new');
  });

  it('ticks the steps from real data and points the next one at the app QR code', () => {
    setUp({ recent: page([]), failures: page([]) });
    shell.apps.set([makeApplication({ id: 7 })]);
    create();

    expect(step('app')?.dataset['done']).toBe('true');
    expect(step('device')?.dataset['done']).toBe('false');
    expect(text()).toContain('1 sur 3 terminées');
    expect(step('device')?.querySelector('a')?.getAttribute('href')).toBe(
      '/dashboard/applications/7?tab=recipients',
    );
    expect(step('notification')?.querySelector('a')?.getAttribute('href')).toBe(
      '/dashboard/notifications?create=1&app=7',
    );

    shell.devicesCount.set(1);
    fixture.detectChanges();
    expect(step('device')?.dataset['done']).toBe('true');
    expect(component.nextStepKey()).toBe('notification');
  });

  it('hides the checklist once every step is done', () => {
    setUp({ recent: page(recent), failures: page([]) });
    shell.apps.set([makeApplication()]);
    shell.devicesCount.set(2);
    create();

    expect(component.showGettingStarted()).toBe(false);
    expect(text()).not.toContain('Pour commencer');
  });

  it('does not flash the checklist before the shell has loaded', () => {
    setUp({ recent: page([]), failures: page([]) });
    shell.loaded.set(false);
    create();

    expect(text()).not.toContain('Pour commencer');
  });

  it('lists the latest notifications and the recent failures, failures highlighted', () => {
    setUp({ recent: page(recent, 12), failures: page([recent[1]], 3) });
    shell.apps.set([makeApplication()]);
    shell.devicesCount.set(1);
    create();

    expect(listNotificationsPage).toHaveBeenCalledWith({}, 1, 5);
    expect(listNotificationsPage).toHaveBeenCalledWith({ status: 'failed' }, 1, 5);

    const element = fixture.nativeElement as HTMLElement;
    const recentBlock = element.querySelector('[data-testid="dashboard-recent"]')!;
    expect(recentBlock.textContent).toContain('Porte ouverte');
    expect(recentBlock.textContent).toContain('Envoyée');
    expect(recentBlock.querySelectorAll('.dashboard-home__feed-item--failed').length).toBe(1);
    expect(recentBlock.querySelector('a[href="/dashboard/notifications/1"]')).not.toBeNull();

    const failuresBlock = element.querySelector('[data-testid="dashboard-failures"]')!;
    expect(failuresBlock.textContent).toContain('Batterie faible');
    const viewFailures = failuresBlock.querySelector('a.dashboard-home__view-all');
    expect(viewFailures?.getAttribute('href')).toBe('/dashboard/notifications?status=failed');
    expect(viewFailures?.textContent).toContain('(3)');
  });

  it('shows reassuring empty blocks when nothing failed', () => {
    setUp({ recent: page([recent[0]]), failures: page([]) });
    shell.apps.set([makeApplication()]);
    shell.devicesCount.set(1);
    create();

    expect(text()).toContain('Aucun échec : tout est bien parti.');
  });

  it('turns every counter into a link to its list', () => {
    setUp({ recent: page([]), failures: page([]) });
    create();

    const hrefs = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('a.dashboard-home__metric'),
    ).map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual([
      '/dashboard/applications',
      '/dashboard/applications',
      '/dashboard/devices',
      '/dashboard/notifications',
      '/dashboard/quiet-periods',
    ]);
  });

  it('offers the quick actions', () => {
    setUp({ recent: page([]), failures: page([]) });
    create();

    const actions = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="dashboard-quick-actions"]',
    )!;
    const hrefs = Array.from(actions.querySelectorAll('a')).map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(['/dashboard/applications/new', '/dashboard/notifications?create=1']);
    expect(actions.textContent).toContain('Nouvelle application');
    expect(actions.textContent).toContain('Nouvelle notification');
  });

  it('keeps the checklist hidden and says so when the feed fails', () => {
    listNotificationsPage.mockReturnValue(throwError(() => new Error('boom')));
    create();

    expect(component.feedError()).toBe(true);
    expect(text()).not.toContain('Pour commencer');
    expect(text()).toContain('Impossible de charger les notifications.');
  });
});
