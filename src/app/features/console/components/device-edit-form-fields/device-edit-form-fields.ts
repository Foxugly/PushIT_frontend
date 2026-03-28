import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';

import { AppCopyService } from '../../../../core/services/app-copy.service';

@Component({
  selector: 'app-device-edit-form-fields',
  imports: [CommonModule, ReactiveFormsModule, InputTextModule, SelectModule],
  templateUrl: './device-edit-form-fields.html',
})
export class DeviceEditFormFields {
  private readonly appCopy = inject(AppCopyService);

  readonly form = input.required<FormGroup>();
  readonly platformOptions = input.required<Array<{ label: string; value: string }>>();
  readonly statusOptions = input.required<Array<{ label: string; value: string }>>();

  readonly copy = computed(() => this.appCopy.current().console.deviceForm);
}
