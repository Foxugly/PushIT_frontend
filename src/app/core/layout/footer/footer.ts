import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AppCopyService } from '../../services/app-copy.service';

/**
 * Fleet footer (core/layout, STANDARD-frontend-layout.md) : marque + crédit
 * Foxugly + lien privacy. Version de build runtime (`window.__PUSHIT_VERSION`)
 * quand injectée. Couleurs via tokens (dark mode auto).
 */
@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Footer {
  private readonly appCopy = inject(AppCopyService);
  readonly copy = computed(() => this.appCopy.current().footer);
  // Année calculée au runtime — jamais figée dans la copy.
  readonly year = new Date().getFullYear();
  /** Version de build injectée au déploiement ; vide en dev. */
  readonly version = (globalThis as { __PUSHIT_VERSION?: string }).__PUSHIT_VERSION ?? '';
}
