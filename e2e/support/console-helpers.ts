import { Page } from '@playwright/test';

type User = {
  id: number;
  email: string;
  userkey: string;
  is_active: boolean;
  language: 'FR' | 'NL' | 'EN';
};

type Application = {
  id: number;
  name: string;
  description: string;
  app_token_prefix: string;
  // Distributed in clear (the QR carries it); never a send credential.
  enrolment_code: string;
  enrolment_code_rotated_at: string | null;
  // Non-null = this application still SENDS with the legacy token.
  legacy_send_last_used_at: string | null;
  inbound_email_alias: string;
  inbound_email_address: string;
  is_active: boolean;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
  logo?: string | null;
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

type SendToken = {
  id: number;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  is_active: boolean;
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
  sendTokens?: Record<number, SendToken[]>;
};

export async function seedAuthenticatedSession(page: Page, user: User): Promise<void> {
  await page.addInitScript(([storedUser]) => {
    localStorage.setItem('pushit.accessToken', 'access-token');
    localStorage.setItem('pushit.refreshToken', 'refresh-token');
    localStorage.setItem('pushit.user', JSON.stringify(storedUser));
  }, [user]);
}

/**
 * Mock the login endpoint so the auth page can complete a successful sign-in
 * without a backend. Register this AFTER mockConsoleApi: Playwright matches the
 * most recently registered route first, so this specific /auth/login/ handler
 * must come last to win over the generic /api/v1/** console catch-all.
 */
export async function mockLogin(page: Page, user: User): Promise<void> {
  await page.route('**/api/v1/auth/login/', async (route) => {
    if (route.request().method() !== 'POST') {
      return route.fallback();
    }
    return fulfillJson(route, 200, {
      access: 'access-token',
      refresh: 'refresh-token',
      user,
    });
  });
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
    sendTokens: { ...(initialState.sendTokens ?? {}) },
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

    // Create an application: returns the freshly-minted one-time raw token
    // (app_token) alongside the created app, mirroring ApplicationCreateResponse.
    if (path.endsWith('/apps/') && method === 'POST') {
      const payload = (request.postDataJSON() ?? {}) as { name?: string; description?: string };
      const id = state.apps.reduce((max, item) => Math.max(max, item.id), 0) + 1;
      const created: Application = {
        id,
        name: payload.name ?? '',
        description: payload.description ?? '',
        app_token_prefix: `apt_new${id}`,
        enrolment_code: `apk_new${id}code`,
        enrolment_code_rotated_at: null,
        legacy_send_last_used_at: null,
        inbound_email_alias: `apt_new${id}alias`,
        inbound_email_address: `apt_new${id}alias@pushit.com`,
        is_active: true,
        revoked_at: null,
        last_used_at: null,
        created_at: new Date().toISOString(),
      };
      state.apps = [...state.apps, created];
      return fulfillJson(route, 201, { ...created, app_token: `apt_new${id}_rawsecret` });
    }

    // Send tokens: list / create / revoke / reveal. The raw value is served by
    // the creation and by a reveal that re-checks the password — never by the
    // list, which is the whole point of the split.
    const sendTokensMatch = path.match(/\/api\/v1\/apps\/(\d+)\/send-tokens\/$/);
    if (sendTokensMatch && method === 'GET') {
      const appId = Number(sendTokensMatch[1]);
      return fulfillJson(route, 200, state.sendTokens?.[appId] ?? []);
    }
    if (sendTokensMatch && method === 'POST') {
      const appId = Number(sendTokensMatch[1]);
      const payload = (request.postDataJSON() ?? {}) as { name?: string };
      const existing = state.sendTokens?.[appId] ?? [];
      const created: SendToken = {
        id: existing.reduce((max, item) => Math.max(max, item.id), 0) + 1,
        name: payload.name ?? '',
        prefix: 'apt_new1',
        created_at: new Date().toISOString(),
        last_used_at: null,
        revoked_at: null,
        is_active: true,
      };
      state.sendTokens = { ...state.sendTokens, [appId]: [...existing, created] };
      return fulfillJson(route, 201, { ...created, token: 'apt_new1rawsecret000000' });
    }

    const sendTokenRevealMatch = path.match(/\/api\/v1\/apps\/(\d+)\/send-tokens\/(\d+)\/reveal\/$/);
    if (sendTokenRevealMatch && method === 'POST') {
      const payload = (request.postDataJSON() ?? {}) as { password?: string };
      if (payload.password !== 'hunter2') {
        return fulfillJson(route, 403, { code: 'invalid_password', detail: 'Mot de passe incorrect.' });
      }
      return fulfillJson(route, 200, { token: 'apt_revealedrawsecret00' });
    }

    const sendTokenMatch = path.match(/\/api\/v1\/apps\/(\d+)\/send-tokens\/(\d+)\/$/);
    if (sendTokenMatch && method === 'DELETE') {
      const appId = Number(sendTokenMatch[1]);
      const tokenId = Number(sendTokenMatch[2]);
      state.sendTokens = {
        ...state.sendTokens,
        [appId]: (state.sendTokens?.[appId] ?? []).map((item) =>
          item.id === tokenId
            ? { ...item, is_active: false, revoked_at: new Date().toISOString() }
            : item,
        ),
      };
      return route.fulfill({ status: 204, body: '' });
    }

    // Rotate the enrolment code: closes the door to newcomers, evicts nobody —
    // the device links are deliberately left untouched here, like server-side.
    const rotateMatch = path.match(/\/api\/v1\/apps\/(\d+)\/rotate-enrolment-code\/$/);
    if (rotateMatch && method === 'POST') {
      const appId = Number(rotateMatch[1]);
      const rotatedAt = new Date().toISOString();
      const code = `apk_rotated${appId}`;
      state.apps = state.apps.map((item) =>
        item.id === appId
          ? { ...item, enrolment_code: code, enrolment_code_rotated_at: rotatedAt }
          : item,
      );
      return fulfillJson(route, 200, {
        app_id: appId,
        enrolment_code: code,
        enrolment_code_rotated_at: rotatedAt,
      });
    }

    // QR-code PNG: a 1x1 transparent PNG is enough for the surfaces to render an
    // <img> (the data: URL is read client-side). GET encodes the enrolment code,
    // POST is the legacy token form.
    const appQrMatch = path.match(/\/api\/v1\/apps\/(\d+)\/qrcode\/$/);
    if (appQrMatch && (method === 'POST' || method === 'GET')) {
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64',
        ),
      });
    }

    // Logo upload (multipart) / removal. Upload returns the app carrying a
    // (placeholder data:) logo; the form sets it as the new preview.
    const appLogoMatch = path.match(/\/api\/v1\/apps\/(\d+)\/logo\/$/);
    if (appLogoMatch && method === 'POST') {
      const appId = Number(appLogoMatch[1]);
      const index = state.apps.findIndex((item) => item.id === appId);
      if (index === -1) {
        return fulfillJson(route, 404, { detail: 'Not found.' });
      }
      const updated: Application = {
        ...state.apps[index],
        logo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      };
      state.apps = state.apps.map((item) => (item.id === appId ? updated : item));
      return fulfillJson(route, 200, updated);
    }
    if (appLogoMatch && method === 'DELETE') {
      const appId = Number(appLogoMatch[1]);
      const index = state.apps.findIndex((item) => item.id === appId);
      if (index !== -1) {
        state.apps = state.apps.map((item) => (item.id === appId ? { ...item, logo: null } : item));
      }
      return route.fulfill({ status: 204, body: '' });
    }

    const appDetailMatch = path.match(/\/api\/v1\/apps\/(\d+)\/$/);
    if (appDetailMatch && method === 'GET') {
      const appId = Number(appDetailMatch[1]);
      const app = state.apps.find((item) => item.id === appId);
      return fulfillJson(route, app ? 200 : 404, app ?? { detail: 'Not found.' });
    }

    // Update an application (edit page save).
    if (appDetailMatch && method === 'PATCH') {
      const appId = Number(appDetailMatch[1]);
      const payload = (request.postDataJSON() ?? {}) as { name?: string; description?: string };
      const index = state.apps.findIndex((item) => item.id === appId);
      if (index === -1) {
        return fulfillJson(route, 404, { detail: 'Not found.' });
      }
      const updated: Application = {
        ...state.apps[index],
        name: payload.name ?? state.apps[index].name,
        description: payload.description ?? state.apps[index].description,
      };
      state.apps = state.apps.map((item) => (item.id === appId ? updated : item));
      return fulfillJson(route, 200, updated);
    }

    if (appDetailMatch && method === 'DELETE') {
      const appId = Number(appDetailMatch[1]);
      state.apps = state.apps.filter((item) => item.id !== appId);
      return route.fulfill({ status: 204, body: '' });
    }

    // Evict a subscriber: cuts the link only. The device survives — it belongs
    // to somebody else — so we drop this application from its ids rather than
    // removing the row from the device list.
    const evictMatch = path.match(/\/api\/v1\/apps\/(\d+)\/devices\/(\d+)\/$/);
    if (evictMatch && method === 'DELETE') {
      const appId = Number(evictMatch[1]);
      const deviceId = Number(evictMatch[2]);
      state.devices = state.devices.map((item) =>
        item.id === deviceId
          ? { ...item, application_ids: item.application_ids.filter((id) => id !== appId) }
          : item,
      );
      return route.fulfill({ status: 204, body: '' });
    }

    const appQuietPeriodsMatch = path.match(/\/api\/v1\/apps\/(\d+)\/quiet-periods\/$/);
    if (appQuietPeriodsMatch && method === 'GET') {
      const appId = Number(appQuietPeriodsMatch[1]);
      return fulfillJson(route, 200, state.appQuietPeriods?.[appId] ?? []);
    }

    if (path.endsWith('/devices/') && method === 'GET') {
      return fulfillJson(route, 200, paginatedOrBare(url, state.devices));
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
      return fulfillJson(route, 200, paginatedOrBare(url, state.notifications));
    }

    if (path.endsWith('/notifications/future/') && method === 'GET') {
      return fulfillJson(route, 200, paginatedOrBare(url, state.futureNotifications));
    }

    // Create + immediate-send both append a new history notification. The page
    // reloads the lists afterwards, so the freshly-pushed row shows up.
    if ((path.endsWith('/notifications/') || path.endsWith('/notifications/send/')) && method === 'POST') {
      const payload = (request.postDataJSON() ?? {}) as {
        application_id?: number;
        title?: string;
        message?: string;
        scheduled_for?: string | null;
      };
      const app = state.apps.find((item) => item.id === payload.application_id);
      const created: Notification = {
        id: Date.now(),
        application_id: payload.application_id ?? 0,
        application_name: app?.name ?? '',
        device_ids: [],
        title: payload.title ?? '',
        message: payload.message ?? '',
        status: payload.scheduled_for ? 'scheduled' : 'sent',
        created_at: new Date().toISOString(),
        scheduled_for: payload.scheduled_for ?? null,
        effective_scheduled_for: payload.scheduled_for ?? null,
        sent_at: payload.scheduled_for ? null : new Date().toISOString(),
      };
      if (payload.scheduled_for) {
        state.futureNotifications = [created, ...state.futureNotifications];
      } else {
        state.notifications = [created, ...state.notifications];
      }
      return fulfillJson(route, 201, created);
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

// Mirrors the backend's OptionalPageNumberPagination: bare array by default,
// {count,next,previous,results} envelope when ?page / ?page_size is present.
function paginatedOrBare(url: URL, items: unknown[]): unknown {
  const params = url.searchParams;
  if (!params.has('page') && !params.has('page_size')) {
    return items;
  }
  const pageSize = Number(params.get('page_size') ?? '50') || 50;
  const page = Number(params.get('page') ?? '1') || 1;
  const start = (page - 1) * pageSize;
  const results = items.slice(start, start + pageSize);
  return {
    count: items.length,
    next: start + pageSize < items.length ? 'next' : null,
    previous: page > 1 ? 'prev' : null,
    results,
  };
}

async function fulfillJson(route: Parameters<Page['route']>[1] extends (route: infer T) => unknown ? T : never, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}
