'use client';

import { CSSProperties, ReactNode, useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  archiveHabit,
  createHabit,
  fetchHealth,
  fetchOverview,
  setCheckin,
  updateHabit,
} from '@/lib/api';
import { addDays, formatDay, toDay } from '@/lib/days';
import { HEATMAP_WEEKS, weeklyCompletion } from '@/lib/stats';
import type { Day, HabitFormValues, HabitOverview, Overview } from '@/lib/types';
import { HabitCard } from './habit-card';
import { HabitDialog } from './habit-dialog';
import { Heatmap } from './heatmap';
import { WeeklyChart } from './weekly-chart';

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; overview: Overview };

type DialogState = { habit: HabitOverview | null } | null;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong';
}

const subscribeToNothing = () => () => {};

/** The viewer's local day. Null on the server and during hydration, so the prerendered page never shows a stale date. */
function useToday(): Day | null {
  return useSyncExternalStore(subscribeToNothing, () => toDay(), () => null);
}

/** Applies a check-in locally so the UI responds at once. The server's numbers replace this on refresh. */
function withCheckin(habit: HabitOverview, day: Day, done: boolean): HabitOverview {
  if (habit.doneToday === done) return habit;
  return {
    ...habit,
    doneToday: done,
    checkins: done ? [...habit.checkins, day] : habit.checkins.filter((d) => d !== day),
    currentStreak: Math.max(0, habit.currentStreak + (done ? 1 : -1)),
  };
}

function mapHabit(state: LoadState, id: number, change: (habit: HabitOverview) => HabitOverview): LoadState {
  if (state.status !== 'ready') return state;
  return {
    status: 'ready',
    overview: { ...state.overview, habits: state.overview.habits.map((h) => (h.id === id ? change(h) : h)) },
  };
}

export function Dashboard() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [pending, setPending] = useState<ReadonlySet<number>>(() => new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [health, setHealth] = useState('checking…');
  const today = useToday();

  const refresh = useCallback(async () => {
    const today = toDay();
    try {
      const overview = await fetchOverview(addDays(today, -(HEATMAP_WEEKS * 7 - 1)), today, today);
      setLoad({ status: 'ready', overview });
    } catch (err) {
      // Keep showing the last good data if a background refresh fails.
      setLoad((prev) => (prev.status === 'ready' ? prev : { status: 'error', message: errorMessage(err) }));
    }
  }, []);

  useEffect(() => {
    void refresh();
    fetchHealth()
      .then((d) => setHealth(`api ${d.status} / db ${d.db}`))
      .catch(() => setHealth('api unreachable'));
  }, [refresh]);

  async function toggle(habit: HabitOverview) {
    const today = toDay();
    const done = !habit.doneToday;
    setActionError(null);
    setPending((p) => new Set(p).add(habit.id));
    setLoad((prev) => mapHabit(prev, habit.id, (h) => withCheckin(h, today, done)));
    try {
      await setCheckin(habit.id, today, done);
    } catch (err) {
      setLoad((prev) => mapHabit(prev, habit.id, (h) => withCheckin(h, today, !done)));
      setActionError(`Couldn't update “${habit.name}”: ${errorMessage(err)}`);
    }
    setPending((p) => {
      const next = new Set(p);
      next.delete(habit.id);
      return next;
    });
    await refresh();
  }

  async function saveHabit(values: HabitFormValues, id: number | undefined) {
    if (id === undefined) await createHabit(values);
    else await updateHabit(id, values);
    await refresh();
  }

  async function archive(id: number) {
    await archiveHabit(id);
    await refresh();
  }

  if (load.status === 'loading' || today === null) {
    return (
      <Shell today={today} health={health} onAdd={() => setDialog({ habit: null })}>
        <div className="skeleton-grid" aria-busy="true" aria-label="Loading habits">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton skeleton-card" />
          ))}
        </div>
      </Shell>
    );
  }

  if (load.status === 'error') {
    return (
      <Shell today={today} health={health} onAdd={() => setDialog({ habit: null })}>
        <div className="state-card" role="alert">
          <h2>Couldn’t reach your habits</h2>
          <p>{load.message}. Check that the API is running and try again.</p>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setLoad({ status: 'loading' });
              void refresh();
            }}
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  const { overview } = load;
  const habits = overview.habits.filter((h) => !h.archived);
  const doneCount = habits.filter((h) => h.doneToday).length;
  const weeks = weeklyCompletion(habits, overview.today);
  const thisWeek = weeks[weeks.length - 1];

  return (
    <Shell today={today} health={health} onAdd={() => setDialog({ habit: null })}>
      {actionError && (
        <div className="banner" role="alert">
          <span>{actionError}</span>
          <button type="button" className="ghost-button" onClick={() => setActionError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {habits.length === 0 ? (
        <div className="state-card empty-state">
          <span className="empty-emoji" aria-hidden>
            🌱
          </span>
          <h2>Start with one small habit</h2>
          <p>Pick something you can do in five minutes. Check it off each day to build a streak.</p>
          <button type="button" className="primary-button" onClick={() => setDialog({ habit: null })}>
            Add your first habit
          </button>
        </div>
      ) : (
        <>
          <section className="section" aria-labelledby="today-heading">
            <div className="section-heading">
              <h2 id="today-heading">Check in</h2>
              <p className="muted">
                {doneCount} of {habits.length} done
              </p>
            </div>
            <div className="today-grid">
              {habits.map((habit) => (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  busy={pending.has(habit.id)}
                  onToggle={() => void toggle(habit)}
                  onEdit={() => setDialog({ habit })}
                />
              ))}
            </div>
          </section>

          <section className="section analytics" aria-labelledby="consistency-heading">
            <div className="panel panel-heatmaps">
              <div className="section-heading">
                <h2 id="consistency-heading">Last {HEATMAP_WEEKS} weeks</h2>
                <Legend />
              </div>
              <ul className="heatmap-list">
                {habits.map((habit) => (
                  <li key={habit.id} className="heatmap-row" style={{ '--habit': habit.color } as CSSProperties}>
                    <div className="heatmap-meta">
                      <span className="habit-emoji small" aria-hidden>
                        {habit.emoji}
                      </span>
                      <div>
                        <strong>{habit.name}</strong>
                        <span className="muted small">
                          Best {habit.longestStreak} days ·{' '}
                          {habit.completionRate === null ? 'not started' : `${Math.round(habit.completionRate * 100)}% complete`}
                        </span>
                      </div>
                    </div>
                    <Heatmap habit={habit} today={overview.today} />
                  </li>
                ))}
              </ul>
            </div>

            <div className="panel panel-weekly">
              <div className="section-heading">
                <h2>Weekly completion</h2>
                <p className="muted small">
                  {thisWeek.rate === null
                    ? 'No check-ins yet this week'
                    : `${Math.round(thisWeek.rate * 100)}% this week`}
                </p>
              </div>
              <WeeklyChart weeks={weeks} />
              <p className="muted small">
                Week of {formatDay(weeks[0].weekStart, { month: 'short', day: 'numeric' })} to today, across all habits.
              </p>
            </div>
          </section>
        </>
      )}

      {dialog && (
        <HabitDialog
          key={dialog.habit?.id ?? 'new'}
          habit={dialog.habit}
          onClose={() => setDialog(null)}
          onSave={(values) => saveHabit(values, dialog.habit?.id)}
          onArchive={() => archive(dialog.habit!.id)}
        />
      )}
    </Shell>
  );
}

function Legend() {
  return (
    <div className="legend" aria-hidden>
      <span className="legend-item">
        <span className="heatmap-cell" data-state="missed" /> Missed
      </span>
      <span className="legend-item">
        <span className="heatmap-cell" data-state="done" /> Checked in
      </span>
    </div>
  );
}

function Shell({
  today,
  health,
  onAdd,
  children,
}: {
  today: Day | null;
  health: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            {today ? formatDay(today, { weekday: 'long', month: 'long', day: 'numeric' }) : ' '}
          </p>
          <h1>Habits</h1>
        </div>
        <button type="button" className="primary-button" onClick={onAdd}>
          <span aria-hidden>+</span> New habit
        </button>
      </header>
      {children}
      <footer className="page-footer">
        <span data-testid="health">{health}</span>
      </footer>
    </main>
  );
}
