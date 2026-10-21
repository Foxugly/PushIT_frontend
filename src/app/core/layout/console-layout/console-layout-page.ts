import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';

import { AppCopyService } from '../../../core/services/app-copy.service';
import { ConsoleCopyService } from '../../../core/services/console-copy.service';
import { ConsoleShellService } from '../../../core/services/console-shell.service';
import { SettingsService } from '../../../core/services/settings.service';
import { AppAlert } from '../../../shared/app-alert/app-alert';
import { ConsoleNavigation } from '../../../features/console/components/console-navigation/console-navigation';
import { Footer } from '../../../core/layout/footer/footer';
import { Topmenu } from '../../../core/layout/topmenu/topmenu';

@Component({
  selector: 'app-console-layout-page',
  imports: [
    RouterOutlet,
    AppAlert,
    ButtonModule,
    ConsoleNavigation,
    Footer,
    Topmenu,
    ToastModule
],
  templateUrl: './console-layout-page.html',
  styleUrl: './console-layout-page.scss',
})
export class ConsoleLayoutPage implements OnInit {
  readonly shell = inject(ConsoleShellService);
  readonly settings = inject(SettingsService);
  private readonly appCopy = inject(AppCopyService);
  private readonly consoleCopy = inject(ConsoleCopyService);
  readonly skipLabel = computed(() => this.appCopy.current().header.skipToContent);
  readonly shellCopy = computed(() => this.consoleCopy.current().shell);

  ngOnInit(): void {
    this.shell.ensureLoaded();
  }
}
