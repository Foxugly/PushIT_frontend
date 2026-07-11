import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AppCopyService } from '../../../core/services/app-copy.service';
import { Footer } from '../../../core/layout/footer/footer';
import { Topmenu } from '../../../core/layout/topmenu/topmenu';

@Component({
  selector: 'app-public-layout-page',
  imports: [RouterOutlet, Topmenu, Footer],
  templateUrl: './public-layout-page.html',
  styleUrl: './public-layout-page.scss',
})
export class PublicLayoutPage {
  private readonly appCopy = inject(AppCopyService);
  readonly skipLabel = computed(() => this.appCopy.current().header.skipToContent);
}
