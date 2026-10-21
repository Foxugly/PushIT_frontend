import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { SessionService } from '../services/session.service';
import { documentNavigation, isTurnstileLoaded } from '../../shared/turnstile/turnstile';
import { DEFAULT_RETURN_URL, safeReturnUrl } from '../utils/return-url';

export const authGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionService);
  const router = inject(Router);

  // The session was restored from the HttpOnly refresh cookie at boot (app
  // initializer). An expired access token is fine: the interceptor refreshes it
  // through the cookie, and clears the session if the cookie is rejected.
  if (!session.isAuthenticated()) {
    // Remember the deep link so the login lands back on it (path + query +
    // fragment). The login page re-sanitises it before navigating.
    const returnUrl = safeReturnUrl(state.url);
    return returnUrl === DEFAULT_RETURN_URL
      ? router.createUrlTree(['/auth'])
      : router.createUrlTree(['/auth'], { queryParams: { returnUrl } });
  }
  // Signed in from a document that loaded Cloudflare Turnstile (register,
  // forgot-password or the magic-link form, then an in-app hop to the login):
  // the third-party script would keep running inside the console. Enter it
  // through a full page load instead; the session is restored from the
  // HttpOnly cookie, and the new document never loads Turnstile.
  if (isTurnstileLoaded()) {
    documentNavigation.assign(state.url);
    return false;
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

/** Reserve aux superusers. `is_staff` suffit pour consulter l'etat du backend ;
 *  offrir un acces gratuit engage de l'argent et demande un cran de plus. La
 *  vraie frontiere reste cote serveur (`IsSuperUser`), qui exige la meme chose. */
export const superuserGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);

  return session.isSuperuser() ? true : router.createUrlTree(['/dashboard']);
};

export const guestGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);

  return session.isAuthenticated() ? router.createUrlTree(['/dashboard']) : true;
};
