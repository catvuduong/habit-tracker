import type { CSSProperties } from 'react';
import type { HabitOverview } from '@/lib/types';

interface HabitCardProps {
  habit: HabitOverview;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
}

export function StreakBadge({ days }: { days: number }) {
  return (
    <span data-testid="streak-badge" className={days > 0 ? 'streak-badge is-active' : 'streak-badge'}>
      {days > 0 ? (
        <>
          <span aria-hidden>🔥</span> {days}-day streak
        </>
      ) : (
        'No streak yet'
      )}
    </span>
  );
}

export function HabitCard({ habit, busy, onToggle, onEdit }: HabitCardProps) {
  return (
    <article
      data-testid="habit-card"
      className="habit-card"
      style={{ '--habit': habit.color } as CSSProperties}
    >
      <header className="habit-card-header">
        <span className="habit-emoji" aria-hidden>
          {habit.emoji}
        </span>
        <div className="habit-card-title">
          <h3>{habit.name}</h3>
          <StreakBadge days={habit.currentStreak} />
        </div>
        <button type="button" className="icon-button" onClick={onEdit} aria-label={`Edit ${habit.name}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
      </header>
      <button
        data-testid="checkin-button"
        type="button"
        className="checkin-button"
        aria-pressed={habit.doneToday}
        disabled={busy}
        onClick={onToggle}
      >
        <span className="checkin-mark" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5 10 17 19 7" />
          </svg>
        </span>
        <span>{habit.doneToday ? 'Done for today' : 'Check in'}</span>
      </button>
    </article>
  );
}
