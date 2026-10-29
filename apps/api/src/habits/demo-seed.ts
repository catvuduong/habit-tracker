import type { DbService } from '../db.service.js';
import { addDays, Day } from './dates.js';

export const DEMO_HISTORY_DAYS = 84; // 12 weeks, so the dashboard heatmaps are full on first load
const DEMO_LOCK_KEY = 'habits-demo-seed';

interface DemoHabit {
  name: string;
  emoji: string;
  color: string;
  /** Chance a past day (beyond the pinned streak) was checked. */
  rate: number;
  /** Length of the streak that is alive today. */
  currentStreak: number;
  doneToday: boolean;
}

// Colours are the reference palette's categorical slots (light values).
export const DEMO_HABITS: DemoHabit[] = [
  { name: 'Morning run', emoji: '🏃', color: '#eb6834', rate: 0.8, currentStreak: 5, doneToday: false },
  { name: 'Read 20 pages', emoji: '📚', color: '#6250d6', rate: 0.7, currentStreak: 9, doneToday: true },
  { name: 'Drink 2 L water', emoji: '💧', color: '#2a78d6', rate: 0.9, currentStreak: 14, doneToday: true },
  { name: 'Meditate', emoji: '🧘', color: '#1baf7a', rate: 0.45, currentStreak: 0, doneToday: false },
];

/** Deterministic pseudo-random number in [0, 1) for a (habit, day offset) pair. */
function unit(habitIndex: number, offset: number): number {
  let h = Math.imul(habitIndex + 1, 0x9e3779b1) ^ Math.imul(offset + 1, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** Whether the habit was done `offset` days before today (0 = today). */
function isDone(habit: DemoHabit, habitIndex: number, offset: number): boolean {
  const start = habit.doneToday ? 0 : 1;
  if (offset < start) return habit.doneToday;
  if (offset < start + habit.currentStreak) return true;
  if (offset === start + habit.currentStreak) return false; // the miss that ends the current streak
  return unit(habitIndex, offset) < habit.rate;
}

/** Check-in history for every demo habit, relative to `today`. Same input, same output. */
export function demoCheckins(today: Day): { habitIndex: number; day: Day }[] {
  const checkins: { habitIndex: number; day: Day }[] = [];
  DEMO_HABITS.forEach((habit, habitIndex) => {
    for (let offset = 0; offset < DEMO_HISTORY_DAYS; offset++) {
      if (isDone(habit, habitIndex, offset)) {
        checkins.push({ habitIndex, day: addDays(today, -offset) });
      }
    }
  });
  return checkins;
}

/**
 * Inserts the demo habits and their history into an empty database. Does nothing
 * once any habit exists (archived ones included), so restarts and concurrent
 * starts never duplicate data. Returns whether anything was inserted.
 */
export async function seedDemoHabits(db: Pick<DbService, 'transaction'>, today: Day): Promise<boolean> {
  return db.transaction(async (query) => {
    await query('SELECT pg_advisory_xact_lock(hashtext($1))', [DEMO_LOCK_KEY]);
    const [{ count }] = await query<{ count: number }>('SELECT count(*)::int AS count FROM habits');
    if (count > 0) return false;

    // Backdate creation so the whole demo history falls after the habit's creation day.
    const createdAt = `${addDays(today, -(DEMO_HISTORY_DAYS + 6))}T00:00:00Z`;
    const ids: number[] = [];
    for (const habit of DEMO_HABITS) {
      const [row] = await query<{ id: number }>(
        'INSERT INTO habits (name, emoji, color, created_at) VALUES ($1, $2, $3, $4) RETURNING id',
        [habit.name, habit.emoji, habit.color, createdAt],
      );
      ids.push(row.id);
    }

    const checkins = demoCheckins(today);
    await query(
      'INSERT INTO checkins (habit_id, day) SELECT * FROM unnest($1::int[], $2::date[]) ON CONFLICT DO NOTHING',
      [checkins.map((c) => ids[c.habitIndex]), checkins.map((c) => c.day)],
    );
    return true;
  });
}
