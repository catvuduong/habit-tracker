import { addDays, daysBetween, startOfWeek } from './days';
import type { Day, HabitOverview } from './types';

export const HEATMAP_WEEKS = 12;
export const WEEKLY_CHART_WEEKS = 8;

export type HeatCellState = 'done' | 'missed' | 'empty';

export interface HeatCell {
  day: Day;
  state: HeatCellState;
  isToday: boolean;
}

/**
 * Cells for a GitHub-style grid: one column per Monday-start week, rows are
 * weekdays, filled top to bottom. Days after today and days before the habit
 * existed are `empty`, so the grid never shows a miss the user could not have made.
 */
export function heatmapCells(habit: HabitOverview, today: Day, weeks = HEATMAP_WEEKS): HeatCell[] {
  const windowStart = addDays(today, -(weeks * 7 - 1));
  const gridStart = startOfWeek(windowStart);
  const done = new Set(habit.checkins);
  const columns = Math.ceil((daysBetween(gridStart, today) + 1) / 7);

  const cells: HeatCell[] = [];
  for (let i = 0; i < columns * 7; i++) {
    const day = addDays(gridStart, i);
    const inWindow = day >= windowStart && day <= today;
    // A recorded check-in always shows, even if createdOn (UTC) is ahead of the viewer's local day.
    const state = done.has(day) ? 'done' : inWindow && day >= habit.createdOn ? 'missed' : 'empty';
    cells.push({ day, state, isToday: day === today });
  }
  return cells;
}

export interface WeekCompletion {
  weekStart: Day;
  done: number;
  possible: number;
  /** Null when no habit had an expected day that week. */
  rate: number | null;
}

/**
 * Completion per Monday-start week across all habits. Mirrors the API rule:
 * days before a habit existed are not expected, and today only counts once it is checked.
 */
export function weeklyCompletion(habits: HabitOverview[], today: Day, weeks = WEEKLY_CHART_WEEKS): WeekCompletion[] {
  const thisWeek = startOfWeek(today);
  const result: WeekCompletion[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = addDays(thisWeek, -7 * w);
    const weekEnd = addDays(weekStart, 6);
    let done = 0;
    let possible = 0;
    for (const habit of habits) {
      const checked = new Set(habit.checkins);
      const end = weekEnd < today ? weekEnd : checked.has(today) ? today : addDays(today, -1);
      const start = weekStart > habit.createdOn ? weekStart : habit.createdOn;
      for (let day = start; day <= end; day = addDays(day, 1)) {
        possible++;
        if (checked.has(day)) done++;
      }
    }
    result.push({ weekStart, done, possible, rate: possible > 0 ? done / possible : null });
  }
  return result;
}
