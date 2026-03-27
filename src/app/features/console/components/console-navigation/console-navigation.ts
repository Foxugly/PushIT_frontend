import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ButtonModule } from 'primeng/button';

import { ConsoleShellService } from '../../../../core/services/console-shell.service';

@Component({
  selector: 'app-console-navigation',
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    ButtonModule,
  ],
  templateUrl: './console-navigation.html',
  styleUrl: './console-navigation.scss',
})
export class ConsoleNavigation {
  readonly shell = inject(ConsoleShellService);

  copyLatestToken(): void {
    const token = this.shell.lastGeneratedToken()?.token;
    if (!token) {
      return;
    }

    navigator.clipboard.writeText(token).catch(() => undefined);
  }
}
