import type { Day, HabitFormValues, HabitOverview, Overview } from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(res.status, body?.message ?? `Request failed (${res.status})`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export function fetchOverview(from: Day, to: Day, today: Day): Promise<Overview> {
  const query = new URLSearchParams({ from, to, today });
  return request<Overview>(`/habits/overview?${query}`);
}

export function fetchHealth(): Promise<{ status: string; db: string }> {
  return request(`/health`);
}

export function setCheckin(habitId: number, day: Day, done: boolean): Promise<void> {
  return request(`/habits/${habitId}/checkins/${day}`, { method: done ? 'PUT' : 'DELETE' });
}

export function createHabit(values: HabitFormValues): Promise<HabitOverview> {
  return request('/habits', { method: 'POST', body: JSON.stringify(values) });
}

export function updateHabit(id: number, values: HabitFormValues): Promise<HabitOverview> {
  return request(`/habits/${id}`, { method: 'PATCH', body: JSON.stringify(values) });
}

export function archiveHabit(id: number): Promise<void> {
  return request(`/habits/${id}`, { method: 'DELETE' });
}
