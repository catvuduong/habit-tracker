import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { addDays, toDay } from './../src/habits/dates.js';

describe('Habits (e2e)', () => {
  let app: INestApplication<App>;
  let server: App;
  const today = toDay(new Date());
  const created: number[] = [];

  async function createHabit(name = `E2E ${Date.now()} ${Math.random()}`) {
    const res = await request(server).post('/habits').send({ name, emoji: '✅', color: '#2a78d6' }).expect(201);
    created.push(res.body.id);
    return res.body as { id: number; name: string; archived: boolean };
  }

  async function overviewFor(id: number, query: Record<string, string> = {}) {
    const res = await request(server).get('/habits/overview').query({ today, ...query }).expect(200);
    const habit = res.body.habits.find((h: { id: number }) => h.id === id);
    expect(habit).toBeDefined();
    return habit as {
      doneToday: boolean;
      checkins: string[];
      currentStreak: number;
      longestStreak: number;
      completionRate: number | null;
    };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    // Archive what this suite created so the shared dev database dashboard stays clean.
    for (const id of created) await request(server).delete(`/habits/${id}`);
    await app.close();
  });

  describe('check-ins', () => {
    it('PUT is idempotent: repeating a check-in keeps a single entry', async () => {
      const habit = await createHabit();

      await request(server).put(`/habits/${habit.id}/checkins/${today}`).expect(200);
      await request(server).put(`/habits/${habit.id}/checkins/${today}`).expect(200);

      const after = await overviewFor(habit.id);
      expect(after.doneToday).toBe(true);
      expect(after.checkins).toEqual([today]);
      expect(after.currentStreak).toBe(1);
    });

    it('DELETE removes the check-in and is idempotent', async () => {
      const habit = await createHabit();
      await request(server).put(`/habits/${habit.id}/checkins/${today}`).expect(200);

      await request(server).delete(`/habits/${habit.id}/checkins/${today}`).expect(204);
      await request(server).delete(`/habits/${habit.id}/checkins/${today}`).expect(204);

      const after = await overviewFor(habit.id);
      expect(after.doneToday).toBe(false);
      expect(after.checkins).toEqual([]);
      expect(after.currentStreak).toBe(0);
    });

    it('rejects an impossible day', async () => {
      const habit = await createHabit();
      await request(server).put(`/habits/${habit.id}/checkins/2026-02-30`).expect(400);
    });

    it('returns 404 for an unknown habit', async () => {
      await request(server).put(`/habits/2147483000/checkins/${today}`).expect(404);
    });

    it('returns 409 when checking in an archived habit', async () => {
      const habit = await createHabit();
      await request(server).delete(`/habits/${habit.id}`).expect(204);
      await request(server).put(`/habits/${habit.id}/checkins/${today}`).expect(409);
    });
  });

  describe('streaks', () => {
    it('counts the current streak from yesterday while today is unchecked', async () => {
      const habit = await createHabit();
      // Gap at today-4: current run is 3 days (yesterday back), longest run is 5 days.
      for (const offset of [1, 2, 3, 5, 6, 7, 8, 9]) {
        await request(server).put(`/habits/${habit.id}/checkins/${addDays(today, -offset)}`).expect(200);
      }

      const before = await overviewFor(habit.id);
      expect(before.doneToday).toBe(false);
      expect(before.currentStreak).toBe(3);
      expect(before.longestStreak).toBe(5);

      await request(server).put(`/habits/${habit.id}/checkins/${today}`).expect(200);

      const after = await overviewFor(habit.id);
      expect(after.doneToday).toBe(true);
      expect(after.currentStreak).toBe(4);
      expect(after.longestStreak).toBe(5);
    });

    it('only reports check-ins inside the requested range', async () => {
      const habit = await createHabit();
      const inRange = addDays(today, -2);
      const outOfRange = addDays(today, -10);
      await request(server).put(`/habits/${habit.id}/checkins/${inRange}`).expect(200);
      await request(server).put(`/habits/${habit.id}/checkins/${outOfRange}`).expect(200);

      const habitOverview = await overviewFor(habit.id, { from: addDays(today, -5), to: today });

      expect(habitOverview.checkins).toEqual([inRange]);
      expect(habitOverview.longestStreak).toBe(1);
    });

    it('completion rate covers only days since creation and ignores an unchecked today', async () => {
      const habit = await createHabit();
      await request(server).put(`/habits/${habit.id}/checkins/${today}`).expect(200);

      const checked = await overviewFor(habit.id, { from: addDays(today, -6), to: today });
      expect(checked.completionRate).toBe(1);
    });

    it('completion rate is null when there are no expected days yet', async () => {
      const habit = await createHabit();

      const unchecked = await overviewFor(habit.id, { from: addDays(today, -6), to: today });
      expect(unchecked.completionRate).toBeNull();
    });
  });

  describe('overview', () => {
    it('defaults to the last 12 weeks when no range is given', async () => {
      const res = await request(server).get('/habits/overview').query({ today }).expect(200);

      expect(res.body.today).toBe(today);
      expect(res.body.to).toBe(today);
      expect(res.body.from).toBe(addDays(today, -83));
      expect(Array.isArray(res.body.habits)).toBe(true);
    });

    it('rejects a reversed or overlong range', async () => {
      await request(server).get('/habits/overview').query({ from: today, to: addDays(today, -1) }).expect(400);
      await request(server).get('/habits/overview').query({ from: '2020-01-01', to: today }).expect(400);
    });

    it('rejects a malformed date', async () => {
      await request(server).get('/habits/overview').query({ from: '2026/06/01' }).expect(400);
    });
  });

  describe('habit lifecycle', () => {
    it('DELETE archives instead of deleting, hiding the habit from the dashboard', async () => {
      const habit = await createHabit();
      await request(server).put(`/habits/${habit.id}/checkins/${today}`).expect(200);

      await request(server).delete(`/habits/${habit.id}`).expect(204);

      const active = await request(server).get('/habits').expect(200);
      expect(active.body.some((h: { id: number }) => h.id === habit.id)).toBe(false);

      const all = await request(server).get('/habits').query({ includeArchived: 'true' }).expect(200);
      const archived = all.body.find((h: { id: number }) => h.id === habit.id);
      expect(archived).toMatchObject({ archived: true, name: habit.name });

      const overview = await request(server).get('/habits/overview').query({ today }).expect(200);
      expect(overview.body.habits.some((h: { id: number }) => h.id === habit.id)).toBe(false);
    });

    it('PATCH updates the fields that were sent', async () => {
      const habit = await createHabit();

      const res = await request(server)
        .patch(`/habits/${habit.id}`)
        .send({ name: '  Renamed  ', color: '#EB6834' })
        .expect(200);

      expect(res.body).toMatchObject({ id: habit.id, name: 'Renamed', color: '#eb6834', emoji: '✅' });
    });

    it('POST rejects an invalid body', async () => {
      await request(server).post('/habits').send({ name: '', emoji: '✅', color: '#2a78d6' }).expect(400);
      await request(server).post('/habits').send({ name: 'Run', emoji: '✅', color: 'blue' }).expect(400);
    });

    it('PATCH returns 404 for an unknown habit', async () => {
      await request(server).patch('/habits/2147483000').send({ name: 'Nope' }).expect(404);
    });

    it('rejects a non-numeric habit id', async () => {
      await request(server).patch('/habits/abc').send({ name: 'Nope' }).expect(400);
    });
  });
});
