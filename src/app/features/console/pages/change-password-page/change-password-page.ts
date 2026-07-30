import { PageHeader } from '../../../../shared/page-header/page-header';
import { Component, computed, inject } from '@angular/core';

import { AppCopyService } from '../../../../core/services/app-copy.service';

@Component({
  selector: 'app-change-password-page',
  imports: [
    PageHeader
],
  templateUrl: './change-password-page.html',
  styleUrl: './change-password-page.scss',
})
export class ChangePasswordPage {
  private readonly appCopy = inject(AppCopyService);
  readonly copy = computed(() => this.appCopy.current().console.changePassword);
}
