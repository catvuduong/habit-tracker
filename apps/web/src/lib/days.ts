import type { Day } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

function parse(day: Day): Date {
  const [y, m, d] = day.split('-').map(Number);
  // Noon avoids DST edges where local midnight does not exist.
  return new Date(y, m - 1, d, 12);
}

/** Local calendar day for a Date, as `YYYY-MM-DD`. */
export function toDay(date: Date = new Date()): Day {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(day: Day, amount: number): Day {
  const date = parse(day);
  date.setDate(date.getDate() + amount);
  return toDay(date);
}

/** Days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: Day, to: Day): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000);
}

/** Monday = 0 … Sunday = 6, so weeks start on Monday. */
export function mondayIndex(day: Day): number {
  return (parse(day).getDay() + 6) % 7;
}

export function startOfWeek(day: Day): Day {
  return addDays(day, -mondayIndex(day));
}

export function formatDay(day: Day, options: Intl.DateTimeFormatOptions): string {
  return parse(day).toLocaleDateString(undefined, options);
}
