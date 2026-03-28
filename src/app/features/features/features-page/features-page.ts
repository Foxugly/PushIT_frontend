import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AppCopyService } from '../../../core/services/app-copy.service';
import { SettingsService } from '../../../core/services/settings.service';

@Component({
  selector: 'app-features-page',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './features-page.html',
  styleUrl: './features-page.scss',
})
export class FeaturesPage {
  private readonly appCopy = inject(AppCopyService);
  private readonly settings = inject(SettingsService);
  private readonly fb = inject(FormBuilder);

  readonly saved = signal(false);
  readonly copy = computed(() => this.appCopy.current().features);
  readonly form = this.fb.nonNullable.group({
    apiBaseUrl: [this.settings.apiBaseUrl(), [Validators.required]],
  });

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.settings.updateApiBaseUrl(this.form.getRawValue().apiBaseUrl);
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }
}
