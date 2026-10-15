import { expect, test, type Page } from '@playwright/test';
import { fromZonedTime } from 'date-fns-tz';

// Run with VITE_SUPABASE_ANON_KEY=test-publishable-key. Responses are mocked;
// these tests verify the browser flow without writing customer data to a real DB.
test.skip(!process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY === 'ВСТАВЬ_КЛЮЧ', 'Requires mock client configuration');

const studioId = '10000000-0000-4000-8000-000000000001';
const serviceId = '20000000-0000-4000-8000-000000000001';
const bookingId = '30000000-0000-4000-8000-000000000001';
const ownerId = '40000000-0000-4000-8000-000000000001';
const studio = { id: studioId, slug: 'autopremium', name: 'АВТО ПРЕМИУМ', timezone: 'Asia/Novosibirsk' };
const services = [{ id: serviceId, studio_id: studioId, name: 'Сервис Supabase', price: 5000, duration_min: 60 }];
test.use({ locale: 'en-US' }); // Admin dates must remain Russian regardless of browser locale.

type SubmittedBooking = { p_key: string; p_start: string; p_name: string; p_phone: string; p_car: string };
type MockBooking = { id: string; name: string; startsAt: string; status: 'new' | 'reserved' | 'ready' | 'completed' | 'cancelled' };

async function mockBackend(page: Page, options: {
  occupied?: boolean; conflict?: boolean; blankAliases?: boolean; initialStatus?: 'new' | 'reserved';
  initialDate?: string; paymentsEnabled?: boolean; extraBookings?: MockBooking[]; archiveError?: string;
} = {}) {
  const calls: SubmittedBooking[] = [];
  let lastStart = new Date(Date.now() + 3 * 86400_000).toISOString();
  let cancelled = false;
  let bookingStatus = options.initialStatus ?? 'reserved';
  const updates: string[] = [];
  const archived = new Set<string>();
  const archiveCalls: string[] = [];
  const ledger: { id: string; booking_id: string; amount: number; type: string; created_at: string }[] = [];
  if (options.initialDate) lastStart = options.initialDate;
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
    if (path.endsWith('/autopremium_payments')) {
      if (!options.paymentsEnabled) return respond({
        code: 'PGRST205', message: "Could not find the table 'public.autopremium_payments' in the schema cache",
      }, 404);
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON() as { id: string; booking_id: string; amount: number; type: string };
        if (ledger.some(payment => payment.id === body.id)) {
          return respond({ code: '23505', message: 'duplicate key' }, 409);
        }
        ledger.push({ ...body, created_at: new Date().toISOString() });
        return respond(null, 201);
      }
      return respond(ledger);
    }
    if (path.endsWith('/rpc/get_busy')) {
      const { p_to } = route.request().postDataJSON() as { p_to: string };
      const starts_at = new Date(Date.parse(p_to) - 14 * 3600_000).toISOString(); // 10:00 Novosibirsk
      const ends_at = new Date(Date.parse(starts_at) + 3600_000).toISOString();
      return respond(options.occupied ? [{ starts_at, ends_at }] : []);
    }
    if (path.endsWith('/rpc/create_booking')) {
      const body = route.request().postDataJSON() as SubmittedBooking;
      calls.push(body);
      lastStart = body.p_start;
      if (options.conflict) return respond({ code: 'P0001', message: 'slot_taken' }, 400);
      return respond(bookingId);
    }
    if (path.endsWith('/rpc/autopremium_archive_booking')) {
      const body = route.request().postDataJSON() as { p_studio: string; p_booking: string };
      expect(body.p_studio).toBe(studioId);
      archiveCalls.push(body.p_booking);
      if (options.archiveError) return respond({ code: 'P0001', message: options.archiveError }, 400);
      if (ledger.some(payment => payment.booking_id === body.p_booking)) {
        return respond({ code: 'P0001', message: 'booking_has_payments' }, 400);
      }
      archived.add(body.p_booking);
      cancelled = true;
      return respond(null, 204);
    }
    if (path.endsWith('/bookings')) {
      if (route.request().method() === 'PATCH') {
        const update = route.request().postDataJSON() as { status: typeof bookingStatus };
        expect(['reserved', 'ready', 'completed', 'cancelled']).toContain(update.status);
        updates.push(update.status);
        bookingStatus = update.status;
        cancelled = update.status === 'cancelled';
        return respond({ id: bookingId });
      }
      const starts = Date.parse(lastStart);
      const submitted = calls[0] ?? { p_name: 'Тестовый Клиент', p_phone: '+79991234567', p_car: 'BMW M3' };
      return respond([{ id: bookingId, studio_id: studioId, service_id: serviceId,
        client_name: options.blankAliases ? '  ' : submitted.p_name,
        client_phone: options.blankAliases ? '' : submitted.p_phone,
        customer_name: submitted.p_name, phone: submitted.p_phone, car: submitted.p_car, starts_at: lastStart,
        ends_at: new Date(starts + 3600_000).toISOString(), status: bookingStatus },
        ...(options.extraBookings ?? []).map(row => ({
          id: row.id, studio_id: studioId, service_id: serviceId, client_name: row.name,
          client_phone: '+79991234567', car: 'BMW', starts_at: row.startsAt,
          ends_at: new Date(Date.parse(row.startsAt) + 3600_000).toISOString(), status: row.status,
        }))].filter(row => !archived.has(row.id)));
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
  return { calls, updates, ledger, archiveCalls, wasCancelled: () => cancelled };
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

test('new customer details reach CRM even when alternate contact columns are blank', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const server = await mockBackend(page, { blankAliases: true });
  await page.goto('/s/autopremium/booking');
  await page.locator('.day-strip button').nth(2).click();
  await page.locator('.time-grid button:not([disabled])').first().click();
  await page.getByPlaceholder('Александр').fill('Иван Петров');
  await page.getByPlaceholder('+7 999 123-45-67').fill('+79991112233');
  await page.getByPlaceholder('Например, BMW 5 серии').fill('Infiniti FX');
  await page.getByRole('button', { name: /Подтвердить запись/ }).click();
  await expect(page.getByText('Вы записаны!')).toBeVisible();
  expect(server.calls[0]).toMatchObject({ p_name: 'Иван Петров', p_phone: '+79991112233', p_car: 'Infiniti FX' });

  await page.goto('/admin');
  await page.getByLabel('Электронная почта').fill('owner@example.com');
  await page.getByLabel('Пароль').fill('test-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  const row = page.getByRole('row', { name: /Infiniti FX/ });
  await expect(row.getByRole('cell').nth(2)).toHaveText('Иван Петров');
  await expect(row.getByRole('cell').nth(3)).toHaveText('+79991112233');
  expect(errors).toEqual([]);
});

for (const width of [390, 1440]) {
  test(`required contact fields block invalid bookings and recover (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const server = await mockBackend(page, { blankAliases: true });
    await page.goto('/s/autopremium/booking');
    await page.locator('.day-strip button').nth(2).click();
    await page.locator('.time-grid button:not([disabled])').first().click();

    const fields = page.locator('.booking-fields');
    const name = fields.locator('[name="name"]');
    const phone = fields.locator('[name="phone"]');
    const car = fields.locator('[name="car"]');
    const submit = page.getByRole('button', { name: /Подтвердить запись/ });
    await phone.fill('не телефон');
    await phone.blur();
    await expect(fields.locator('#booking-phone-error')).toContainText('корректный номер');
    await submit.click();
    await expect(fields.locator('#booking-name-error')).toContainText('Укажите ФИО');
    await expect(fields.locator('#booking-car-error')).toContainText('Укажите марку и модель');
    for (const field of [name, phone, car]) {
      await expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(await field.evaluate(element => getComputedStyle(element).borderColor)).toBe('rgb(236, 115, 115)');
    }
    expect(server.calls).toHaveLength(0);
    await name.fill('   ');
    await phone.fill('------');
    await car.fill(' ');
    await submit.click();
    expect(server.calls).toHaveLength(0);

    await name.fill(' Анна Смирнова ');
    await phone.fill('+7 999 123-45-67');
    await car.fill('  Toyota Corolla  ');
    await expect(fields.locator('.booking-field-error')).toHaveCount(0);
    for (const field of [name, phone, car]) await expect(field).toHaveAttribute('aria-invalid', 'false');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
    await submit.click();
    await expect(page.getByText('Вы записаны!')).toBeVisible();
    expect(server.calls).toHaveLength(1);
    expect(server.calls[0]).toMatchObject({ p_name: 'Анна Смирнова', p_phone: '+7 999 123-45-67', p_car: 'Toyota Corolla' });

    await page.goto('/admin');
    await page.getByLabel('Электронная почта').fill('owner@example.com');
    await page.getByLabel('Пароль').fill('test-password');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    const row = page.getByRole('row', { name: /Toyota Corolla/ });
    await expect(row.getByRole('cell').nth(2)).toHaveText('Анна Смирнова');
    await expect(row.getByRole('cell').nth(3)).toHaveText('+7 999 123-45-67');
    expect(errors).toEqual([]);
  });
}

test('owner signs in and cancels booking from Supabase', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const server = await mockBackend(page);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Вход владельца' })).toBeVisible();
  await page.getByLabel('Электронная почта').fill('owner@example.com');
  await page.getByLabel('Пароль').fill('test-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('Тестовый Клиент');
  await expect(page.getByRole('table')).toContainText('+79991234567');
  await expect(page.getByRole('table')).toContainText('Сервис Supabase');
  page.once('dialog', d => d.accept());
  await page.getByRole('combobox', { name: 'Действия с записью Тестовый Клиент' }).selectOption('cancelled');
  await expect(page.getByRole('table')).toContainText('Отменено');
  expect(server.wasCancelled()).toBe(true);
  expect(errors).toEqual([]);
});

for (const width of [390, 1440]) {
test(`owner sees Russian month and can change each booking status with separate aligned actions (${width}px)`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const server = await mockBackend(page, {
    initialStatus: 'new', initialDate: '2026-10-14T02:00:00.000Z',
  });
  await page.goto('/admin');
  await page.getByLabel('Электронная почта').fill('owner@example.com');
  await page.getByLabel('Пароль').fill('test-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();

  const row = page.getByRole('row', { name: /Тестовый Клиент/ });
  await expect(row.getByRole('cell').first()).toHaveText('14 октября, 09:00');
  const status = row.locator('.status-tag');
  await expect(status).toHaveText('Новое');
  await expect(status).toHaveCSS('color', 'rgb(185, 216, 255)');
  await expect(page.getByRole('columnheader', { name: 'СТАТУС', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'ДЕЙСТВИЯ' })).toBeVisible();
  const selector = row.getByRole('combobox', { name: 'Действия с записью Тестовый Клиент' });
  await expect(selector.locator('option')).toHaveText(['Действия', 'Новое', 'Готово', 'Завершено', 'Отменено']);
  const positions = await row.getByRole('cell').nth(5).boundingBox();
  const actionsBox = await row.getByRole('cell').nth(6).boundingBox();
  expect(positions && actionsBox && actionsBox.x >= positions.x + positions.width).toBeTruthy();
  const selectBox = await selector.boundingBox();
  const deleteBox = await row.getByRole('button', { name: 'Удалить' }).boundingBox();
  const headingBox = await page.getByRole('columnheader', { name: 'ДЕЙСТВИЯ' }).boundingBox();
  expect(actionsBox && selectBox && deleteBox && headingBox).toBeTruthy();
  if (actionsBox && selectBox && deleteBox && headingBox) {
    const center = (box: { x: number; width: number }) => box.x + box.width / 2;
    expect(Math.abs(center(selectBox) - center(actionsBox))).toBeLessThan(3);
    expect(Math.abs(center(deleteBox) - center(actionsBox))).toBeLessThan(3);
    expect(Math.abs(center(headingBox) - center(actionsBox))).toBeLessThan(3);
    expect(deleteBox.y - (selectBox.y + selectBox.height)).toBeGreaterThanOrEqual(7);
  }

  await selector.selectOption('ready');
  await expect(status).toHaveText('Готово');
  await expect(status).toHaveCSS('color', 'rgb(246, 212, 117)');
  await expect(status).toHaveAttribute('title', 'Клиент приехал, услуга ещё не выполнена');
  await selector.selectOption('completed');
  await expect(status).toHaveText('Завершено');
  await expect(status).toHaveCSS('color', 'rgb(152, 230, 190)');
  page.once('dialog', dialog => dialog.accept());
  await selector.selectOption('cancelled');
  await expect(status).toHaveText('Отменено');
  await expect(status).toHaveCSS('color', 'rgb(255, 176, 176)');
  await selector.selectOption('reserved');
  await expect(status).toHaveText('Новое');
  await expect(status).toHaveCSS('color', 'rgb(185, 216, 255)');
  expect(server.updates).toEqual(['ready', 'completed', 'cancelled', 'reserved']);
  expect(errors).toEqual([]);
});
}

for (const width of [390, 1440]) {
  test(`owner archives only after confirming and CRM updates (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const server = await mockBackend(page, { initialDate: '2026-10-14T02:00:00Z' });
    await loginOwner(page);

    const row = page.getByRole('row', { name: /Тестовый Клиент/ });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Удалить' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Точно удалить запись?');
    await expect(dialog).toContainText('Тестовый Клиент');
    expect(server.archiveCalls).toEqual([]);

    await dialog.getByRole('button', { name: 'Оставить запись' }).click();
    await expect(dialog).toBeHidden();
    await expect(row).toBeVisible();
    expect(server.archiveCalls).toEqual([]);

    await row.getByRole('button', { name: 'Удалить' }).click();
    await dialog.getByRole('button', { name: 'Да, удалить запись' }).click();
    await expect(dialog).toBeHidden();
    await expect(row).toHaveCount(0);
    await expect(page.getByText('Запись удалена из списка.')).toBeVisible();
    expect(server.archiveCalls).toEqual([bookingId]);
    await page.getByRole('navigation', { name: 'Разделы управления' }).getByRole('button', { name: 'Обзор' }).click();
    await expect(page.locator('.demo-admin-stats .stat-card').nth(2).locator('strong')).toHaveText('0');
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
  });
}

test('CRM displays database archive rejection and keeps the booking visible', async ({ page }) => {
  const server = await mockBackend(page, { archiveError: 'booking_not_found' });
  await loginOwner(page);
  await page.getByRole('row', { name: /Тестовый Клиент/ }).getByRole('button', { name: 'Удалить' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Да, удалить запись' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Запись уже удалена или изменилась');
  await expect(page.getByRole('row', { name: /Тестовый Клиент/ })).toBeVisible();
  expect(server.archiveCalls).toEqual([bookingId]);
});

test('CRM prevents deleting bookings with recorded receipts', async ({ page }) => {
  const server = await mockBackend(page, { paymentsEnabled: true });
  await loginOwner(page);
  await page.getByRole('button', { name: 'Учесть оплату' }).click();
  await page.locator('.demo-admin-payment-form').getByLabel('Сумма, ₽').fill('299,50');
  await page.locator('.demo-admin-payment-form').getByRole('button', { name: 'Записать' }).click();
  const deleteButton = page.getByRole('row', { name: /Тестовый Клиент/ }).getByRole('button', { name: 'Удалить' });
  await expect(deleteButton).toBeDisabled();
  await expect(deleteButton).toHaveAttribute('title', 'Запись с оплатами или возвратами удалить нельзя');
  expect(server.archiveCalls).toEqual([]);
  await page.getByRole('navigation', { name: 'Разделы управления' }).getByRole('button', { name: 'Обзор' }).click();
  await expect(page.locator('.demo-admin-stats .stat-card').nth(3).locator('strong')).toContainText('299,50');
});

async function loginOwner(page: Page) {
  await page.goto('/admin');
  await page.getByLabel('Электронная почта').fill('owner@example.com');
  await page.getByLabel('Пароль').fill('test-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
}

for (const width of [390, 1440]) {
  test(`CRM overview and studio-calendar booking filters (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.setFixedTime(new Date('2026-10-14T04:20:00Z'));
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const date = (day: string) => fromZonedTime(`${day}T10:00:00`, studio.timezone).toISOString();
    await mockBackend(page, {
      initialStatus: 'new', initialDate: date('2026-10-15'),
      extraBookings: [
        { id: '30000000-0000-4000-8000-000000000002', name: 'Сегодня приехал', startsAt: date('2026-10-14'), status: 'ready' },
        { id: '30000000-0000-4000-8000-000000000003', name: 'Вчера завершено', startsAt: date('2026-10-13'), status: 'completed' },
        { id: '30000000-0000-4000-8000-000000000004', name: 'Через два дня', startsAt: date('2026-10-16'), status: 'reserved' },
        { id: '30000000-0000-4000-8000-000000000005', name: 'Давно отменено', startsAt: date('2026-10-02'), status: 'cancelled' },
        { id: '30000000-0000-4000-8000-000000000006', name: 'Позже', startsAt: date('2026-10-25'), status: 'reserved' },
      ],
    });
    await loginOwner(page);

    const menu = page.getByRole('navigation', { name: 'Разделы управления' });
    await expect(menu.getByRole('button', { name: 'Записи' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { name: 'Записи.' })).toBeVisible();
    await expect(page.locator('.demo-admin-periods button[aria-pressed="true"]')).toHaveText('Все записи');
    await expect(page.locator('.demo-admin .owner-table tbody tr')).toHaveCount(6);
    await expect(page.getByRole('row', { name: /Сегодня приехал/ }).getByRole('cell').first()).toHaveText('14 октября, 10:00');

    await page.getByRole('button', { name: 'Сегодня', exact: true }).click();
    await expect(page.locator('.demo-admin .owner-table tbody tr')).toHaveCount(1);
    await expect(page.getByRole('row', { name: /Сегодня приехал/ })).toBeVisible();
    await page.getByRole('button', { name: '7 дней', exact: true }).click();
    await expect(page.locator('.demo-admin .owner-table tbody tr')).toHaveCount(3);
    await page.getByRole('button', { name: 'Все записи', exact: true }).click();
    await expect(page.locator('.demo-admin .owner-table tbody tr')).toHaveCount(6);

    await menu.getByRole('button', { name: 'Обзор' }).click();
    await expect(menu.getByRole('button', { name: 'Обзор' })).toHaveAttribute('aria-current', 'page');
    const cards = page.locator('.demo-admin-stats .stat-card');
    await expect(cards).toHaveCount(4);
    await expect(cards.nth(0).locator('strong')).toHaveText('1');
    await expect(cards.nth(1).locator('strong')).toHaveText('2');
    await expect(cards.nth(2).locator('strong')).toHaveText('1');
    await expect(cards.nth(3).locator('strong')).toHaveText('—');
    await expect(page.getByRole('note')).toContainText('Учёт реальных оплат ещё не подключён');
    await page.getByRole('button', { name: 'К записям' }).click();
    await expect(page.locator('.demo-admin .owner-table tbody tr')).toHaveCount(6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
    const tableScroll = await page.locator('.demo-admin .owner-table-wrap').evaluate(element => ({
      content: element.scrollWidth, viewport: element.clientWidth,
    }));
    if (width === 390) expect(tableScroll.content).toBeGreaterThan(tableScroll.viewport);
    expect(errors).toEqual([]);
  });
}

test('CRM receives real payment and refund and shows net revenue', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-14T04:20:00Z'));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const server = await mockBackend(page, { paymentsEnabled: true, initialDate: '2026-10-14T03:00:00Z' });
  await loginOwner(page);
  await page.getByRole('button', { name: 'Учесть оплату' }).click();
  const form = page.locator('.demo-admin-payment-form');
  await expect(form).toBeVisible();
  await form.getByLabel('Сумма, ₽').fill('299,50');
  await form.getByRole('button', { name: 'Записать' }).click();
  await expect(page.getByText('Операция записана в учёт оплат.')).toBeVisible();
  await expect(form).toBeHidden();

  await page.getByRole('button', { name: 'Учесть оплату' }).click();
  await form.getByLabel('Операция').selectOption('refund');
  await form.getByLabel('Сумма, ₽').fill('40,20');
  await form.getByRole('button', { name: 'Записать' }).click();
  await expect(page.getByText('Операция записана в учёт оплат.')).toBeVisible();
  expect(server.ledger.map(entry => [entry.type, entry.amount])).toEqual([['payment', 299.5], ['refund', 40.2]]);
  expect(new Set(server.ledger.map(entry => entry.id)).size).toBe(2);

  await page.getByRole('navigation', { name: 'Разделы управления' }).getByRole('button', { name: 'Обзор' }).click();
  await expect(page.locator('.demo-admin-stats .stat-card').nth(3).locator('strong')).toContainText('259,30');
  await expect(page.getByRole('note')).toHaveCount(0);
  expect(errors).toEqual([]);
});
