export function formatDateTimeFrBe(value: string | null): string {
  if (!value) {
    return '-';
  }

  const normalized = value.includes('T') ? value : `${value}T00:00:00`;

  return new Intl.DateTimeFormat('fr-BE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(normalized));
}

export function formatTimeLabel(value: string | null): string {
  return value ? value.slice(0, 5) : '-';
}

export function weekdayShortLabel(day: number): string {
  return ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][day] ?? String(day);
}
