import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-console-dialog-actions',
  imports: [ButtonModule],
  templateUrl: './console-dialog-actions.html',
  styleUrl: './console-dialog-actions.scss',
})
export class ConsoleDialogActions {
  @Input() cancelLabel = 'Annuler';
  @Input() cancelSeverity: 'secondary' | 'contrast' | 'info' | 'success' | 'warn' | 'help' | 'danger' = 'secondary';
  @Output() cancelled = new EventEmitter<void>();
}
