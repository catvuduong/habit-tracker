import { formatDay } from '@/lib/days';
import type { WeekCompletion } from '@/lib/stats';

const WIDTH = 480;
const HEIGHT = 220;
const PLOT = { left: 40, right: 472, top: 20, bottom: 180 };
const BAR_WIDTH = 24;
const RADIUS = 4;

/** Bar with rounded top corners only, so it sits square on the baseline. */
function barPath(x: number, top: number, width: number, bottom: number): string {
  const height = bottom - top;
  const r = Math.min(RADIUS, height / 2);
  return [
    `M${x} ${bottom}`,
    `V${top + r}`,
    `Q${x} ${top} ${x + r} ${top}`,
    `H${x + width - r}`,
    `Q${x + width} ${top} ${x + width} ${top + r}`,
    `V${bottom}`,
    'Z',
  ].join(' ');
}

export function WeeklyChart({ weeks }: { weeks: WeekCompletion[] }) {
  const plotHeight = PLOT.bottom - PLOT.top;
  const slot = (PLOT.right - PLOT.left) / weeks.length;
  const yFor = (rate: number) => PLOT.bottom - rate * plotHeight;
  const current = weeks[weeks.length - 1];
  const percent = (rate: number | null) => (rate === null ? '–' : `${Math.round(rate * 100)}%`);

  return (
    <figure className="weekly-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Weekly completion for the last ${weeks.length} weeks. This week ${percent(current.rate)}.`}
        preserveAspectRatio="xMidYMid meet"
      >
        {[0, 0.5, 1].map((tick) => (
          <g key={tick}>
            <line className="chart-grid" x1={PLOT.left} x2={PLOT.right} y1={yFor(tick)} y2={yFor(tick)} />
            <text className="chart-tick" x={PLOT.left - 8} y={yFor(tick) + 4} textAnchor="end">
              {tick * 100}%
            </text>
          </g>
        ))}
        {weeks.map((week, i) => {
          const x = PLOT.left + i * slot + (slot - BAR_WIDTH) / 2;
          const label = `Week of ${formatDay(week.weekStart, { month: 'short', day: 'numeric' })}: ${percent(week.rate)}${
            week.rate === null ? '' : ` (${week.done} of ${week.possible} check-ins)`
          }`;
          const isCurrent = i === weeks.length - 1;
          const top = week.rate === null ? PLOT.bottom : yFor(week.rate);
          return (
            <g key={week.weekStart}>
              {/* Full-slot transparent target so the tooltip is easy to hit. */}
              <rect x={PLOT.left + i * slot} y={PLOT.top} width={slot} height={plotHeight} fill="transparent">
                <title>{label}</title>
              </rect>
              {week.rate !== null && <path className="chart-bar" d={barPath(x, top, BAR_WIDTH, PLOT.bottom)} />}
              {isCurrent && (
                <text className="chart-value" x={x + BAR_WIDTH / 2} y={top - 6} textAnchor="middle">
                  {percent(week.rate)}
                </text>
              )}
              <text className="chart-tick" x={x + BAR_WIDTH / 2} y={PLOT.bottom + 18} textAnchor="middle">
                {formatDay(week.weekStart, { month: 'short', day: 'numeric' })}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
