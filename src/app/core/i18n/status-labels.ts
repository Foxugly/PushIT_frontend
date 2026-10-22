import { Injectable, Pipe, PipeTransform, inject } from '@angular/core';

import { ConsoleCopyService } from '../services/console-copy.service';

/**
 * Every API enum value the console shows to a user, by kind.
 *
 * The labels live in ONE place in the catalogs, `console.statusLabels.<kind>.<value>`,
 * and every page goes through `StatusLabelService` / the `statusLabel` pipe — never
 * through the raw API value (`active`, `ios`, `no_target`…) nor a page-local map.
 * `status-labels.spec.ts` checks that each value below has a label in every locale.
 *
 * `shifted` is not an API status: it is the notification badge shown when a quiet
 * period postponed the send (`effective_scheduled_for` ≠ `scheduled_for`).
 */
export const STATUS_VALUES = {
  notification: [
    'draft',
    'scheduled',
    'queued',
    'processing',
    'sent',
    'partial',
    'failed',
    'no_target',
    'shifted',
  ],
  delivery: ['pending', 'sent', 'failed'],
  pushToken: ['active', 'invalid', 'revoked'],
  platform: ['android', 'ios'],
  application: ['active', 'inactive'],
  quietPeriod: ['active', 'inactive'],
  quietPeriodType: ['ONCE', 'RECURRING'],
  sendToken: ['active', 'revoked'],
  inboundEmail: ['created', 'existing', 'rejected', 'conflict', 'error'],
} as const;

export type StatusKind = keyof typeof STATUS_VALUES;

/** Shared translation of API enum values (see `STATUS_VALUES`). */
@Injectable({ providedIn: 'root' })
export class StatusLabelService {
  private readonly copy = inject(ConsoleCopyService);

  /**
   * Label of `value` in the active language. An unknown value (a status added by
   * the backend before the frontend knows it) is shown as is rather than hidden.
   */
  label(kind: StatusKind, value: string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    const labels = this.copy.current()?.statusLabels as
      | Record<string, Record<string, string> | undefined>
      | undefined;
    return labels?.[kind]?.[value] ?? value;
  }

  /** `label()` for the boolean `is_active` flags (application, quiet period). */
  activeLabel(kind: 'application' | 'quietPeriod', isActive: boolean): string {
    return this.label(kind, isActive ? 'active' : 'inactive');
  }
}

/**
 * `{{ device.platform | statusLabel: 'platform' }}`. Impure so that a language
 * switch re-labels what is on screen (the catalog is read through a signal, and a
 * pure pipe would keep its cached result while its inputs are unchanged).
 */
@Pipe({ name: 'statusLabel', pure: false })
export class StatusLabelPipe implements PipeTransform {
  private readonly labels = inject(StatusLabelService);

  transform(value: string | null | undefined, kind: StatusKind): string {
    return this.labels.label(kind, value);
  }
}
