import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';

import { AppConfirmService } from './app-confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  imports: [CommonModule, ButtonModule, DialogModule],
  templateUrl: './app-confirm-dialog.html',
  styleUrl: './app-confirm-dialog.scss',
})
export class AppConfirmDialog {
  readonly confirm = inject(AppConfirmService);

  setVisible(visible: boolean): void {
    if (!visible) {
      this.confirm.reject();
    }
  }
}
