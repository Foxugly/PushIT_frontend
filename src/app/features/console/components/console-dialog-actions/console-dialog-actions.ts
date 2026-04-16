import { Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-console-dialog-actions',
  imports: [ButtonModule],
  templateUrl: './console-dialog-actions.html',
  styleUrl: './console-dialog-actions.scss',
})
export class ConsoleDialogActions {
  readonly cancelLabel = input('Annuler');
  readonly cancelSeverity = input<'secondary' | 'contrast' | 'info' | 'success' | 'warn' | 'help' | 'danger'>('secondary');
  readonly cancelled = output<void>();
}
