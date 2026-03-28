import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';

import { AppCopyService } from '../../../core/services/app-copy.service';

@Component({
  selector: 'app-about-page',
  imports: [CommonModule],
  templateUrl: './about-page.html',
  styleUrl: './about-page.scss',
})
export class AboutPage {
  private readonly appCopy = inject(AppCopyService);
  readonly copy = computed(() => this.appCopy.current().about);
}
