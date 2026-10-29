import type { CSSProperties } from 'react';
import { formatDay } from '@/lib/days';
import { heatmapCells, HEATMAP_WEEKS } from '@/lib/stats';
import type { Day, HabitOverview } from '@/lib/types';

interface HeatmapProps {
  habit: HabitOverview;
  today: Day;
}

const STATE_LABEL = { done: 'checked in', missed: 'missed', empty: 'not tracked' } as const;

export function Heatmap({ habit, today }: HeatmapProps) {
  const cells = heatmapCells(habit, today);
  const checkedIn = cells.filter((cell) => cell.state === 'done').length;

  return (
    <div
      data-testid="heatmap"
      role="img"
      aria-label={`${habit.name}: ${checkedIn} check-ins in the last ${HEATMAP_WEEKS} weeks`}
      className="heatmap"
      style={{ '--habit': habit.color, '--weeks': cells.length / 7 } as CSSProperties}
    >
      {cells.map((cell, i) => (
        <span
          key={cell.day}
          className="heatmap-cell"
          style={{ gridColumn: Math.floor(i / 7) + 1, gridRow: (i % 7) + 1 }}
          data-state={cell.state}
          data-today={cell.isToday || undefined}
          title={`${formatDay(cell.day, { weekday: 'short', month: 'short', day: 'numeric' })}: ${STATE_LABEL[cell.state]}`}
        />
      ))}
    </div>
  );
}
