import { BadRequestException } from '@nestjs/common';
import { parseDay, parseHabitInput, parseOverviewRange } from './habit-input.js';

describe('parseDay', () => {
  it('accepts a real calendar day', () => {
    expect(parseDay('2028-02-29')).toBe('2028-02-29');
  });

  it.each(['2026-02-30', '2027-02-29', '2026-13-01', '26-06-01', '2026-06-1', 'tomorrow'])('rejects %s', (value) => {
    expect(() => parseDay(value)).toThrow(BadRequestException);
  });
});

describe('parseHabitInput', () => {
  it('requires every field when creating', () => {
    expect(() => parseHabitInput({ name: 'Run', emoji: '🏃' }, false)).toThrow(BadRequestException);
  });

  it('trims text and lower-cases the colour', () => {
    expect(parseHabitInput({ name: '  Run  ', emoji: ' 🏃 ', color: '#EB6834' }, false)).toEqual({
      name: 'Run',
      emoji: '🏃',
      color: '#eb6834',
    });
  });

  it('rejects blank or overlong names', () => {
    expect(() => parseHabitInput({ name: '   ', emoji: '🏃', color: '#eb6834' }, false)).toThrow(BadRequestException);
    expect(() => parseHabitInput({ name: 'x'.repeat(61), emoji: '🏃', color: '#eb6834' }, false)).toThrow(
      BadRequestException,
    );
  });

  it('rejects colours that are not six-digit hex', () => {
    expect(() => parseHabitInput({ name: 'Run', emoji: '🏃', color: 'red' }, false)).toThrow(BadRequestException);
    expect(() => parseHabitInput({ name: 'Run', emoji: '🏃', color: '#fff' }, false)).toThrow(BadRequestException);
  });

  it('only returns the fields that were sent when updating', () => {
    expect(parseHabitInput({ archived: true }, true)).toEqual({ archived: true });
  });

  it('rejects a non-boolean archived flag', () => {
    expect(() => parseHabitInput({ archived: 'yes' as unknown as boolean }, true)).toThrow(BadRequestException);
  });
});

describe('parseOverviewRange', () => {
  const now = new Date('2026-03-01T12:00:00Z');

  it('defaults to the 12 weeks ending on the server day', () => {
    expect(parseOverviewRange({}, now)).toEqual({ from: '2025-12-08', to: '2026-03-01', today: '2026-03-01' });
  });

  it('uses the caller supplied local day as today', () => {
    expect(parseOverviewRange({ today: '2026-03-02' }, now)).toEqual({
      from: '2025-12-09',
      to: '2026-03-02',
      today: '2026-03-02',
    });
  });

  it('rejects a reversed range', () => {
    expect(() => parseOverviewRange({ from: '2026-03-02', to: '2026-03-01' }, now)).toThrow(BadRequestException);
  });

  it('rejects ranges longer than a year', () => {
    expect(() => parseOverviewRange({ from: '2024-01-01', to: '2026-03-01' }, now)).toThrow(BadRequestException);
  });

  it('rejects malformed dates', () => {
    expect(() => parseOverviewRange({ from: '2026-3-1' }, now)).toThrow(BadRequestException);
  });
});
