import { Page } from '@playwright/test';

type User = {
  id: number;
  email: string;
  username: string;
  userkey: string;
  is_active: boolean;
  language: 'FR' | 'NL' | 'EN';
};

type Application = {
  id: number;
  name: string;
  description: string;
  app_token_prefix: string;
  inbound_email_alias: string;
  inbound_email_address: string;
  is_active: boolean;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
};

type Device = {
  id: number;
  device_name: string;
  platform: 'ios' | 'android';
  push_token_status: 'active' | 'invalid' | 'revoked';
  last_seen_at: string | null;
  created_at: string;
  application_ids: number[];
};

type Notification = {
  id: number;
  application_id: number;
  application_name: string;
  device_ids: number[];
  title: string;
  message: string;
  status: string;
  created_at: string;
  scheduled_for: string | null;
  effective_scheduled_for: string | null;
  sent_at: string | null;
};

type QuietPeriod = unknown[];

type ConsoleState = {
  user: User;
  apps: Application[];
  devices: Device[];
  notifications: Notification[];
  futureNotifications: Notification[];
  stats?: Array<{ status: string; count: number }>;
  appQuietPeriods?: Record<number, QuietPeriod>;
  deviceQuietPeriods?: Record<number, QuietPeriod>;
};

export async function seedAuthenticatedSession(page: Page, user: User): Promise<void> {
  await page.addInitScript(([storedUser]) => {
    localStorage.setItem('pushit.accessToken', 'access-token');
    localStorage.setItem('pushit.refreshToken', 'refresh-token');
    localStorage.setItem('pushit.user', JSON.stringify(storedUser));
  }, [user]);
}

export async function mockConsoleApi(page: Page, initialState: ConsoleState): Promise<ConsoleState> {
  const state: ConsoleState = {
    ...initialState,
    apps: [...initialState.apps],
    devices: [...initialState.devices],
    notifications: [...initialState.notifications],
    futureNotifications: [...initialState.futureNotifications],
    stats: initialState.stats ?? [],
    appQuietPeriods: { ...(initialState.appQuietPeriods ?? {}) },
    deviceQuietPeriods: { ...(initialState.deviceQuietPeriods ?? {}) },
  };

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path.endsWith('/auth/me/') && method === 'GET') {
      return fulfillJson(route, 200, state.user);
    }

    if (path.endsWith('/apps/') && method === 'GET') {
      return fulfillJson(route, 200, state.apps);
    }

    const appDetailMatch = path.match(/\/api\/v1\/apps\/(\d+)\/$/);
    if (appDetailMatch && method === 'GET') {
      const appId = Number(appDetailMatch[1]);
      const app = state.apps.find((item) => item.id === appId);
      return fulfillJson(route, app ? 200 : 404, app ?? { detail: 'Not found.' });
    }

    if (appDetailMatch && method === 'DELETE') {
      const appId = Number(appDetailMatch[1]);
      state.apps = state.apps.filter((item) => item.id !== appId);
      return route.fulfill({ status: 204, body: '' });
    }

    const appQuietPeriodsMatch = path.match(/\/api\/v1\/apps\/(\d+)\/quiet-periods\/$/);
    if (appQuietPeriodsMatch && method === 'GET') {
      const appId = Number(appQuietPeriodsMatch[1]);
      return fulfillJson(route, 200, state.appQuietPeriods?.[appId] ?? []);
    }

    if (path.endsWith('/devices/') && method === 'GET') {
      return fulfillJson(route, 200, state.devices);
    }

    const deviceDetailMatch = path.match(/\/api\/v1\/devices\/(\d+)\/$/);
    if (deviceDetailMatch && method === 'GET') {
      const deviceId = Number(deviceDetailMatch[1]);
      const device = state.devices.find((item) => item.id === deviceId);
      return fulfillJson(route, device ? 200 : 404, device ?? { detail: 'Not found.' });
    }

    const deviceQuietPeriodsMatch = path.match(/\/api\/v1\/devices\/(\d+)\/quiet-periods\/$/);
    if (deviceQuietPeriodsMatch && method === 'GET') {
      const deviceId = Number(deviceQuietPeriodsMatch[1]);
      return fulfillJson(route, 200, state.deviceQuietPeriods?.[deviceId] ?? []);
    }

    if (path.endsWith('/notifications/stats/') && method === 'GET') {
      return fulfillJson(route, 200, state.stats ?? []);
    }

    if (path.endsWith('/notifications/') && method === 'GET') {
      return fulfillJson(route, 200, state.notifications);
    }

    if (path.endsWith('/notifications/future/') && method === 'GET') {
      return fulfillJson(route, 200, state.futureNotifications);
    }

    const notificationMatch = path.match(/\/api\/v1\/notifications\/(\d+)\/$/);
    if (notificationMatch && method === 'GET') {
      const notificationId = Number(notificationMatch[1]);
      const notification =
        state.futureNotifications.find((item) => item.id === notificationId) ??
        state.notifications.find((item) => item.id === notificationId);
      return fulfillJson(route, notification ? 200 : 404, notification ?? { detail: 'Not found.' });
    }

    const futureNotificationMatch = path.match(/\/api\/v1\/notifications\/future\/(\d+)\/$/);
    if (futureNotificationMatch) {
      const notificationId = Number(futureNotificationMatch[1]);

      if (method === 'GET') {
        const notification = state.futureNotifications.find((item) => item.id === notificationId);
        return fulfillJson(route, notification ? 200 : 404, notification ?? { detail: 'Not found.' });
      }

      if (method === 'DELETE') {
        state.futureNotifications = state.futureNotifications.filter((item) => item.id !== notificationId);
        return route.fulfill({ status: 204, body: '' });
      }
    }

    return route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ detail: `Unhandled route: ${method} ${path}` }),
    });
  });

  return state;
}

async function fulfillJson(route: Parameters<Page['route']>[1] extends (route: infer T) => unknown ? T : never, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}
