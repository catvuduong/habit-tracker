import { BadRequestException } from '@nestjs/common';
import { addDays, Day, daysBetween, isDay, toDay } from './dates.js';

export const OVERVIEW_DEFAULT_DAYS = 84; // 12 weeks, matches the dashboard heatmap
const OVERVIEW_MAX_DAYS = 366;

export interface OverviewQuery {
  from?: string;
  to?: string;
  /** The caller's local calendar day. Defaults to the server's UTC day. */
  today?: string;
}

export interface HabitInput {
  name?: string;
  emoji?: string;
  color?: string;
  archived?: boolean;
}

export interface HabitPatch {
  name?: string;
  emoji?: string;
  color?: string;
  archived?: boolean;
}

export function parseDay(value: string | undefined, field = 'day'): Day {
  if (value === undefined || !isDay(value)) {
    throw new BadRequestException(`${field} must be a valid YYYY-MM-DD date`);
  }
  return value;
}

export function parseOverviewRange(query: OverviewQuery, now = new Date()) {
  const today = query.today !== undefined ? parseDay(query.today, 'today') : toDay(now);
  const to = query.to !== undefined ? parseDay(query.to, 'to') : today;
  const from = query.from !== undefined ? parseDay(query.from, 'from') : addDays(to, -(OVERVIEW_DEFAULT_DAYS - 1));
  if (from > to) throw new BadRequestException('from must be on or before to');
  if (daysBetween(from, to) >= OVERVIEW_MAX_DAYS) throw new BadRequestException(`range must be at most ${OVERVIEW_MAX_DAYS} days`);
  return { from, to, today };
}

/** Validates a create (`partial: false`) or update (`partial: true`) body. */
export function parseHabitInput(body: HabitInput | undefined, partial: boolean): HabitPatch {
  const input = body ?? {};
  const out: HabitPatch = {};

  if (input.name !== undefined || !partial) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name || name.length > 60) throw new BadRequestException('name must be 1-60 characters');
    out.name = name;
  }
  if (input.emoji !== undefined || !partial) {
    const emoji = typeof input.emoji === 'string' ? input.emoji.trim() : '';
    // Length is in UTF-16 units; 16 leaves room for multi-codepoint emoji such as flags and ZWJ sequences.
    if (!emoji || emoji.length > 16) throw new BadRequestException('emoji is required');
    out.emoji = emoji;
  }
  if (input.color !== undefined || !partial) {
    if (typeof input.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(input.color)) {
      throw new BadRequestException('color must be a hex colour like #2a78d6');
    }
    out.color = input.color.toLowerCase();
  }
  if (input.archived !== undefined) {
    if (typeof input.archived !== 'boolean') throw new BadRequestException('archived must be a boolean');
    out.archived = input.archived;
  }
  return out;
}
