import type { Query } from '../db.service.js';
import { addDays } from './dates.js';
import { DEMO_HABITS, DEMO_HISTORY_DAYS, demoCheckins, seedDemoHabits } from './demo-seed.js';
import { currentStreak, longestStreak } from './streaks.js';

const TODAY = '2026-10-29';

function daysOf(habitIndex: number, checkins = demoCheckins(TODAY)) {
  return checkins.filter((c) => c.habitIndex === habitIndex).map((c) => c.day);
}

describe('demoCheckins', () => {
  it('is deterministic for the same day', () => {
    expect(demoCheckins(TODAY)).toEqual(demoCheckins(TODAY));
  });

  it('only produces days inside the demo history window', () => {
    const earliest = addDays(TODAY, -(DEMO_HISTORY_DAYS - 1));
    for (const { day } of demoCheckins(TODAY)) {
      expect(day >= earliest && day <= TODAY).toBe(true);
    }
  });

  it('gives every demo habit a believable history with its pinned current streak', () => {
    const checkins = demoCheckins(TODAY);
    DEMO_HABITS.forEach((habit, index) => {
      const days = daysOf(index, checkins);
      expect(currentStreak(days, TODAY), habit.name).toBe(habit.currentStreak);
      expect(days.includes(TODAY), habit.name).toBe(habit.doneToday);
      expect(longestStreak(days), habit.name).toBeGreaterThanOrEqual(habit.currentStreak);
      expect(days.length / DEMO_HISTORY_DAYS, habit.name).toBeGreaterThan(0.2);
      expect(days.length / DEMO_HISTORY_DAYS, habit.name).toBeLessThan(0.95);
    });
  });
});

describe('seedDemoHabits', () => {
  function fakeDb(existingHabits: number) {
    const statements: { sql: string; params: unknown[] }[] = [];
    const query: Query = async <T = unknown>(sql: string, params: unknown[] = []) => {
      statements.push({ sql, params });
      if (sql.includes('count(*)')) return [{ count: existingHabits }] as T[];
      if (sql.startsWith('INSERT INTO habits')) return [{ id: statements.length }] as T[];
      return [] as T[];
    };
    const db = { transaction: <T>(fn: (q: Query) => Promise<T>) => fn(query) };
    return { db, statements };
  }

  it('inserts the demo habits and their history into an empty database', async () => {
    const { db, statements } = fakeDb(0);

    expect(await seedDemoHabits(db, TODAY)).toBe(true);

    const habitInserts = statements.filter((s) => s.sql.startsWith('INSERT INTO habits'));
    expect(habitInserts).toHaveLength(DEMO_HABITS.length);
    const checkinInsert = statements.find((s) => s.sql.startsWith('INSERT INTO checkins'));
    expect(checkinInsert?.params[1]).toHaveLength(demoCheckins(TODAY).length);
  });

  it('does nothing once any habit exists, so restarts never duplicate data', async () => {
    const { db, statements } = fakeDb(2);

    expect(await seedDemoHabits(db, TODAY)).toBe(false);

    expect(statements.some((s) => s.sql.startsWith('INSERT'))).toBe(false);
  });

  it('takes a transaction-scoped advisory lock before checking for existing data', async () => {
    const { db, statements } = fakeDb(0);

    await seedDemoHabits(db, TODAY);

    expect(statements[0].sql).toContain('pg_advisory_xact_lock');
  });
});
