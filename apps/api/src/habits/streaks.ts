import { addDays, Day, daysBetween } from './dates.js';

/**
 * Consecutive days ending at `today`. If `today` is not checked yet the streak
 * is still alive and counts back from yesterday; a gap of one or more days ends it.
 */
export function currentStreak(days: Iterable<Day>, today: Day): number {
  const done = new Set(days);
  let cursor = done.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (done.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Longest run of consecutive days anywhere in the history. */
export function longestStreak(days: Iterable<Day>): number {
  const sorted = [...new Set(days)].sort();
  let longest = 0;
  let run = 0;
  let previous: Day | null = null;
  for (const day of sorted) {
    run = previous !== null && daysBetween(previous, day) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  return longest;
}

export interface CompletionWindow {
  from: Day;
  to: Day;
  today: Day;
  /** The habit's creation day: nothing before it is expected. */
  createdOn: Day;
}

/**
 * Share of expected days in the window that were checked. The window starts at
 * the later of `from` and creation day, and ends at `to` capped at `today`.
 * Today only counts once it is checked, matching how the current streak treats it.
 * Returns `rate: null` when the window contains no expected days.
 */
export function completionRate(days: Iterable<Day>, window: CompletionWindow) {
  const done = new Set(days);
  const start = window.from > window.createdOn ? window.from : window.createdOn;
  let end = window.to < window.today ? window.to : window.today;
  if (end === window.today && !done.has(window.today)) end = addDays(window.today, -1);
  if (end < start) return { done: 0, possible: 0, rate: null };

  const possible = daysBetween(start, end) + 1;
  let count = 0;
  for (let day = start; day <= end; day = addDays(day, 1)) {
    if (done.has(day)) count++;
  }
  return { done: count, possible, rate: count / possible };
}
