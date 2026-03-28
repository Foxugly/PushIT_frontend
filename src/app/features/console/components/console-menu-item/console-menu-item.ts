import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-console-menu-item',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './console-menu-item.html',
  styleUrl: './console-menu-item.scss',
})
export class ConsoleMenuItem {
  readonly link = input.required<string>();
  readonly label = input.required<string>();
  readonly description = input.required<string>();
  readonly icon = input.required<string>();
  readonly count = input.required<number>();
}
