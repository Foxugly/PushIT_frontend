import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';

import { ConsoleCopyService } from '../services/console-copy.service';
import { SessionService } from '../services/session.service';
import { AppConfirmService } from '../../shared/app-confirm-dialog/app-confirm.service';

/** A routed page that can hold edits the user has not saved yet. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/**
 * Asks before leaving a page with unsaved edits for another route.
 * Query-param-only navigations on the same route (e.g. `?tab=`) do not run
 * CanDeactivate, so switching tabs never prompts. Closing / reloading the tab
 * is covered by the page's own `beforeunload` listener.
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (!component?.hasUnsavedChanges()) {
    return true;
  }
  // Logged out (menu, another tab, expired session): the edits can no longer be
  // saved, and « Rester » would strand the user on a page without a session.
  if (!inject(SessionService).isAuthenticated()) {
    return true;
  }
  const copy = inject(ConsoleCopyService).current().unsavedChanges;
  return inject(AppConfirmService).ask({
    title: copy.title,
    message: copy.confirm,
    acceptLabel: copy.leave,
    rejectLabel: copy.stay,
  });
};
