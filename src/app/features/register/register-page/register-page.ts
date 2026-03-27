import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

import { RegisterPanel } from '../../../shared/register-panel/register-panel';
import { SiteFooter } from '../../../shared/site-footer/site-footer';
import { SiteHeader } from '../../../shared/site-header/site-header';

@Component({
  selector: 'app-register-page',
  imports: [CommonModule, RegisterPanel, SiteFooter, SiteHeader],
  templateUrl: './register-page.html',
  styleUrl: './register-page.scss',
})
export class RegisterPage {}
