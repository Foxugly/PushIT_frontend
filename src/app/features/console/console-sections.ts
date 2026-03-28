export interface ConsoleSection {
  label: string;
  description: string;
  icon: string;
  link: string;
  countKey: 'apps' | 'devices' | 'notifications' | 'quietPeriods';
}

export type ConsoleSectionCopy = ConsoleSection;

export function buildConsoleSections(sections: readonly ConsoleSectionCopy[]): ConsoleSection[] {
  return sections.map((section) => ({ ...section }));
}
