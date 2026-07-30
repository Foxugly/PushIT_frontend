import { Component, computed, inject } from '@angular/core';

import { AppCopyService } from '../../../core/services/app-copy.service';

@Component({
  selector: 'app-donate-page',
  imports: [],
  templateUrl: './donate-page.html',
  styleUrl: './donate-page.scss',
})
export class DonatePage {
  private readonly appCopy = inject(AppCopyService);
  readonly copy = computed(() => this.appCopy.current().donate);
}
