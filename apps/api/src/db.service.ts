import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

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
    this.ready ??= this.pool
      .query(
        'CREATE TABLE IF NOT EXISTS items (id SERIAL PRIMARY KEY, title TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now())',
      )
      .then(() => undefined);
    await this.ready;
    const res = await this.pool.query(sql, params);
    return res.rows as T[];
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }
}
