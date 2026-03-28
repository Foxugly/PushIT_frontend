import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';

import { AppCopyService } from '../../../core/services/app-copy.service';
import { RegisterPanel } from '../../../shared/register-panel/register-panel';

@Component({
  selector: 'app-register-page',
  imports: [CommonModule, RegisterPanel],
  templateUrl: './register-page.html',
  styleUrl: './register-page.scss',
})
export class RegisterPage {
  private readonly appCopy = inject(AppCopyService);
  readonly copy = computed(() => this.appCopy.current().registerPage);
}
