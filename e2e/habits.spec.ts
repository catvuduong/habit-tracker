import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const API_URL = 'http://localhost:3001';

/** Creates a habit through the API and returns a cleanup that archives it again. */
async function createHabitViaApi(request: APIRequestContext, name: string) {
  const res = await request.post(`${API_URL}/habits`, { data: { name, emoji: '✅', color: '#2a78d6' } });
  expect(res.ok()).toBeTruthy();
  const { id } = (await res.json()) as { id: number };
  return async () => {
    await request.delete(`${API_URL}/habits/${id}`);
  };
}

function cardFor(page: Page, name: string) {
  return page.getByTestId('habit-card').filter({ hasText: name });
}

test('dashboard shows habit cards, streak badges and heatmaps on load', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('habit-card').first()).toBeVisible();
  await expect(page.getByTestId('streak-badge').first()).toBeVisible();

  const heatmap = page.getByTestId('heatmap').first();
  await expect(heatmap).toBeVisible();
  await expect(heatmap.locator('[data-state="done"]').first()).toBeAttached();
});

test('checking in today updates the streak', async ({ page, request }) => {
  const name = `UI check ${Date.now()}`;
  const cleanup = await createHabitViaApi(request, name);
  try {
    await page.goto('/');
    const card = cardFor(page, name);
    const button = card.getByTestId('checkin-button');
    const badge = card.getByTestId('streak-badge');

    await expect(badge).toHaveText('No streak yet');

    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(badge).toHaveText(/1-day streak/);

    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(badge).toHaveText('No streak yet');
  } finally {
    await cleanup();
  }
});

test('a check-in shows up in that habit’s heatmap', async ({ page, request }) => {
  const name = `UI heat ${Date.now()}`;
  const cleanup = await createHabitViaApi(request, name);
  try {
    await page.goto('/');
    const row = page.getByRole('listitem').filter({ hasText: name });
    const doneCells = row.getByTestId('heatmap').locator('[data-state="done"]');
    await expect(doneCells).toHaveCount(0);

    await cardFor(page, name).getByTestId('checkin-button').click();

    await expect(doneCells).toHaveCount(1);
  } finally {
    await cleanup();
  }
});

test('add habit dialog creates a habit', async ({ page }) => {
  const name = `UI new ${Date.now()}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'New habit' }).first().click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill(name);
  await dialog.getByRole('button', { name: '🧘' }).click();
  await dialog.getByRole('button', { name: 'Add habit' }).click();

  const card = cardFor(page, name);
  await expect(card).toBeVisible();
  await expect(card.getByText('🧘')).toBeVisible();

  // Archive through the same dialog, then confirm it leaves the dashboard.
  await card.getByRole('button', { name: `Edit ${name}` }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Archive' }).click();
  await expect(cardFor(page, name)).toHaveCount(0);
});

test('shows an error state with retry when the API is unreachable', async ({ page }) => {
  await page.route(`${API_URL}/habits/overview*`, (route) => route.abort());
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Couldn’t reach your habits' })).toBeVisible();
  await page.unroute(`${API_URL}/habits/overview*`);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByTestId('habit-card').first()).toBeVisible();
});
