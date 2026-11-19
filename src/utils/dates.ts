const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function daysAgoISO(days: number, from: Date = new Date()): string {
  const date = new Date(from.getTime() - days * MS_PER_DAY);
  return date.toISOString();
}

export function daysFromNowISO(days: number, from: Date = new Date()): string {
  const date = new Date(from.getTime() + days * MS_PER_DAY);
  return date.toISOString();
}

export function daysBetween(earlierISO: string, later: Date = new Date()): number {
  const earlierMs = new Date(earlierISO).getTime();
  if (Number.isNaN(earlierMs)) return 0;
  return Math.floor((later.getTime() - earlierMs) / MS_PER_DAY);
}

export function daysUntil(futureISO: string, from: Date = new Date()): number {
  const futureMs = new Date(futureISO).getTime();
  if (Number.isNaN(futureMs)) return Infinity;
  return Math.ceil((futureMs - from.getTime()) / MS_PER_DAY);
}

export function formatShortDate(iso: string, locale = 'en-IN'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatHeaderDate(date: Date = new Date(), locale = 'en-IN'): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
