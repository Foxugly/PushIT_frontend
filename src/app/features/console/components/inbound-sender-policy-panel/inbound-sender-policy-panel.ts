import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { RadioButtonModule } from 'primeng/radiobutton';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';
import { finalize } from 'rxjs';

import {
  ApiErrorResponse,
  ApplicationRead,
  InboundSenderMode,
  InboundSenderPolicy,
} from '../../../../core/models/api.models';
import { ApiErrorMessagePipe } from '../../../../core/pipes/api-error-message.pipe';
import { ConsoleCopyService } from '../../../../core/services/console-copy.service';
import { PushitApiService } from '../../../../core/services/pushit-api.service';
import { coerceApiError, errorFieldMessages } from '../../../../core/utils/api-error.utils';
import { interpolate } from '../../../../core/utils/string.utils';
import { AppAlert } from '../../../../shared/app-alert/app-alert';

// `*` is only meaningful as the whole first label of a domain entry
// (`@*.example.com`), like the server: never in an address, never elsewhere.
const ADDRESS_RE = /^[^\s@*]+@[^\s@*]+\.[^\s@*]+$/;
const DOMAIN_RE = /^@(\*\.)?[^\s@*]+\.[^\s@*]+$/;

/**
 * A list entry the server will accept: an address (`alice@example.com`), a
 * domain (`@example.com`, subdomains excluded) or a domain with all its
 * subdomains (`@*.example.com`).
 */
export function isValidSenderEntry(entry: string): boolean {
  return ADDRESS_RE.test(entry) || DOMAIN_RE.test(entry);
}

/** Textarea → list: one entry per line (commas/semicolons tolerated), trimmed, lowercased, deduped. */
export function parseSenderList(text: string): string[] {
  const seen = new Set<string>();
  for (const raw of text.split(/[\n,;]+/)) {
    const entry = raw.trim().toLowerCase();
    if (entry) {
      seen.add(entry);
    }
  }
  return [...seen];
}

/** Order-stable fingerprint of a policy, to compare the form with what was loaded. */
function policyKey(policy: InboundSenderPolicy): string {
  return JSON.stringify([
    policy.inbound_sender_mode,
    policy.inbound_sender_allowlist,
    policy.inbound_sender_blocklist,
    policy.inbound_rejection_notify_email,
    policy.inbound_rejection_notify_push,
    policy.inbound_rejection_reply_to_sender,
  ]);
}

/**
 * « Qui peut envoyer par e-mail » — the application's inbound sender policy:
 * owner-only (+ allowlist) or anyone, a blocklist, and what to do when a mail
 * is refused. Saved with a PATCH on the application; the parent receives the
 * updated application through `saved`.
 */
@Component({
  selector: 'app-inbound-sender-policy-panel',
  imports: [
    FormsModule,
    AppAlert,
    ApiErrorMessagePipe,
    ButtonModule,
    CheckboxModule,
    RadioButtonModule,
    TextareaModule,
    TooltipModule,
  ],
  templateUrl: './inbound-sender-policy-panel.html',
  styleUrl: './inbound-sender-policy-panel.scss',
})
export class InboundSenderPolicyPanel {
  private readonly api = inject(PushitApiService);
  private readonly consoleCopy = inject(ConsoleCopyService);
  private readonly destroyRef = inject(DestroyRef);

  readonly app = input.required<ApplicationRead>();
  readonly saved = output<ApplicationRead>();

  readonly copy = computed(() => this.consoleCopy.current().inboundSenderPolicy);
  readonly unsavedCopy = computed(() => this.consoleCopy.current().unsavedChanges);

  readonly mode = signal<InboundSenderMode>('owner');
  readonly allowlistText = signal('');
  readonly blocklistText = signal('');
  readonly notifyEmail = signal(true);
  readonly notifyPush = signal(false);
  readonly replyToSender = signal(false);

  readonly saving = signal(false);
  readonly error = signal<ApiErrorResponse | null>(null);
  readonly banner = signal<string | null>(null);

  /** The policy as last loaded from the server, normalized like `payload()`. */
  private readonly baseline = signal<string | null>(null);
  /** True while the form differs from what the server holds. */
  readonly dirty = computed(() => {
    const baseline = this.baseline();
    return baseline !== null && baseline !== policyKey(this.payload());
  });

  /** Entries the server would refuse, shown before any round-trip. */
  readonly invalidEntries = computed(() =>
    [...parseSenderList(this.allowlistText()), ...parseSenderList(this.blocklistText())].filter(
      (entry) => !isValidSenderEntry(entry),
    ),
  );
  readonly invalidMessage = computed(() => {
    const invalid = this.invalidEntries();
    return invalid.length ? interpolate(this.copy().invalidEntries, { entries: invalid.join(', ') }) : null;
  });

  constructor() {
    // (Re)load the form whenever the parent hands a new application object
    // (first load, another section's save, a reload) — but never over edits the
    // user has not saved yet: only a pristine form follows the server.
    effect(() => {
      const app = this.app();
      untracked(() => {
        if (!this.dirty()) {
          this.reset(app);
        }
      });
    });
  }

  /** Load the form from `app` and make it pristine. */
  reset(app: ApplicationRead): void {
    this.mode.set(app.inbound_sender_mode ?? 'owner');
    this.allowlistText.set((app.inbound_sender_allowlist ?? []).join('\n'));
    this.blocklistText.set((app.inbound_sender_blocklist ?? []).join('\n'));
    this.notifyEmail.set(app.inbound_rejection_notify_email ?? true);
    this.notifyPush.set(app.inbound_rejection_notify_push ?? false);
    this.replyToSender.set(app.inbound_rejection_reply_to_sender ?? false);
    this.baseline.set(policyKey(this.payload()));
  }

  payload(): InboundSenderPolicy {
    return {
      inbound_sender_mode: this.mode(),
      inbound_sender_allowlist: parseSenderList(this.allowlistText()),
      inbound_sender_blocklist: parseSenderList(this.blocklistText()),
      inbound_rejection_notify_email: this.notifyEmail(),
      inbound_rejection_notify_push: this.notifyPush(),
      inbound_rejection_reply_to_sender: this.replyToSender(),
    };
  }

  fieldErrors(field: keyof InboundSenderPolicy): string[] {
    return errorFieldMessages(this.error(), field);
  }

  save(): void {
    if (this.invalidEntries().length || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.banner.set(null);
    this.api
      .updateApp(this.app().id, this.payload())
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => {
          // Our own save: adopt what the server kept (normalized lists), pristine again.
          this.reset(updated);
          this.banner.set(this.copy().saved);
          this.saved.emit(updated);
        },
        error: (err) => this.error.set(coerceApiError(err)),
      });
  }
}
