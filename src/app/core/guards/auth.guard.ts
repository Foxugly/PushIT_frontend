import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { SessionService } from '../services/session.service';

export const authGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);

  if (!session.isAuthenticated()) {
    return router.createUrlTree(['/auth']);
  }

  // Dead session: the access token is expired AND there's no refresh token to
  // recover from it → don't render a protected page that will only 401. (An
  // expired token WITH a refresh token is fine — the interceptor refreshes it.)
  if (session.accessTokenExpired() && !session.refreshToken()) {
    session.clear();
    return router.createUrlTree(['/auth']);
  }

  return true;
};

/**
 * Admin-only routes. Composed after `authGuard` (which guarantees a live
 * session); here we only check the staff flag. Non-staff users are bounced
 * back to the dashboard rather than the login screen.
 */
export const adminGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);

  return session.isAdmin() ? true : router.createUrlTree(['/dashboard']);
};

export const guestGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);

  return session.isAuthenticated() ? router.createUrlTree(['/dashboard']) : true;
};
