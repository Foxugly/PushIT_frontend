import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

import { AppCopyService } from '../../../core/services/app-copy.service';
import { SessionService } from '../../../core/services/session.service';
import { openContactEmail } from '../../../shared/contact';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, ButtonModule],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  private readonly appCopy = inject(AppCopyService);
  private readonly session = inject(SessionService);

  readonly copy = computed(() => this.appCopy.current().home);
  readonly isAuthenticated = this.session.isAuthenticated;

  contactClick(): void {
    openContactEmail('[PushIT]');
  }
}
