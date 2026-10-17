import { Component } from '@angular/core';

import { RegisterPanel } from '../../../shared/register-panel/register-panel';

@Component({
  selector: 'app-register-page',
  imports: [RegisterPanel],
  templateUrl: './register-page.html',
  styleUrl: './register-page.scss',
})
export class RegisterPage {}
