/** A calendar day as `YYYY-MM-DD`. All day math is done in UTC so results never depend on the server's timezone. */
export type Day = string;

const MS_PER_DAY = 86_400_000;

export function isDay(value: string): value is Day {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  // Rejects impossible dates such as 2026-02-30 by checking they survive a round trip.
  return !Number.isNaN(date.getTime()) && toDay(date) === value;
}

export function toDay(date: Date): Day {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: Day, amount: number): Day {
  return toDay(new Date(Date.parse(`${day}T00:00:00Z`) + amount * MS_PER_DAY));
}

/** Number of days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: Day, to: Day): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);
}
