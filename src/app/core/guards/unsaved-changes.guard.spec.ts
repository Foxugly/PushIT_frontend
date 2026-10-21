import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { vi } from 'vitest';

import frCatalog from '../../../../public/i18n/fr.json';
import { ConsoleCopyService } from '../services/console-copy.service';
import { SessionService } from '../services/session.service';
import { AppConfirmService } from '../../shared/app-confirm-dialog/app-confirm.service';
import { HasUnsavedChanges, unsavedChangesGuard } from './unsaved-changes.guard';

describe('unsavedChangesGuard', () => {
  let ask: ReturnType<typeof vi.fn>;
  let isAuthenticated: ReturnType<typeof signal<boolean>>;
  const route = {} as ActivatedRouteSnapshot;
  const state = { url: '/dashboard/applications/101' } as RouterStateSnapshot;
  const next = { url: '/dashboard/devices' } as RouterStateSnapshot;

  function run(dirty: boolean) {
    const component: HasUnsavedChanges = { hasUnsavedChanges: () => dirty };
    return TestBed.runInInjectionContext(() => unsavedChangesGuard(component, route, state, next));
  }

  beforeEach(() => {
    ask = vi.fn();
    isAuthenticated = signal(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: AppConfirmService, useValue: { ask } },
        { provide: SessionService, useValue: { isAuthenticated } },
        { provide: ConsoleCopyService, useValue: { current: signal(frCatalog.console) } },
      ],
    });
  });

  it('lets a clean page go without asking', () => {
    expect(run(false)).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });

  it('asks before leaving with unsaved changes, and follows the answer', async () => {
    ask.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await expect(run(true)).resolves.toBe(false);
    await expect(run(true)).resolves.toBe(true);

    expect(ask).toHaveBeenCalledWith({
      title: 'Modifications non enregistrées',
      message: 'Vous avez des modifications non enregistrées. Quitter sans enregistrer ?',
      acceptLabel: 'Quitter sans enregistrer',
      rejectLabel: 'Rester',
    });
  });

  it('does not hold a logged-out user on the page', () => {
    isAuthenticated.set(false);

    expect(run(true)).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });
});
