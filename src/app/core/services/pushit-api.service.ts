import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { SKIP_AUTH } from '../http/http-context.tokens';
import {
  AppNotificationCreateRequest,
  AppNotificationFilters,
  ApplicationActivationResponse,
  ApplicationCreateRequest,
  ApplicationCreateResponse,
  ApplicationQuietPeriod,
  ApplicationRead,
  ApplicationRevokeTokenResponse,
  ApplicationTokenRegenerateResponse,
  ApplicationUpdateRequest,
  DeviceQuietPeriod,
  DeviceLinkRequest,
  DeviceLinkResponse,
  DeviceRead,
  DeviceUpdateRequest,
  LoginRequest,
  LoginResponse,
  NotificationCreateRequest,
  NotificationFilters,
  NotificationFutureUpdateRequest,
  NotificationQueuedResponse,
  NotificationRead,
  NotificationStats,
  QuietPeriodWrite,
  RegisterRequest,
  UserMe,
  UserMeUpdateRequest,
} from '../models/api.models';
import { SettingsService } from './settings.service';

@Injectable({ providedIn: 'root' })
export class PushitApiService {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsService);

  register(payload: RegisterRequest): Observable<UserMe> {
    return this.http.post<UserMe>(this.url('/auth/register/'), payload, {
      context: new HttpContext().set(SKIP_AUTH, true),
    });
  }

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.url('/auth/login/'), payload, {
      context: new HttpContext().set(SKIP_AUTH, true),
    });
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

  createNotification(payload: NotificationCreateRequest): Observable<NotificationRead> {
    return this.http.post<NotificationRead>(this.url('/notifications/'), payload);
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

  listNotificationStats(): Observable<NotificationStats[]> {
    return this.http.get<NotificationStats[]>(this.url('/notifications/stats/'));
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
