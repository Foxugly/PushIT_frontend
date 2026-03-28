import {
  ApplicationRead,
  DeviceRead,
  NotificationRead,
  NotificationStats,
  NotificationStatus,
  UserMe,
} from '../app/core/models/api.models';

export function makeUser(overrides: Partial<UserMe> = {}): UserMe {
  return {
    id: 1,
    email: 'renaud@example.com',
    username: 'renaud',
    userkey: 'usr_123456',
    is_active: true,
    language: 'FR',
    ...overrides,
  };
}

export function makeApplication(overrides: Partial<ApplicationRead> = {}): ApplicationRead {
  return {
    id: 101,
    name: 'PushIT Mobile',
    description: 'Application mobile',
    app_token_prefix: 'apt_12345678',
    inbound_email_alias: 'apt_fc4471fe12345678',
    inbound_email_address: 'apt_fc4471fe12345678@pushit.com',
    is_active: true,
    revoked_at: null,
    last_used_at: null,
    created_at: '2026-03-27T12:00:00Z',
    ...overrides,
  };
}

export function makeDevice(overrides: Partial<DeviceRead> = {}): DeviceRead {
  return {
    id: 201,
    device_name: 'iPhone de Renaud',
    platform: 'ios',
    push_token_status: 'active',
    last_seen_at: '2026-03-27T18:00:00Z',
    created_at: '2026-03-26T10:00:00Z',
    application_ids: [101],
    ...overrides,
  };
}

export function makeNotification(overrides: Partial<NotificationRead> = {}): NotificationRead {
  return {
    id: 301,
    application_id: 101,
    application_name: 'PushIT Mobile',
    device_ids: [201],
    title: 'Promo flash',
    message: 'Disponible maintenant.',
    status: 'draft',
    created_at: '2026-03-27T10:00:00Z',
    scheduled_for: null,
    effective_scheduled_for: null,
    sent_at: null,
    ...overrides,
  };
}

export function makeNotificationStat(
  status: NotificationStatus,
  count: number,
): NotificationStats {
  return { status, count };
}
