export interface ConsoleSection {
  label: string;
  description: string;
  icon: string;
  link: string;
  countKey: 'apps' | 'devices' | 'notifications' | 'quietPeriods';
}

/** Raw section as it comes from the i18n catalog (countKey widened to string). */
export interface ConsoleSectionCopy {
  label: string;
  description: string;
  icon: string;
  link: string;
  countKey: string;
}

export function buildConsoleSections(sections: readonly ConsoleSectionCopy[]): ConsoleSection[] {
  return sections.map((section) => ({
    ...section,
    countKey: section.countKey as ConsoleSection['countKey'],
  }));
}
