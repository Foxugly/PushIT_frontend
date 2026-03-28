import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-console-detail-header',
  imports: [CommonModule, RouterLink],
  templateUrl: './console-detail-header.html',
})
export class ConsoleDetailHeader {
  readonly backLink = input<string | readonly string[]>('/');
  readonly backLabel = input('');
  readonly eyebrow = input('');
  readonly title = input('');
}
