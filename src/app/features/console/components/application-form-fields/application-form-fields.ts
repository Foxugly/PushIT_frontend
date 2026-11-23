import { Component, computed, inject, input, ChangeDetectionStrategy } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { TextareaModule } from '@openng/optimus-ui/textarea';

import { AppCopyService } from '../../../../core/services/app-copy.service';

@Component({
  selector: 'app-application-form-fields',
  imports: [ReactiveFormsModule, InputTextModule, TextareaModule],
  changeDetection: ChangeDetectionStrategy.Eager,
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
