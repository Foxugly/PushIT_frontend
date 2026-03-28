import { Component, computed, inject } from '@angular/core';

import { AppCopyService } from '../../core/services/app-copy.service';

@Component({
  selector: 'app-site-footer',
  templateUrl: './site-footer.html',
  styleUrl: './site-footer.scss',
})
export class SiteFooter {
  private readonly appCopy = inject(AppCopyService);
  readonly copy = computed(() => this.appCopy.current().footer);
}
