import { Component, computed, inject, input, ChangeDetectionStrategy } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { SelectModule } from '@openng/optimus-ui/select';

import { AppCopyService } from '../../../../core/services/app-copy.service';

@Component({
  selector: 'app-device-edit-form-fields',
  imports: [ReactiveFormsModule, InputTextModule, SelectModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './device-edit-form-fields.html',
})
export class DeviceEditFormFields {
  private readonly appCopy = inject(AppCopyService);

  readonly form = input.required<FormGroup>();
  readonly platformOptions = input.required<Array<{ label: string; value: string }>>();
  readonly statusOptions = input.required<Array<{ label: string; value: string }>>();

  readonly copy = computed(() => this.appCopy.current().console.deviceForm);
}
