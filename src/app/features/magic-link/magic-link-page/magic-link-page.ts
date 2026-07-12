import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AppCopyService } from '../../../core/services/app-copy.service';
import { LanguagePreferenceService } from '../../../core/services/language-preference.service';
import { PushitApiService } from '../../../core/services/pushit-api.service';
import { SessionService } from '../../../core/services/session.service';
import { AppAlert } from '../../../shared/app-alert/app-alert';

/**
 * Magic-link verify/exchange landing page. Matches the deep link the backend
 * emails ({FRONTEND_BASE_URL}/auth/magic-link/{token}): it POSTs the single-use
 * token to the verify endpoint, stores the JWT and lands on the dashboard, or
 * shows an invalid/expired state (fleet "states screen" pattern).
 */
@Component({
  selector: 'app-magic-link-page',
  imports: [CommonModule, RouterLink, AppAlert],
  templateUrl: './magic-link-page.html',
  styleUrl: './magic-link-page.scss',
})
export class MagicLinkPage implements OnInit {
  private readonly appCopy = inject(AppCopyService);
  private readonly api = inject(PushitApiService);
  private readonly session = inject(SessionService);
  private readonly languagePreference = inject(LanguagePreferenceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  private readonly token = this.route.snapshot.paramMap.get('token') ?? '';

  readonly verifying = signal(true);
  readonly failed = signal(false);
  readonly copy = computed(() => this.appCopy.current().magicLink);

  ngOnInit(): void {
    // Strip the single-use token from the URL bar + history so it doesn't linger
    // in history / referer headers (mirrors confirm-email / reset-password).
    this.location.replaceState('/auth/magic-link');

    if (!this.token) {
      this.verifying.set(false);
      this.failed.set(true);
      return;
    }

    this.api.verifyMagicLink(this.token).subscribe({
      next: (response) => {
        // Magic-link is an explicit "sign me in" action: persist the session
        // (like confirm-email auto-login) since the remember-me choice made on
        // the login card doesn't survive the emailed round-trip.
        this.session.startSession(response, true);
        this.languagePreference.applyBackendLanguage(response.user.language);
        void this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.verifying.set(false);
        this.failed.set(true);
      },
    });
  }
}
