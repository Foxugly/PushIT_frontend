import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { SiteFooter } from '../../../shared/site-footer/site-footer';
import { SiteHeader } from '../../../shared/site-header/site-header';

@Component({
  selector: 'app-public-layout-page',
  imports: [RouterOutlet, SiteHeader, SiteFooter],
  templateUrl: './public-layout-page.html',
  styleUrl: './public-layout-page.scss',
})
export class PublicLayoutPage {}
