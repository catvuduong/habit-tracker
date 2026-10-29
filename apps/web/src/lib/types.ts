/** A calendar day as `YYYY-MM-DD`, in the viewer's local time. */
export type Day = string;

export interface Overview {
  from: Day;
  to: Day;
  today: Day;
  habits: HabitOverview[];
}

export interface HabitOverview {
  id: number;
  name: string;
  emoji: string;
  color: string;
  archived: boolean;
  createdOn: Day;
  doneToday: boolean;
  checkins: Day[];
  currentStreak: number;
  longestStreak: number;
  completionRate: number | null;
}

export interface HabitFormValues {
  name: string;
  emoji: string;
  color: string;
}
