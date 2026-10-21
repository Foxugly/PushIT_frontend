/**
 * Cloudflare Turnstile (captcha) helper.
 *
 * The public site key is resolved at runtime from getRuntimeConfig()
 * (window.__PUSHIT_TURNSTILE_SITE_KEY, injected by nginx from SSM). When the
 * key is empty the captcha is not provisioned: the widget is not rendered and
 * no token is required (the backend is gated on its secret the same way).
 *
 * TurnstileController encapsulates the explicit-render + retry + reset
 * lifecycle so each auth form (register / forgot-password) stays small.
 */
import { getRuntimeConfig } from '../../core/runtime-config';

interface TurnstileRenderOptions {
  sitekey: string;
  callback?: (token: string) => void;
  'error-callback'?: (error: string) => void;
  'expired-callback'?: () => void;
  theme?: 'light' | 'dark' | 'auto';
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: TurnstileRenderOptions) => string;
      reset: (widgetId?: string) => void;
      remove?: (widgetId: string) => void;
    };
  }
}

export const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

/**
 * Inject the Turnstile API <script> once, on demand. It used to be loaded from
 * index.html on every page (dashboard included), giving a third-party script
 * same-origin access to the stored tokens everywhere; now only pages that
 * actually render the widget pull it in. CSP: script-src allowlists
 * https://challenges.cloudflare.com, so a script element created by the
 * (same-origin) bundle needs no nonce.
 */
export function loadTurnstileScript(): void {
  if (typeof document === 'undefined' || window.turnstile) return;
  if (document.querySelector(`script[src="${TURNSTILE_SCRIPT_SRC}"]`)) return;
  const script = document.createElement('script');
  script.src = TURNSTILE_SCRIPT_SRC;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

/**
 * Whether the Turnstile API was pulled into THIS document. Removing the
 * <script> would not unload it: once executed, Cloudflare's code keeps running
 * (and keeps same-origin access) until the document is replaced.
 */
export function isTurnstileLoaded(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(window.turnstile) || document.querySelector(`script[src="${TURNSTILE_SCRIPT_SRC}"]`) !== null;
}

/** Full document load (indirection so specs can observe it; jsdom's location is not spyable). */
export const documentNavigation = {
  assign(url: string): void {
    window.location.assign(url);
  },
};

export class TurnstileController {
  readonly siteKey = getRuntimeConfig().turnstileSiteKey;
  readonly enabled = this.siteKey.length > 0;

  private widgetId: string | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Render the widget into `container`. Cloudflare's auto-render only scans the
   * DOM once at script load, so on a lazy SPA route we render explicitly and
   * retry a few times while the async <script> (injected on first render)
   * finishes downloading.
   */
  render(container: HTMLElement | undefined, attempts = 0): void {
    if (!this.enabled || typeof window === 'undefined') return;
    if (attempts === 0) loadTurnstileScript();
    if (!window.turnstile?.render) {
      if (attempts >= 20) return;
      this.retryTimer = setTimeout(() => this.render(container, attempts + 1), 500);
      return;
    }
    if (!container || this.widgetId !== null) return;
    this.widgetId = window.turnstile.render(container, { sitekey: this.siteKey });
  }

  /** The token Cloudflare wrote into the hidden input, or '' if unsolved. */
  readToken(): string {
    if (typeof document === 'undefined') return '';
    const input = document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]');
    return input?.value ?? '';
  }

  /** Re-arm the widget after a consumed/expired token (e.g. a failed submit). */
  reset(): void {
    if (typeof window === 'undefined' || !window.turnstile?.reset) return;
    if (this.widgetId !== null) {
      window.turnstile.reset(this.widgetId);
    } else {
      window.turnstile.reset();
    }
  }

  destroy(): void {
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    if (this.widgetId !== null && window.turnstile?.remove) {
      window.turnstile.remove(this.widgetId);
    }
    this.widgetId = null;
  }
}
