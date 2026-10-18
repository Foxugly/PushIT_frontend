import { HttpHeaders } from '@angular/common/http';

/**
 * Opt-in to the backend's HttpOnly refresh cookie (PushIT_server
 * `accounts/refresh_cookie.py`). Sent on the auth calls ONLY: the server then
 * sets the refresh token in a `HttpOnly; Secure; SameSite=Lax` cookie scoped
 * to `/api/v1/auth/` on the API host and leaves it out of the JSON body, so
 * no script (and no XSS) can read it. `withCredentials` lets the browser
 * store / send that cookie on these cross-origin calls.
 */
export const AUTH_MODE_HEADER = 'X-Auth-Mode';
export const AUTH_MODE_COOKIE = 'cookie';

export function cookieAuthOptions(): { headers: HttpHeaders; withCredentials: true } {
  return {
    headers: new HttpHeaders({ [AUTH_MODE_HEADER]: AUTH_MODE_COOKIE }),
    withCredentials: true,
  };
}
