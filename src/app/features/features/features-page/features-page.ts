import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';

import { AppCopyService } from '../../../core/services/app-copy.service';

@Component({
  selector: 'app-features-page',
  imports: [],
  templateUrl: './features-page.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './features-page.scss',
})
export class FeaturesPage {
  private readonly appCopy = inject(AppCopyService);

  readonly copy = computed(() => this.appCopy.current().features);
  // One icon per feature section (matched by index to copy().sections):
  // general, applications, devices, notifications, quiet periods, inbound email.
  readonly sectionIcons = [
    'pi-sliders-h',
    'pi-briefcase',
    'pi-mobile',
    'pi-bell',
    'pi-moon',
    'pi-envelope',
  ];
}
