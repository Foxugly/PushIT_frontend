import { Component, computed, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AppCopyService } from '../../../../core/services/app-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { SessionService } from '../../../../core/services/session.service';
import { buildConsoleSections, ConsoleSection } from '../../console-sections';
import { ConsoleMenuItem } from '../console-menu-item/console-menu-item';

export interface ConsoleNavigationItem {
  link: string;
  label: string;
  description: string;
  icon: string;
  /** Undefined = no badge (billing, account, admin…). */
  count?: number;
}

/**
 * Console menu. Two renderings of the same entries:
 * - `sidebar` (default): the « Menu console » card beside the page (desktop);
 * - `drawer`: a compact list projected into the topbar hamburger drawer below
 *   the `lg` breakpoint (1024px), where the sidebar is hidden.
 */
@Component({
  selector: 'app-console-navigation',
  imports: [ConsoleMenuItem, RouterLink, RouterLinkActive],
  templateUrl: './console-navigation.html',
  styleUrl: './console-navigation.scss',
})
export class ConsoleNavigation {
  private readonly appCopy = inject(AppCopyService);
  readonly shell = inject(ConsoleShellService);
  readonly session = inject(SessionService);

  readonly variant = input<'sidebar' | 'drawer'>('sidebar');

  readonly copy = computed(() => this.appCopy.current().console.navigation);
  readonly headerCopy = computed(() => this.appCopy.current().header);
  readonly sections = computed(() => buildConsoleSections(this.appCopy.current().console.sections));
  readonly navigationItems = computed<ConsoleNavigationItem[]>(() => {
    const nav = this.copy();
    const items: ConsoleNavigationItem[] = this.sections().map((section) => ({
      link: section.link,
      label: section.label,
      description: section.description,
      icon: section.icon,
      count: this.countFor(section),
    }));
    items.push({ link: '/dashboard/billing', icon: 'pi pi-credit-card', ...nav.billing });
    items.push({ link: '/dashboard/settings', icon: 'pi pi-user', ...nav.account });
    if (this.session.isSuperuser()) {
      items.push({ link: '/dashboard/accounts', icon: 'pi pi-users', ...nav.accounts });
    }
    if (this.session.isAdmin()) {
      items.push({ link: '/dashboard/admin', icon: 'pi pi-shield', ...nav.admin });
    }
    return items;
  });

  private countFor(section: ConsoleSection): number {
    switch (section.countKey) {
      case 'apps':
        return this.shell.apps().length;
      case 'devices':
        return this.shell.devicesCount();
      case 'notifications':
        return this.shell.notificationsCount();
      case 'quietPeriods':
        return this.shell.quietPeriodsCount();
    }
  }
}
