import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-console-menu-item',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './console-menu-item.html',
  styleUrl: './console-menu-item.scss',
})
export class ConsoleMenuItem {
  readonly link = input.required<string>();
  readonly label = input.required<string>();
  readonly description = input.required<string>();
  readonly icon = input.required<string>();
  // Optional: entries like the admin link have no count, so the badge is hidden
  // when this is left undefined.
  readonly count = input<number | undefined>(undefined);
}
