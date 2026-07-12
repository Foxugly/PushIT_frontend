import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { SKIP_AUTH } from '../http/http-context.tokens';
import {
  AdminStatus,
  AliasStatus,
  AppNotificationCreateRequest,
  AppNotificationFilters,
  ApplicationActivationResponse,
  ApplicationCreateRequest,
  ApplicationCreateResponse,
  ApplicationQuietPeriod,
  ApplicationRead,
  ApplicationRegenerateEmailResponse,
  ApplicationRevokeTokenResponse,
  ApplicationTokenRegenerateResponse,
  ApplicationUpdateRequest,
  DeviceNotificationFilters,
  DeviceNotificationRead,
  DeviceQuietPeriod,
  DeviceLinkRequest,
  DeviceLinkResponse,
  DeviceRead,
  DeviceUpdateRequest,
  Paginated,
  LoginRequest,
  LoginResponse,
  NotificationCreateRequest,
  NotificationFilters,
  NotificationFutureUpdateRequest,
  NotificationQueuedResponse,
  NotificationRead,
  NotificationStats,
  QuietPeriodWrite,
  RegisterPendingResponse,
  RegisterRequest,
  UserMe,
  UserMeUpdateRequest,
} from '../models/api.models';
import { SettingsService } from './settings.service';

@Injectable({ providedIn: 'root' })
export class PushitApiService {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsService);

  forgotPassword(email: string, turnstileToken?: string): Observable<void> {
    const body: { email: string; turnstile_token?: string } = { email };
    if (turnstileToken) body.turnstile_token = turnstileToken;
    return this.http.post<void>(this.url('/auth/forgot-password/'), body, {
      context: new HttpContext().set(SKIP_AUTH, true),
    });
  }

  resetPassword(uid: string, token: string, password: string): Observable<void> {
    return this.http.post<void>(
      this.url('/auth/reset-password/'),
      { uid, token, password },
      { context: new HttpContext().set(SKIP_AUTH, true) },
    );
  }

  register(payload: RegisterRequest): Observable<RegisterPendingResponse> {
    // Account is created pending email confirmation — returns {code, detail, email},
    // no tokens. The user confirms via the emailed link before they can log in.
    return this.http.post<RegisterPendingResponse>(this.url('/auth/register/'), payload, {
      context: new HttpContext().set(SKIP_AUTH, true),
    });
  }

  /** Confirm an email from the uid+token in the emailed link → returns JWT
   * tokens + user (auto-login). */
  confirmEmail(uid: string, token: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      this.url('/auth/email/confirm/'),
      { uid, token },
      { context: new HttpContext().set(SKIP_AUTH, true) },
    );
  }

  /** Re-send the confirmation link (anti-leak: always 200). */
  resendConfirmation(email: string): Observable<void> {
    return this.http.post<void>(
      this.url('/auth/email/resend/'),
      { email },
      { context: new HttpContext().set(SKIP_AUTH, true) },
    );
  }

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.url('/auth/login/'), payload, {
      context: new HttpContext().set(SKIP_AUTH, true),
    });
  }

  /** Request a passwordless sign-in link (anti-leak: always 200). */
  requestMagicLink(email: string, turnstileToken?: string): Observable<void> {
    const body: { email: string; turnstile_token?: string } = { email };
    if (turnstileToken) body.turnstile_token = turnstileToken;
    return this.http.post<void>(this.url('/auth/magic-link/'), body, {
      context: new HttpContext().set(SKIP_AUTH, true),
    });
  }

  /** Exchange a single-use magic-link token for JWT tokens + user (auto-login). */
  verifyMagicLink(token: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      this.url('/auth/magic-link/verify/'),
      { token },
      { context: new HttpContext().set(SKIP_AUTH, true) },
    );
  }

  logout(refresh: string): Observable<void> {
    return this.http.post<void>(this.url('/auth/logout/'), { refresh });
  }

  me(): Observable<UserMe> {
    return this.http.get<UserMe>(this.url('/auth/me/'));
  }

  updateMe(payload: UserMeUpdateRequest): Observable<UserMe> {
    return this.http.patch<UserMe>(this.url('/auth/me/'), payload);
  }

  listApps(): Observable<ApplicationRead[]> {
    return this.http.get<ApplicationRead[]>(this.url('/apps/'));
  }

  createApp(payload: ApplicationCreateRequest): Observable<ApplicationCreateResponse> {
    return this.http.post<ApplicationCreateResponse>(this.url('/apps/'), payload);
  }

  getApp(appId: number): Observable<ApplicationRead> {
    return this.http.get<ApplicationRead>(this.url(`/apps/${appId}/`));
  }

  /** Owner-only probe of the application's inbound email alias (Exchange). */
  getAliasStatus(appId: number): Observable<AliasStatus> {
    return this.http.get<AliasStatus>(this.url(`/apps/${appId}/alias-status/`));
  }

  updateApp(appId: number, payload: ApplicationUpdateRequest): Observable<ApplicationRead> {
    return this.http.patch<ApplicationRead>(this.url(`/apps/${appId}/`), payload);
  }

  deleteApp(appId: number): Observable<void> {
    return this.http.delete<void>(this.url(`/apps/${appId}/`));
  }

  activateApp(appId: number): Observable<ApplicationActivationResponse> {
    return this.http.post<ApplicationActivationResponse>(this.url(`/apps/${appId}/activate/`), {});
  }

  deactivateApp(appId: number): Observable<ApplicationActivationResponse> {
    return this.http.post<ApplicationActivationResponse>(this.url(`/apps/${appId}/deactivate/`), {});
  }

  regenerateAppToken(appId: number): Observable<ApplicationTokenRegenerateResponse> {
    return this.http.post<ApplicationTokenRegenerateResponse>(
      this.url(`/apps/${appId}/regenerate-token/`),
      {},
    );
  }

  revokeAppToken(appId: number): Observable<ApplicationRevokeTokenResponse> {
    return this.http.post<ApplicationRevokeTokenResponse>(this.url(`/apps/${appId}/revoke-token/`), {});
  }

  regenerateAppEmail(appId: number): Observable<ApplicationRegenerateEmailResponse> {
    return this.http.post<ApplicationRegenerateEmailResponse>(
      this.url(`/apps/${appId}/regenerate-email/`),
      {},
    );
  }

  /**
   * QR-code PNG encoding the raw app token (the same string the mobile app
   * scans to link a device). The backend verifies `app_token` against the
   * application's current token, so the caller must hold the raw token — only
   * available right after create/regenerate (it's stored hashed server-side).
   */
  getAppQrCode(appId: number, appToken: string): Observable<Blob> {
    return this.http.post(
      this.url(`/apps/${appId}/qrcode/`),
      { app_token: appToken },
      { responseType: 'blob' },
    );
  }

  uploadAppLogo(appId: number, file: File): Observable<ApplicationRead> {
    const form = new FormData();
    form.append('logo', file);
    return this.http.post<ApplicationRead>(this.url(`/apps/${appId}/logo/`), form);
  }

  deleteAppLogo(appId: number): Observable<void> {
    return this.http.delete<void>(this.url(`/apps/${appId}/logo/`));
  }

  listAppQuietPeriods(appId: number): Observable<ApplicationQuietPeriod[]> {
    return this.http.get<ApplicationQuietPeriod[]>(this.url(`/apps/${appId}/quiet-periods/`));
  }

  getAppQuietPeriod(appId: number, quietPeriodId: number): Observable<ApplicationQuietPeriod> {
    return this.http.get<ApplicationQuietPeriod>(
      this.url(`/apps/${appId}/quiet-periods/${quietPeriodId}/`),
    );
  }

  createAppQuietPeriod(
    appId: number,
    payload: QuietPeriodWrite,
  ): Observable<ApplicationQuietPeriod> {
    return this.http.post<ApplicationQuietPeriod>(this.url(`/apps/${appId}/quiet-periods/`), payload);
  }

  updateAppQuietPeriod(
    appId: number,
    quietPeriodId: number,
    payload: Partial<QuietPeriodWrite>,
  ): Observable<ApplicationQuietPeriod> {
    return this.http.patch<ApplicationQuietPeriod>(
      this.url(`/apps/${appId}/quiet-periods/${quietPeriodId}/`),
      payload,
    );
  }

  deleteAppQuietPeriod(appId: number, quietPeriodId: number): Observable<void> {
    return this.http.delete<void>(this.url(`/apps/${appId}/quiet-periods/${quietPeriodId}/`));
  }

  listDeviceQuietPeriods(deviceId: number): Observable<DeviceQuietPeriod[]> {
    return this.http.get<DeviceQuietPeriod[]>(this.url(`/devices/${deviceId}/quiet-periods/`));
  }

  getDeviceQuietPeriod(
    deviceId: number,
    quietPeriodId: number,
  ): Observable<DeviceQuietPeriod> {
    return this.http.get<DeviceQuietPeriod>(
      this.url(`/devices/${deviceId}/quiet-periods/${quietPeriodId}/`),
    );
  }

  createDeviceQuietPeriod(
    deviceId: number,
    payload: QuietPeriodWrite,
  ): Observable<DeviceQuietPeriod> {
    return this.http.post<DeviceQuietPeriod>(this.url(`/devices/${deviceId}/quiet-periods/`), payload);
  }

  updateDeviceQuietPeriod(
    deviceId: number,
    quietPeriodId: number,
    payload: Partial<QuietPeriodWrite>,
  ): Observable<DeviceQuietPeriod> {
    return this.http.patch<DeviceQuietPeriod>(
      this.url(`/devices/${deviceId}/quiet-periods/${quietPeriodId}/`),
      payload,
    );
  }

  deleteDeviceQuietPeriod(deviceId: number, quietPeriodId: number): Observable<void> {
    return this.http.delete<void>(this.url(`/devices/${deviceId}/quiet-periods/${quietPeriodId}/`));
  }

  listDevices(): Observable<DeviceRead[]> {
    return this.http.get<DeviceRead[]>(this.url('/devices/'));
  }

  getDevice(deviceId: number): Observable<DeviceRead> {
    return this.http.get<DeviceRead>(this.url(`/devices/${deviceId}/`));
  }

  updateDevice(deviceId: number, payload: DeviceUpdateRequest): Observable<DeviceRead> {
    return this.http.put<DeviceRead>(this.url(`/devices/${deviceId}/`), payload);
  }

  deleteDevice(deviceId: number): Observable<void> {
    return this.http.delete<void>(this.url(`/devices/${deviceId}/`));
  }

  linkDevice(appToken: string, payload: DeviceLinkRequest): Observable<DeviceLinkResponse> {
    return this.http.post<DeviceLinkResponse>(this.url('/devices/link/'), payload, {
      headers: new HttpHeaders({ 'X-App-Token': appToken }),
    });
  }

  // Notifications delivered to a device (owner reverse view). Paginated.
  listDeviceNotifications(
    deviceId: number,
    filters: DeviceNotificationFilters = {},
  ): Observable<Paginated<DeviceNotificationRead>> {
    return this.http.get<Paginated<DeviceNotificationRead>>(
      this.url(`/devices/${deviceId}/notifications/`),
      { params: this.buildParams(filters) },
    );
  }

  listNotifications(filters: NotificationFilters): Observable<NotificationRead[]> {
    return this.http.get<NotificationRead[]>(this.url('/notifications/'), {
      params: this.buildParams(filters),
    });
  }

  listFutureNotifications(filters: NotificationFilters): Observable<NotificationRead[]> {
    return this.http.get<NotificationRead[]>(this.url('/notifications/future/'), {
      params: this.buildParams(filters),
    });
  }

  // Server-paginated history (the unbounded list) for the notifications page's
  // lazy table — opt-in via ?page (the bare-array call above stays for counts/SPA).
  listNotificationsPage(
    filters: NotificationFilters,
    page: number,
    pageSize: number,
  ): Observable<Paginated<NotificationRead>> {
    return this.http.get<Paginated<NotificationRead>>(this.url('/notifications/'), {
      params: this.buildParams({ ...filters, page, page_size: pageSize }),
    });
  }

  createNotification(payload: NotificationCreateRequest): Observable<NotificationRead> {
    return this.http.post<NotificationRead>(this.url('/notifications/'), payload);
  }

  // One-call "create and send now" (immediate). Scheduling stays on createNotification
  // (with scheduled_for). No scheduled_for is sent here — the endpoint rejects it.
  sendNotificationNow(
    payload: Omit<NotificationCreateRequest, 'scheduled_for'>,
  ): Observable<NotificationRead> {
    return this.http.post<NotificationRead>(this.url('/notifications/send/'), payload);
  }

  getNotification(notificationId: number): Observable<NotificationRead> {
    return this.http.get<NotificationRead>(this.url(`/notifications/${notificationId}/`));
  }

  getFutureNotification(notificationId: number): Observable<NotificationRead> {
    return this.http.get<NotificationRead>(this.url(`/notifications/future/${notificationId}/`));
  }

  updateFutureNotification(
    notificationId: number,
    payload: NotificationFutureUpdateRequest,
  ): Observable<NotificationRead> {
    return this.http.patch<NotificationRead>(
      this.url(`/notifications/future/${notificationId}/`),
      payload,
    );
  }

  deleteFutureNotification(notificationId: number): Observable<void> {
    return this.http.delete<void>(this.url(`/notifications/future/${notificationId}/`));
  }

  sendNotification(notificationId: number): Observable<NotificationQueuedResponse> {
    return this.http.post<NotificationQueuedResponse>(
      this.url(`/notifications/${notificationId}/send/`),
      {},
    );
  }

  // Cheap counts via opt-in pagination: page_size=1 returns just the envelope's
  // `count`, avoiding loading the whole list into memory just to call .length.
  countNotifications(filters: NotificationFilters): Observable<number> {
    return this.http
      .get<Paginated<unknown>>(this.url('/notifications/'), {
        params: this.buildParams({ ...filters, page: 1, page_size: 1 }),
      })
      .pipe(map((response) => response.count));
  }

  countFutureNotifications(filters: NotificationFilters): Observable<number> {
    return this.http
      .get<Paginated<unknown>>(this.url('/notifications/future/'), {
        params: this.buildParams({ ...filters, page: 1, page_size: 1 }),
      })
      .pipe(map((response) => response.count));
  }

  listNotificationStats(filters?: { application_id?: number | null }): Observable<NotificationStats[]> {
    return this.http.get<NotificationStats[]>(this.url('/notifications/stats/'), {
      params: this.buildParams(filters ?? {}),
    });
  }

  listAppNotifications(
    appToken: string,
    filters: AppNotificationFilters,
  ): Observable<NotificationRead[]> {
    return this.http.get<NotificationRead[]>(this.url('/notifications/app/'), {
      headers: new HttpHeaders({ 'X-App-Token': appToken }),
      params: this.buildParams(filters),
    });
  }

  createAppNotification(
    appToken: string,
    idempotencyKey: string,
    payload: AppNotificationCreateRequest,
  ): Observable<NotificationRead> {
    return this.http.post<NotificationRead>(this.url('/notifications/app/create/'), payload, {
      headers: new HttpHeaders({
        'X-App-Token': appToken,
        'Idempotency-Key': idempotencyKey,
      }),
    });
  }

  /** Admin-only backend health + metrics snapshot. */
  getAdminStatus(): Observable<AdminStatus> {
    return this.http.get<AdminStatus>(this.url('/admin/status/'));
  }

  private url(path: string): string {
    return `${this.settings.apiBaseUrl()}${path}`;
  }

  private buildParams(input: object): HttpParams {
    let params = new HttpParams();

    Object.entries(input as Record<string, unknown>).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        return;
      }

      params = params.set(key, String(value));
    });

    return params;
  }
}
