import { Component, input } from '@angular/core';
import { TableModule } from '@openng/optimus-ui/table';
import { TagModule } from '@openng/optimus-ui/tag';

import { ConsoleFactItem } from './console-fact-item';

@Component({
  selector: 'app-console-facts-table',
  imports: [TableModule, TagModule],
  templateUrl: './console-facts-table.html',
})
export class ConsoleFactsTable {
  readonly items = input<ConsoleFactItem[]>([]);
  readonly styleClass = input('');
}
