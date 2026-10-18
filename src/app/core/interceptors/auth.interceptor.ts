import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, EMPTY, switchMap, throwError } from 'rxjs';

import { RETRY_ON_AUTH_FAILURE, SKIP_AUTH } from '../http/http-context.tokens';
import { SessionService } from '../services/session.service';

/** 401/403 from `auth/refresh/` = refresh token rejected (expired, blacklisted). */
function isInvalidRefresh(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403);
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionService);

  if (req.context.get(SKIP_AUTH)) {
    return next(req);
  }

  const accessToken = session.accessToken();
  const usesUserAuth = !req.headers.has('X-App-Token');
  const shouldAttachToken = Boolean(usesUserAuth && accessToken && !req.headers.has('Authorization'));

  const authorizedRequest = shouldAttachToken
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
    : req;

  return next(authorizedRequest).pipe(
    catchError((error: unknown) => {
      const httpError = error as HttpErrorResponse;

      if (
        httpError.status !== 401 ||
        !usesUserAuth ||
        !session.refreshToken() ||
        !authorizedRequest.context.get(RETRY_ON_AUTH_FAILURE)
      ) {
        if (httpError.status === 401 && usesUserAuth) {
          session.clear(true);
          return EMPTY;
        }

        return throwError(() => error);
      }

      return session.refreshAccessToken().pipe(
        switchMap((newAccessToken) =>
          next(
            authorizedRequest.clone({
              setHeaders: {
                Authorization: `Bearer ${newAccessToken}`,
              },
              context: authorizedRequest.context.set(RETRY_ON_AUTH_FAILURE, false),
            }),
          ),
        ),
        catchError((refreshError: unknown) => {
          // Only a rejected refresh token ends the session. A network error or
          // a 5xx (e.g. backend restarting during a deploy) keeps the tokens:
          // the error reaches the caller and the next call retries the refresh.
          if (isInvalidRefresh(refreshError)) {
            session.clear(true);
          }
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
