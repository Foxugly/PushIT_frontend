import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';

import { AppCopyService } from '../../../../core/services/app-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';
import { buildConsoleSections, ConsoleSection } from '../../console-sections';
import { ConsoleMenuItem } from '../console-menu-item/console-menu-item';

@Component({
  selector: 'app-console-navigation',
  imports: [
    CommonModule,
    ButtonModule,
    ConsoleMenuItem,
  ],
  templateUrl: './console-navigation.html',
  styleUrl: './console-navigation.scss',
})
export class ConsoleNavigation {
  private readonly appCopy = inject(AppCopyService);
  readonly shell = inject(ConsoleShellService);
  readonly copy = computed(() => this.appCopy.current().console.navigation);
  readonly sections = computed(() => buildConsoleSections(this.appCopy.current().console.sections));
  readonly navigationItems = computed(() =>
    this.sections().map((section) => ({
      ...section,
      count: this.countFor(section),
    })),
  );

  copyLatestToken(): void {
    const token = this.shell.lastGeneratedToken()?.token;
    if (!token) {
      return;
    }

    navigator.clipboard.writeText(token).catch(() => undefined);
  }

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
