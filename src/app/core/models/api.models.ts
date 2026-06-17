export type NotificationStatus =
  | 'draft'
  | 'scheduled'
  | 'queued'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'partial'
  | 'no_target';

export type DevicePlatform = 'android' | 'ios';
export type PushTokenStatus = 'active' | 'invalid' | 'revoked';
export type NotificationOrdering = 'effective_scheduled_for' | '-effective_scheduled_for';
export type UserLanguage = 'FR' | 'NL' | 'EN';
export type QuietPeriodType = 'ONCE' | 'RECURRING';
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ApiErrorResponse {
  code: string;
  detail: string;
  errors?: Record<string, string[]>;
  incident_id?: string;
}

export interface UserMe {
  id: number;
  email: string;
  userkey: string;
  is_active: boolean;
  email_confirmed?: boolean;
  language: UserLanguage;
}

/** Response of POST /auth/register/ — the account is created but pending email
 * confirmation (no tokens). The user must click the emailed link before login. */
export interface RegisterPendingResponse {
  code: string;
  detail: string;
  email: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  language: UserLanguage;
  /** Cloudflare Turnstile token; sent only when the widget is provisioned. */
  turnstile_token?: string;
}

export interface UserMeUpdateRequest {
  language?: UserLanguage;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: UserMe;
}

export interface TokenRefreshResponse {
  access: string;
  // The backend rotates + blacklists refresh tokens (ROTATE_REFRESH_TOKENS +
  // BLACKLIST_AFTER_ROTATION), so a fresh refresh is returned and MUST be
  // persisted — otherwise the next refresh presents a blacklisted token.
  refresh?: string;
}

export interface ApplicationRead {
  id: number;
  name: string;
  description: string;
  app_token_prefix: string;
  inbound_email_alias: string;
  inbound_email_address: string;
  logo: string | null;
  is_active: boolean;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface ApplicationCreateRequest {
  name: string;
  description: string;
}

export interface ApplicationUpdateRequest {
  name?: string;
  description?: string;
}

export interface ApplicationCreateResponse extends ApplicationRead {
  app_token: string;
}

export interface ApplicationActivationResponse {
  app_id: number;
  is_active: boolean;
}

export interface ApplicationTokenRegenerateResponse {
  app_id: number;
  app_token_prefix: string;
  new_app_token: string;
}

export interface ApplicationRevokeTokenResponse {
  app_id: number;
  revoked_at: string | null;
}

export interface ApplicationRegenerateEmailResponse {
  app_id: number;
  inbound_email_alias: string;
  inbound_email_address: string;
}

export interface QuietPeriod {
  id: number;
  name: string;
  period_type: QuietPeriodType;
  start_at: string | null;
  end_at: string | null;
  recurrence_days: Weekday[];
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApplicationQuietPeriod extends QuietPeriod {
  application: number;
}

export interface DeviceQuietPeriod extends QuietPeriod {
  device: number;
}

export interface QuietPeriodWrite {
  name: string;
  period_type: QuietPeriodType;
  start_at?: string | null;
  end_at?: string | null;
  recurrence_days?: Weekday[];
  start_time?: string | null;
  end_time?: string | null;
  is_active: boolean;
}

export type UnlinkSource = 'device_button' | 'inbox' | 'takeover' | '';

export interface DeviceUnlinkedApplication {
  application_id: number;
  application_name: string;
  unlinked_at: string | null;
  unlink_source: UnlinkSource;
}

export interface DeviceRead {
  id: number;
  device_name: string;
  platform: DevicePlatform;
  push_token_status: PushTokenStatus;
  last_seen_at: string | null;
  created_at: string;
  application_ids: number[];
  // Past (deactivated) links, with audit — lets the console explain a device that
  // received notifications from an app it's no longer linked to.
  unlinked_applications: DeviceUnlinkedApplication[];
}

export interface DeviceUpdateRequest {
  device_name: string;
  platform: DevicePlatform;
  push_token_status: PushTokenStatus;
}

export interface DeviceLinkRequest {
  device_name: string;
  platform: DevicePlatform;
  push_token: string;
}

export interface DeviceLinkResponse {
  status: string;
  device_id: number;
  device_created: boolean;
  link_created: boolean;
  application_id: number;
}

export interface NotificationRead {
  id: number;
  application_id: number;
  application_name: string;
  application_logo: string | null;
  device_ids: number[];
  title: string;
  message: string;
  status: NotificationStatus;
  created_at: string;
  scheduled_for: string | null;
  effective_scheduled_for: string | null;
  sent_at: string | null;
  // Per-device delivery breakdown — only the single-notification detail endpoint
  // populates it; absent on list responses.
  deliveries?: NotificationDelivery[];
}

export interface NotificationDelivery {
  device_id: number;
  device_name: string;
  status: DeliveryStatus;
  sent_at: string | null;
  // Recipient-side receipts (null until the device reports them). opened_at is
  // reliable (the user opened the message in the app); delivered_at is best-effort
  // OS-level receipt (currently only backfilled from opened_at — see Phase 2).
  delivered_at: string | null;
  opened_at: string | null;
  attempt_count: number;
}

export interface NotificationCreateRequest {
  application_id: number;
  device_ids: number[];
  title: string;
  message: string;
  scheduled_for: string | null;
}

export interface NotificationFutureUpdateRequest {
  title: string;
  message: string;
  scheduled_for: string | null;
}

export interface AppNotificationCreateRequest {
  title: string;
  message: string;
  scheduled_for: string | null;
}

export interface NotificationQueuedResponse {
  status: string;
  notification_id: number;
  task_id: string;
}

export interface NotificationStats {
  status: string;
  count: number;
}

export interface NotificationFilters {
  application_id?: number | null;
  device_id?: number | null;
  status?: NotificationStatus | '' | null;
  effective_scheduled_from?: string | null;
  effective_scheduled_to?: string | null;
  has_quiet_period_shift?: boolean | null;
  ordering?: NotificationOrdering | '' | null;
}

export interface AppNotificationFilters {
  status?: NotificationStatus | '' | null;
  effective_scheduled_from?: string | null;
  effective_scheduled_to?: string | null;
  has_quiet_period_shift?: boolean | null;
  ordering?: NotificationOrdering | '' | null;
}

export type DeliveryStatus = 'pending' | 'sent' | 'failed';

/** A notification as delivered to one device (owner reverse view). */
export interface DeviceNotificationRead {
  id: number;
  application_id: number;
  application_name: string;
  application_logo: string | null;
  title: string;
  message: string;
  status: NotificationStatus;
  created_at: string;
  sent_at: string | null;
  delivery_status: DeliveryStatus | null;
  delivery_sent_at: string | null;
  delivery_attempt_count: number;
}

/** DRF PageNumberPagination envelope. */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface DeviceNotificationFilters {
  application_id?: number | null;
  page?: number | null;
}
