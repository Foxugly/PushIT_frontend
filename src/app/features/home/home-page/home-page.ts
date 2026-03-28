import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AppCopyService } from '../../../core/services/app-copy.service';
import { RegisterPanel } from '../../../shared/register-panel/register-panel';

@Component({
  selector: 'app-home-page',
  imports: [CommonModule, RouterLink, RegisterPanel],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  private readonly appCopy = inject(AppCopyService);
  readonly copy = computed(() => this.appCopy.current().home);
}
