import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ButtonModule } from 'primeng/button';

import { AppCopyService } from '../../../core/services/app-copy.service';
import { ConsoleCopyService } from '../../../core/services/console-copy.service';
import { ConsoleShellService } from '../../../core/services/console-shell.service';
import { SettingsService } from '../../../core/services/settings.service';
import { AppAlert } from '../../../shared/app-alert/app-alert';
import { ConsoleNavigation } from '../components/console-navigation/console-navigation';
import { Footer } from '../../../core/layout/footer/footer';
import { Topmenu } from '../../../core/layout/topmenu/topmenu';

@Component({
  selector: 'app-console-layout-page',
  imports: [
    CommonModule,
    RouterOutlet,
    AppAlert,
    ButtonModule,
    ConsoleNavigation,
    Footer,
    Topmenu,
  ],
  templateUrl: './console-layout-page.html',
  styleUrl: './console-layout-page.scss',
})
export class ConsoleLayoutPage implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  readonly shell = inject(ConsoleShellService);
  readonly settings = inject(SettingsService);
  private readonly appCopy = inject(AppCopyService);
  private readonly consoleCopy = inject(ConsoleCopyService);
  readonly skipLabel = computed(() => this.appCopy.current().header.skipToContent);
  readonly shellCopy = computed(() => this.consoleCopy.current().shell);
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
