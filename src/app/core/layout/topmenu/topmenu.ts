import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';

import { AppCopyService } from '../../services/app-copy.service';
import { SessionService } from '../../services/session.service';
import { ThemeService } from '../../services/theme.service';
import { LanguageMenu } from '../../../shared/language-menu/language-menu';
import { UserMenu } from '../user-menu/user-menu';

/**
 * Topbar de la flotte (STANDARD-frontend-layout.md) : marque · nav · actions.
 * Ordre des actions = thème → langue → user (`app-user-menu` polymorphe). Se
 * replie en hamburger + drawer sous le breakpoint `lg` (1024px). BEM `topbar__*`.
 */
@Component({
  selector: 'app-topmenu',
  imports: [RouterLink, RouterLinkActive, TooltipModule, LanguageMenu, UserMenu],
  templateUrl: './topmenu.html',
  styleUrl: './topmenu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Topmenu {
  private readonly appCopy = inject(AppCopyService);
  readonly session = inject(SessionService);
  readonly theme = inject(ThemeService);

  readonly mode = input<'public' | 'authenticated'>('authenticated');
  readonly sticky = input(false);
  readonly maxWidth = input('var(--content-max)');

  readonly labels = computed(() => this.appCopy.current().header);
  readonly mobileOpen = signal(false);

  toggleMobile(): void {
    this.mobileOpen.update((v) => !v);
  }

  closeMobile(): void {
    this.mobileOpen.set(false);
  }
}
