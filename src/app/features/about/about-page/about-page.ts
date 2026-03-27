import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

import { SiteFooter } from '../../../shared/site-footer/site-footer';
import { SiteHeader } from '../../../shared/site-header/site-header';

@Component({
  selector: 'app-about-page',
  imports: [CommonModule, SiteHeader, SiteFooter],
  templateUrl: './about-page.html',
  styleUrl: './about-page.scss',
})
export class AboutPage {}
