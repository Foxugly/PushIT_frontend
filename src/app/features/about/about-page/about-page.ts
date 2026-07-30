import { Component, computed, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';

import { AppCopyService } from '../../../core/services/app-copy.service';
import { PublicI18nService } from '../../../core/services/public-i18n.service';
import { CONTACT_INFO, emailDisplay, openContactEmail, phoneDisplay } from '../../../shared/contact';
import { getAboutCopy } from './about.i18n';

@Component({
  selector: 'app-about-page',
  imports: [TabsModule, ButtonModule],
  templateUrl: './about-page.html',
  styleUrl: './about-page.scss',
})
export class AboutPage {
  private readonly appCopy = inject(AppCopyService);
  private readonly i18n = inject(PublicI18nService);

  protected readonly repositoryUrl = 'https://github.com/Foxugly';
  protected readonly technicalCardKeys = ['repository', 'backend', 'frontend', 'mobile'] as const;
  protected readonly activeTab = signal('company');
  protected readonly contact = CONTACT_INFO;
  protected readonly emailDisplay = emailDisplay();
  protected readonly phoneDisplay = phoneDisplay();

  // Hero badge/title reuse the existing app copy; the tabbed content is its own catalog.
  readonly hero = computed(() => this.appCopy.current().about);
  readonly copy = computed(() => getAboutCopy(this.i18n.language()));

  protected emailClick(): void {
    openContactEmail('[PushIT]');
  }
}
