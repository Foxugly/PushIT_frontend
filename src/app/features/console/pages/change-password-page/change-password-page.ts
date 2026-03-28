import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';

import { AppCopyService } from '../../../../core/services/app-copy.service';

@Component({
  selector: 'app-change-password-page',
  imports: [CommonModule],
  templateUrl: './change-password-page.html',
  styleUrl: './change-password-page.scss',
})
export class ChangePasswordPage {
  private readonly appCopy = inject(AppCopyService);
  readonly copy = computed(() => this.appCopy.current().console.changePassword);
}
