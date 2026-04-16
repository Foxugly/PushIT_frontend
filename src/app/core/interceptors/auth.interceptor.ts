import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, EMPTY, switchMap, throwError } from 'rxjs';

import { RETRY_ON_AUTH_FAILURE, SKIP_AUTH } from '../http/http-context.tokens';
import { SessionService } from '../services/session.service';

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
        catchError((refreshError) => {
          session.clear(true);
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
