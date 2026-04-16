import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { ConsoleShellService } from '../../../core/services/console-shell.service';
import { SettingsService } from '../../../core/services/settings.service';
import { AppAlert } from '../../../shared/app-alert/app-alert';
import { ConsoleNavigation } from '../components/console-navigation/console-navigation';
import { SiteFooter } from '../../../shared/site-footer/site-footer';
import { SiteHeader } from '../../../shared/site-header/site-header';

@Component({
  selector: 'app-console-layout-page',
  imports: [
    CommonModule,
    RouterOutlet,
    AppAlert,
    ConsoleNavigation,
    SiteFooter,
    SiteHeader,
  ],
  templateUrl: './console-layout-page.html',
  styleUrl: './console-layout-page.scss',
})
export class ConsoleLayoutPage implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  readonly shell = inject(ConsoleShellService);
  readonly settings = inject(SettingsService);
  hideSidebar = false;

  ngOnInit(): void {
    this.shell.ensureLoaded();
    this.syncSidebarVisibility(this.router.url);
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.syncSidebarVisibility(event.urlAfterRedirects);
      });
  }

  private syncSidebarVisibility(url: string): void {
    this.hideSidebar =
      url.includes('/dashboard/settings') || url.includes('/dashboard/change-password');
  }
}
