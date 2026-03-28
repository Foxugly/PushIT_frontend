import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { ConsoleFactItem } from './console-fact-item';

@Component({
  selector: 'app-console-facts-table',
  imports: [CommonModule, TableModule, TagModule],
  templateUrl: './console-facts-table.html',
})
export class ConsoleFactsTable {
  readonly items = input<ConsoleFactItem[]>([]);
  readonly styleClass = input('');
}
