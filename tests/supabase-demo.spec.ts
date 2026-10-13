import { expect, test, type Page } from '@playwright/test';

// Run with VITE_SUPABASE_ANON_KEY=test-publishable-key. Responses are mocked;
// these tests verify the browser flow without writing customer data to a real DB.
test.skip(!process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY === 'ВСТАВЬ_КЛЮЧ', 'Requires mock client configuration');

const studioId = '10000000-0000-4000-8000-000000000001';
const serviceId = '20000000-0000-4000-8000-000000000001';
const bookingId = '30000000-0000-4000-8000-000000000001';
const ownerId = '40000000-0000-4000-8000-000000000001';
const studio = { id: studioId, slug: 'autopremium', name: 'АВТО ПРЕМИУМ', timezone: 'Asia/Novosibirsk' };
const services = [{ id: serviceId, studio_id: studioId, name: 'Сервис Supabase', price: 5000, duration_min: 60 }];

async function mockBackend(page: Page, options: { occupied?: boolean; conflict?: boolean } = {}) {
  const calls: Array<{ p_key: string; p_start: string }> = [];
  let lastStart = new Date(Date.now() + 3 * 86400_000).toISOString();
  let cancelled = false;
  await page.route('**/rest/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const respond = (value: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (path.endsWith('/studios')) {
      expect(url.searchParams.get('slug')).toBe('eq.autopremium');
      return respond(studio);
    }
    if (path.endsWith('/services')) return respond(services);
    if (path.endsWith('/studio_owners')) return respond({ studio_id: studioId });
    if (path.endsWith('/rpc/get_busy')) {
      const { p_to } = route.request().postDataJSON() as { p_to: string };
      const starts_at = new Date(Date.parse(p_to) - 14 * 3600_000).toISOString(); // 10:00 Novosibirsk
      const ends_at = new Date(Date.parse(starts_at) + 3600_000).toISOString();
      return respond(options.occupied ? [{ starts_at, ends_at }] : []);
    }
    if (path.endsWith('/rpc/create_booking')) {
      const body = route.request().postDataJSON() as { p_key: string; p_start: string };
      calls.push(body);
      lastStart = body.p_start;
      if (options.conflict) return respond({ code: 'P0001', message: 'slot_taken' }, 400);
      return respond(bookingId);
    }
    if (path.endsWith('/bookings')) {
      if (route.request().method() === 'PATCH') {
        expect(route.request().postDataJSON()).toEqual({ status: 'cancelled' });
        cancelled = true;
        return respond({ id: bookingId });
      }
      const starts = Date.parse(lastStart);
      return respond([{ id: bookingId, studio_id: studioId, service_id: serviceId, customer_name: 'Тестовый Клиент',
        phone: '+79991234567', car: 'BMW M3', starts_at: lastStart,
        ends_at: new Date(starts + 3600_000).toISOString(), status: cancelled ? 'cancelled' : 'reserved' }]);
    }
    throw new Error(`Unexpected REST URL: ${path}`);
  });
  await page.route('**/auth/v1/**', route => {
    const url = new URL(route.request().url());
    const user = { id: ownerId, aud: 'authenticated', role: 'authenticated', email: 'owner@example.com',
      created_at: new Date().toISOString(), app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {} };
    if (url.pathname.endsWith('/token')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      access_token: 'test-access-token', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'test-refresh-token', user,
    }) });
    if (url.pathname.endsWith('/user')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(user) });
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
  return { calls, wasCancelled: () => cancelled };
}

test('customer reads remote services, sees busy time, and creates exactly one booking', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const server = await mockBackend(page, { occupied: true });
  await page.goto('/');
  await expect(page).toHaveURL(/\/s\/autopremium\/$/);
  await expect(page.getByRole('heading', { name: /АВТО.*ПРЕМИУМ/ })).toBeVisible();
  await page.goto('/s/autopremium/booking');
  await expect(page.locator('.service-option')).toHaveCount(1);
  await expect(page.locator('.service-option').first()).toContainText('Сервис Supabase');
  await page.locator('.day-strip button').nth(2).click();
  await expect(page.getByRole('button', { name: '10:00 занято' })).toBeDisabled();
  await page.locator('.time-grid button:not([disabled])').first().click();
  await page.getByPlaceholder('Александр').fill('Тестовый Клиент');
  await page.getByPlaceholder('+7 999 123-45-67').fill('+79991234567');
  await page.getByPlaceholder('Например, BMW 5 серии').fill('BMW M3');
  await page.getByRole('button', { name: /Подтвердить запись/ }).click();
  await expect(page).toHaveURL(/\/s\/autopremium\/my$/);
  await expect(page.getByText('Вы записаны!')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Тестовый Клиент')).toBeVisible();
  expect(server.calls).toHaveLength(1);
  expect(server.calls[0].p_key).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
  expect(errors).toEqual([]);
});

test('RPC slot_taken error is shown and rejected slot is cleared', async ({ page }) => {
  await mockBackend(page, { conflict: true });
  await page.goto('/s/autopremium/booking');
  await page.locator('.day-strip button').nth(2).click();
  await page.locator('.time-grid button:not([disabled])').first().click();
  await page.getByPlaceholder('Александр').fill('Тестовый Клиент');
  await page.getByPlaceholder('+7 999 123-45-67').fill('+79991234567');
  await page.getByPlaceholder('Например, BMW 5 серии').fill('BMW M3');
  await page.getByRole('button', { name: /Подтвердить запись/ }).click();
  await expect(page.getByRole('alert')).toContainText('Это время только что заняли, выберите другое');
  await expect(page.getByRole('button', { name: /Подтвердить запись/ })).toBeDisabled();
});

test('owner signs in and cancels booking from Supabase', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const server = await mockBackend(page);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Вход владельца' })).toBeVisible();
  await page.getByLabel('Email').fill('owner@example.com');
  await page.getByLabel('Пароль').fill('test-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('Тестовый Клиент');
  await expect(page.getByRole('table')).toContainText('Сервис Supabase');
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: 'Отменить' }).click();
  await expect(page.getByRole('table')).toContainText('Отменена');
  expect(server.wasCancelled()).toBe(true);
  expect(errors).toEqual([]);
});
