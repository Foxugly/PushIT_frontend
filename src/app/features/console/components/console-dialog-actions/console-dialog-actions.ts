import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { ButtonModule } from '@openng/optimus-ui/button';

@Component({
  selector: 'app-console-dialog-actions',
  imports: [ButtonModule],
  templateUrl: './console-dialog-actions.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './console-dialog-actions.scss',
})
export class ConsoleDialogActions {
  readonly cancelLabel = input('Annuler');
  readonly cancelSeverity = input<'secondary' | 'contrast' | 'info' | 'success' | 'warn' | 'help' | 'danger'>('secondary');
  readonly cancelled = output<void>();
}
