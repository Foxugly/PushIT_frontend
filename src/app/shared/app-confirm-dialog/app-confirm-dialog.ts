import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DialogModule } from '@openng/optimus-ui/dialog';

import { AppConfirmService } from './app-confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  imports: [ButtonModule, DialogModule],
  templateUrl: './app-confirm-dialog.html',
  changeDetection: ChangeDetectionStrategy.Eager,
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
