import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AppCopyService } from '../../../../core/services/app-copy.service';
import { ConsoleShellService } from '../../../../core/services/console-shell.service';

@Component({
  selector: 'app-dashboard-home-page',
  imports: [CommonModule, RouterLink, ButtonModule],
  templateUrl: './dashboard-home-page.html',
  styleUrl: './dashboard-home-page.scss',
})
export class DashboardHomePage {
  private readonly appCopy = inject(AppCopyService);
  readonly shell = inject(ConsoleShellService);
  readonly copy = computed(() => this.appCopy.current().console.dashboard);
  readonly activeAppsCount = computed(() => this.shell.apps().filter((app) => app.is_active).length);
}
