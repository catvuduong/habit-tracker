import { Injectable, Logger, NotFoundException, ConflictException, OnModuleInit } from '@nestjs/common';
import { DbService } from '../db.service.js';
import { Day, toDay } from './dates.js';
import { seedDemoHabits } from './demo-seed.js';
import { HabitPatch, OverviewQuery, parseOverviewRange } from './habit-input.js';
import { completionRate, currentStreak, longestStreak } from './streaks.js';

export interface Habit {
  id: number;
  name: string;
  emoji: string;
  color: string;
  createdAt: Date;
  archived: boolean;
}

export interface HabitOverview {
  id: number;
  name: string;
  emoji: string;
  color: string;
  archived: boolean;
  createdOn: Day;
  doneToday: boolean;
  /** Checked-in days inside the requested range, ascending. */
  checkins: Day[];
  currentStreak: number;
  longestStreak: number;
  /** Null when the range holds no expected days (e.g. a habit created today). */
  completionRate: number | null;
}

const HABIT_COLUMNS = 'id, name, emoji, color, created_at AS "createdAt", archived';

@Injectable()
export class HabitsService implements OnModuleInit {
  private readonly logger = new Logger(HabitsService.name);

  constructor(private readonly db: DbService) {}

  async onModuleInit() {
    if (!this.db.enabled) return;
    try {
      await seedDemoHabits(this.db, toDay(new Date()));
    } catch (err) {
      this.logger.warn(`demo habits not seeded: ${String(err)}`);
    }
  }

  list(includeArchived: boolean): Promise<Habit[]> {
    return this.db.query<Habit>(
      `SELECT ${HABIT_COLUMNS} FROM habits WHERE $1::boolean OR NOT archived ORDER BY id`,
      [includeArchived],
    );
  }

  async create(input: { name: string; emoji: string; color: string }): Promise<Habit> {
    const [habit] = await this.db.query<Habit>(
      `INSERT INTO habits (name, emoji, color) VALUES ($1, $2, $3) RETURNING ${HABIT_COLUMNS}`,
      [input.name, input.emoji, input.color],
    );
    return habit;
  }

  async update(id: number, patch: HabitPatch): Promise<Habit> {
    const [habit] = await this.db.query<Habit>(
      `UPDATE habits
          SET name = COALESCE($2, name),
              emoji = COALESCE($3, emoji),
              color = COALESCE($4, color),
              archived = COALESCE($5, archived)
        WHERE id = $1
    RETURNING ${HABIT_COLUMNS}`,
      [id, patch.name ?? null, patch.emoji ?? null, patch.color ?? null, patch.archived ?? null],
    );
    if (!habit) throw new NotFoundException('habit not found');
    return habit;
  }

  /** Soft delete: the habit and its history are kept, it just leaves the dashboard. */
  async archive(id: number): Promise<void> {
    await this.update(id, { archived: true });
  }

  async setCheckin(id: number, day: Day, done: boolean): Promise<void> {
    const [habit] = await this.db.query<{ archived: boolean }>('SELECT archived FROM habits WHERE id = $1', [id]);
    if (!habit) throw new NotFoundException('habit not found');
    if (habit.archived) throw new ConflictException('habit is archived');

    if (done) {
      // ON CONFLICT makes a repeated check-in a no-op, so PUT is idempotent.
      await this.db.query('INSERT INTO checkins (habit_id, day) VALUES ($1, $2) ON CONFLICT (habit_id, day) DO NOTHING', [id, day]);
    } else {
      await this.db.query('DELETE FROM checkins WHERE habit_id = $1 AND day = $2', [id, day]);
    }
  }

  async overview(query: OverviewQuery) {
    const range = parseOverviewRange(query);
    const habits = await this.db.query<Habit & { createdOn: Day }>(
      `SELECT ${HABIT_COLUMNS}, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS "createdOn"
         FROM habits WHERE NOT archived ORDER BY id`,
    );
    const rows = await this.db.query<{ habitId: number; day: Day }>(
      'SELECT habit_id AS "habitId", day::text AS day FROM checkins WHERE habit_id = ANY($1::int[]) ORDER BY day',
      [habits.map((h) => h.id)],
    );

    const daysByHabit = new Map<number, Day[]>();
    for (const row of rows) {
      const days = daysByHabit.get(row.habitId) ?? [];
      days.push(row.day);
      daysByHabit.set(row.habitId, days);
    }

    const result: HabitOverview[] = habits.map((habit) => {
      const days = daysByHabit.get(habit.id) ?? [];
      return {
        id: habit.id,
        name: habit.name,
        emoji: habit.emoji,
        color: habit.color,
        archived: habit.archived,
        createdOn: habit.createdOn,
        doneToday: days.includes(range.today),
        checkins: days.filter((day) => day >= range.from && day <= range.to),
        currentStreak: currentStreak(days, range.today),
        longestStreak: longestStreak(days),
        completionRate: completionRate(days, { ...range, createdOn: habit.createdOn }).rate,
      };
    });

    return { ...range, habits: result };
  }
}
