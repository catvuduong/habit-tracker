import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

export type Query = <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS items (id SERIAL PRIMARY KEY, title TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now())',
  `CREATE TABLE IF NOT EXISTS habits (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived BOOLEAN NOT NULL DEFAULT false
  )`,
  `CREATE TABLE IF NOT EXISTS checkins (
    id SERIAL PRIMARY KEY,
    habit_id INTEGER NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
    day DATE NOT NULL,
    UNIQUE (habit_id, day)
  )`,
];

@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, max: 3 })
    : null;
  private ready: Promise<void> | null = null;

  get enabled(): boolean {
    return this.pool !== null;
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (!this.pool) throw new Error('DATABASE_URL is not set');
    await this.ensureSchema();
    const res = await this.pool.query(sql, params);
    return res.rows as T[];
  }

  /** Runs `fn` inside one transaction on a single connection. */
  async transaction<T>(fn: (query: Query) => Promise<T>): Promise<T> {
    if (!this.pool) throw new Error('DATABASE_URL is not set');
    await this.ensureSchema();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(async (sql, params = []) => (await client.query(sql, params)).rows);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  private ensureSchema(): Promise<void> {
    this.ready ??= (async () => {
      for (const statement of SCHEMA) await this.pool!.query(statement);
    })();
    return this.ready;
  }
}
