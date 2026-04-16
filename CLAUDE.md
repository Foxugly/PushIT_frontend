# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PushIT is a push notification management platform. This repository is the **Angular frontend** that communicates with a Django REST backend at `http://127.0.0.1:8000`. The backend API is proxied through `/api` in development via `proxy.conf.json`.

## Commands

- **Dev server:** `npm start` (serves at `http://localhost:4200`, proxies `/api` to backend, HMR disabled)
- **Dev server with HMR:** `npm run start:hmr`
- **Build:** `npm run build`
- **Unit tests:** `npm test` (Karma + Jasmine, watches by default)
- **Unit tests (CI):** `npm run test:ci` (headless Chrome, coverage check)
- **E2E tests:** `npm run test:e2e` (builds then runs Playwright against Chromium)
- **Single test file:** `ng test --include=**/path-to-spec.ts`

## Coverage Thresholds

Enforced by `scripts/check-coverage.mjs`: statements 45%, branches 30%, functions 38%, lines 45%.

## Architecture

### Stack
- Angular 20 with standalone components (no NgModules)
- PrimeNG 20 (Aura theme) for UI components
- SCSS for component styles
- Strict TypeScript (`strict: true`, `strictTemplates: true`)

### Directory Structure (`src/app/`)
- **`core/`** — Singleton services, guards, interceptors, models, and utilities
  - `models/api.models.ts` — All API request/response TypeScript interfaces
  - `services/pushit-api.service.ts` — Central HTTP client wrapping all backend endpoints
  - `services/session.service.ts` — JWT auth state (access/refresh tokens, user) via Angular signals, persisted to local/session storage
  - `services/settings.service.ts` — Configurable API base URL (default `/api/v1`)
  - `interceptors/auth.interceptor.ts` — Attaches Bearer token, handles 401 with automatic token refresh
  - `guards/auth.guard.ts` — `authGuard` (requires login) and `guestGuard` (requires logged-out)
- **`features/`** — Lazy-loaded feature pages, organized by route
  - `public/` — Public layout (home, about, features, donate)
  - `auth/`, `register/`, `forgot-password/` — Auth flows (guest-only routes)
  - `console/` — Authenticated dashboard with sub-pages: applications, devices, notifications, quiet-periods, settings, change-password
- **`shared/`** — Reusable UI components (alert, confirm dialog, emoji picker, header, footer, register panel)

### Key Patterns
- **All components are standalone** — use `imports` array in `@Component`, no shared modules
- **Signals-based state** — services use Angular signals (`signal()`, `computed()`) rather than BehaviorSubject
- **Lazy loading** — all routes use `loadComponent` with dynamic imports
- **Auth flow** — JWT with access/refresh tokens; interceptor auto-refreshes on 401; `SKIP_AUTH` HttpContext token bypasses auth for login/register endpoints
- **i18n** — Trilingual (FR/NL/EN), default French; `PublicI18nService` manages language; `ConsoleCopyService` and `AppCopyService` provide translated strings via signals
- **API service** — `PushitApiService` is the single point of contact for all HTTP calls; all endpoints return typed `Observable`s

### Component File Convention
Components use single-file-name pattern (e.g., `about-page.ts` contains the component class, with co-located `about-page.html` and `about-page.scss`). No `.component` suffix in filenames.
