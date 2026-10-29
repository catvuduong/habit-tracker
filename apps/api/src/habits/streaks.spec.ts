import { completionRate, currentStreak, longestStreak } from './streaks.js';

describe('currentStreak', () => {
  it('is 0 without check-ins', () => {
    expect(currentStreak([], '2026-06-10')).toBe(0);
  });

  it('counts today and the days before it', () => {
    expect(currentStreak(['2026-06-08', '2026-06-09', '2026-06-10'], '2026-06-10')).toBe(3);
  });

  it('keeps the streak alive while today is not checked yet', () => {
    expect(currentStreak(['2026-06-08', '2026-06-09'], '2026-06-10')).toBe(2);
  });

  it('is 0 when neither today nor yesterday is checked', () => {
    expect(currentStreak(['2026-06-07', '2026-06-08'], '2026-06-10')).toBe(0);
  });

  it('stops at the first gap', () => {
    const days = ['2026-06-05', '2026-06-07', '2026-06-08', '2026-06-09', '2026-06-10'];
    expect(currentStreak(days, '2026-06-10')).toBe(4);
  });

  it('ignores check-ins after today', () => {
    expect(currentStreak(['2026-06-09', '2026-06-10', '2026-06-11'], '2026-06-10')).toBe(2);
  });

  it('crosses a month boundary', () => {
    expect(currentStreak(['2026-02-27', '2026-02-28', '2026-03-01'], '2026-03-01')).toBe(3);
  });

  it('crosses a non-leap February without skipping a day', () => {
    // 2026 is not a leap year, so 2026-02-28 is followed directly by 2026-03-01.
    expect(currentStreak(['2026-02-28', '2026-03-01'], '2026-03-01')).toBe(2);
  });

  it('crosses the 29th of February in a leap year', () => {
    expect(currentStreak(['2028-02-28', '2028-02-29', '2028-03-01'], '2028-03-01')).toBe(3);
  });

  it('crosses a year boundary', () => {
    expect(currentStreak(['2026-12-31', '2027-01-01', '2027-01-02'], '2027-01-02')).toBe(3);
  });

  it('accepts duplicate days without double counting', () => {
    expect(currentStreak(['2026-06-09', '2026-06-09', '2026-06-10'], '2026-06-10')).toBe(2);
  });
});

describe('longestStreak', () => {
  it('is 0 without check-ins', () => {
    expect(longestStreak([])).toBe(0);
  });

  it('finds the longest run anywhere in the history', () => {
    const days = ['2026-01-01', '2026-01-02', '2026-01-10', '2026-01-11', '2026-01-12', '2026-01-13'];
    expect(longestStreak(days)).toBe(4);
  });

  it('does not depend on input order or duplicates', () => {
    expect(longestStreak(['2026-01-03', '2026-01-01', '2026-01-02', '2026-01-02'])).toBe(3);
  });

  it('bridges a month boundary', () => {
    expect(longestStreak(['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02'])).toBe(4);
  });

  it('counts a run across a non-leap February correctly', () => {
    expect(longestStreak(['2026-02-27', '2026-02-28', '2026-03-01'])).toBe(3);
  });

  it('bridges the leap day', () => {
    expect(longestStreak(['2028-02-28', '2028-02-29', '2028-03-01'])).toBe(3);
  });

  it('bridges a year boundary', () => {
    expect(longestStreak(['2026-12-30', '2026-12-31', '2027-01-01'])).toBe(3);
  });
});

describe('completionRate', () => {
  const window = { from: '2026-06-01', to: '2026-06-10', today: '2026-06-10', createdOn: '2026-01-01' };

  it('is the share of expected days that were checked', () => {
    const days = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'];
    // 9 expected days (06-01..06-09); today (06-10) is unchecked so it is not expected yet.
    expect(completionRate(days, window)).toEqual({ done: 5, possible: 9, rate: 5 / 9 });
  });

  it('counts today once it is checked', () => {
    const days = ['2026-06-10'];
    expect(completionRate(days, window)).toEqual({ done: 1, possible: 10, rate: 0.1 });
  });

  it('does not penalise an unchecked today', () => {
    const days = ['2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-06-06', '2026-06-07', '2026-06-08', '2026-06-09'];
    expect(completionRate(days, { ...window, from: '2026-06-02' })).toEqual({ done: 8, possible: 8, rate: 1 });
  });

  it('does not expect days before the habit was created', () => {
    const days = ['2026-06-08', '2026-06-09', '2026-06-10'];
    expect(completionRate(days, { ...window, createdOn: '2026-06-08' })).toEqual({ done: 3, possible: 3, rate: 1 });
  });

  it('spans a month boundary', () => {
    const days = ['2026-02-28', '2026-03-01', '2026-03-02'];
    const range = { from: '2026-02-27', to: '2026-03-02', today: '2026-03-02', createdOn: '2026-01-01' };
    expect(completionRate(days, range)).toEqual({ done: 3, possible: 4, rate: 0.75 });
  });

  it('is null when the window has no expected days', () => {
    expect(completionRate([], { ...window, from: '2026-06-10', createdOn: '2026-06-10' })).toEqual({
      done: 0,
      possible: 0,
      rate: null,
    });
  });

  it('is null for a future window', () => {
    expect(completionRate([], { from: '2026-07-01', to: '2026-07-07', today: '2026-06-10', createdOn: '2026-01-01' }).rate).toBeNull();
  });
});
