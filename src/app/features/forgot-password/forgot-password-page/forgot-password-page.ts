import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

import { AppCopyService } from '../../../core/services/app-copy.service';
import { AppAlert } from '../../../shared/app-alert/app-alert';

@Component({
  selector: 'app-forgot-password-page',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AppAlert, ButtonModule, InputTextModule],
  templateUrl: './forgot-password-page.html',
  styleUrl: './forgot-password-page.scss',
})
export class ForgotPasswordPage {
  private readonly appCopy = inject(AppCopyService);
  private readonly fb = inject(FormBuilder);

  readonly submitted = signal(false);
  readonly copy = computed(() => this.appCopy.current().forgotPassword);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitted.set(true);
  }
}
