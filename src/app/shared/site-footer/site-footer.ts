import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AppCopyService } from '../../core/services/app-copy.service';

@Component({
  selector: 'app-site-footer',
  imports: [RouterLink],
  templateUrl: './site-footer.html',
  styleUrl: './site-footer.scss',
})
export class SiteFooter {
  private readonly appCopy = inject(AppCopyService);
  readonly copy = computed(() => this.appCopy.current().footer);
  // Année calculée au runtime — jamais figée dans la copy.
  readonly year = new Date().getFullYear();
}
