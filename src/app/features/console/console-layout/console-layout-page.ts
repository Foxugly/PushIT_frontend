import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ConsoleShellService } from '../../../core/services/console-shell.service';
import { SettingsService } from '../../../core/services/settings.service';
import { ConsoleNavigation } from '../components/console-navigation/console-navigation';
import { SiteFooter } from '../../../shared/site-footer/site-footer';
import { SiteHeader } from '../../../shared/site-header/site-header';

@Component({
  selector: 'app-console-layout-page',
  imports: [
    CommonModule,
    RouterOutlet,
    ConsoleNavigation,
    SiteFooter,
    SiteHeader,
  ],
  templateUrl: './console-layout-page.html',
  styleUrl: './console-layout-page.scss',
})
export class ConsoleLayoutPage {
  readonly shell = inject(ConsoleShellService);
  readonly settings = inject(SettingsService);

  ngOnInit(): void {
    this.shell.ensureLoaded();
  }
}
