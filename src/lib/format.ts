const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function dateParts(iso: string): { day: string; month: string; year: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { day: '—', month: '', year: '' };
  return {
    day: String(date.getUTCDate()).padStart(2, '0'),
    month: MONTHS[date.getUTCMonth()] ?? '',
    year: String(date.getUTCFullYear()),
  };
}

export function fixed(value: number, digits = 2): string {
  return value.toFixed(digits);
}

export function percent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function retrievedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
