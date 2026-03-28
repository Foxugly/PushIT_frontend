import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';

import { AppCopyService } from '../../../../core/services/app-copy.service';

@Component({
  selector: 'app-application-form-fields',
  imports: [CommonModule, ReactiveFormsModule, InputTextModule, TextareaModule],
  templateUrl: './application-form-fields.html',
})
export class ApplicationFormFields {
  private readonly appCopy = inject(AppCopyService);

  readonly form = input.required<FormGroup>();
  readonly nameMessages = input<string[]>([]);
  readonly descriptionMessages = input<string[]>([]);
  readonly usePlaceholders = input(true);

  readonly copy = computed(() => this.appCopy.current().console.applicationForm);
}
