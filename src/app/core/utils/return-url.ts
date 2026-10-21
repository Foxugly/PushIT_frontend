/**
 * "Return to where you were" after login.
 *
 * `authGuard` sends an anonymous visitor to `/auth?returnUrl=<path?query#fragment>`;
 * every login path that ends in the console then navigates to
 * `safeReturnUrl(returnUrl)`. The value comes from the address bar (or from
 * storage written from it), so it is attacker-controlled: only a same-app
 * relative path is accepted, anything else falls back to the dashboard.
 */
export const DEFAULT_RETURN_URL = '/dashboard';

/** Pages a login must never land back on (they are guest-only anyway). */
const GUEST_ONLY_PREFIXES = ['/auth', '/register', '/forgot-password', '/reset-password'];

const MAX_LENGTH = 2048;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export function safeReturnUrl(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_LENGTH) {
    return DEFAULT_RETURN_URL;
  }
  // A single leading slash: rejects `//host` and `/\host` (protocol-relative),
  // and — since it must start with `/` — every `scheme:` / absolute URL.
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return DEFAULT_RETURN_URL;
  }
  if (CONTROL_CHARS.test(raw)) {
    return DEFAULT_RETURN_URL;
  }
  // Belt and braces: resolved against a dummy origin, it must stay on it.
  const base = 'https://pushit.invalid';
  let parsed: URL;
  try {
    parsed = new URL(raw, base);
  } catch {
    return DEFAULT_RETURN_URL;
  }
  if (parsed.origin !== base) {
    return DEFAULT_RETURN_URL;
  }
  const path = parsed.pathname.toLowerCase();
  if (GUEST_ONLY_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return DEFAULT_RETURN_URL;
  }
  return raw;
}

/**
 * The magic link comes back by e-mail, often in a new tab, so the query
 * parameter does not survive the round trip: it is kept in localStorage between
 * the request and the verification. Not a secret, and re-sanitised on read.
 */
const STORAGE_KEY = 'pushit.returnUrl';

export function rememberReturnUrl(url: string | null): void {
  try {
    if (url && safeReturnUrl(url) === url) {
      localStorage.setItem(STORAGE_KEY, url);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage unavailable (private mode, blocked): the link lands on the dashboard.
  }
}

/** Reads and forgets the remembered return URL (always a safe value). */
export function takeRememberedReturnUrl(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    return safeReturnUrl(stored);
  } catch {
    return DEFAULT_RETURN_URL;
  }
}
