import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { PrimeNgLocaleService } from './core/services/primeng-locale.service';
import { ThemeService } from './core/services/theme.service';
import { AppConfirmDialog } from './shared/app-confirm-dialog/app-confirm-dialog';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppConfirmDialog],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly _primeLocale = inject(PrimeNgLocaleService);
  private readonly theme = inject(ThemeService);

  constructor() {
    this.theme.init();
  }
}
