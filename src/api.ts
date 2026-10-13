import { addMinutes } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import atelierStudio from '../tenants/atelier/settings.json';
import autoPremiumStudio from '../tenants/autopremium/settings.json';
import { calculateAvailability } from './slots';
import { bookingInputSchema, studioSchema, type Booking, type BookingInput, type Availability, type Overview, type Studio } from './domain';
import { createUUID } from './uuid';
import { supabase, isSupabaseConfigured } from './lib/supabase';
export { supabase } from './lib/supabase';
import { remoteStudio, remoteAvailability, remoteReserve, readRemoteReceipt } from './lib/remote-bookings';

export const isDemo = !isSupabaseConfigured;
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const isRemoteStudio = (slug: string) => slug === 'demo' || (slug === 'autopremium' && isSupabaseConfigured);
export const isLocalTenant = (slug: string) => slug === 'atelier' || (slug === 'autopremium' && !isSupabaseConfigured);
type DemoState = { studio: Studio; bookings: Booking[]; payments: Overview['payments'] };
const storageKey = (slug: string) => `atelier-v1:${slug}`;
const seeds: Record<string, Studio> = Object.fromEntries([atelierStudio, autoPremiumStudio].map(raw => {
  const parsed = studioSchema.parse(raw);
  return [parsed.slug, parsed];
}));
function read(slug: string): DemoState {
  const seed = seeds[slug];
  if (!seed) throw new Error('Студия не найдена');
  const state = localStorage.getItem(storageKey(slug));
  if (!state) return { studio: seed, bookings: [], payments: [] };
  try { const parsed = JSON.parse(state) as DemoState; return { studio: studioSchema.parse(parsed.studio), bookings: parsed.bookings, payments: parsed.payments }; }
  catch { return { studio: seed, bookings: [], payments: [] }; }
}
function save(slug: string, state: DemoState) { localStorage.setItem(storageKey(slug), JSON.stringify(state)); window.dispatchEvent(new Event('studio-change')); }

async function request<T>(slug: string, path: string, method = 'GET', body?: unknown): Promise<T> {
  if (!supabase) throw new Error('Нет подключения к серверу');
  const session = (await supabase.auth.getSession()).data.session;
  const response = await fetch(`${url}/functions/v1/api/${path}`, {
    method, headers: { 'Content-Type': 'application/json', 'apikey': key!, 'Authorization': `Bearer ${session?.access_token ?? key}` },
    body: body === undefined ? undefined : JSON.stringify({ slug, ...body as object })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Ошибка сервера (${response.status})`);
  return data as T;
}
export const api = {
  async studio(slug: string): Promise<Studio> {
    if (isRemoteStudio(slug)) return remoteStudio(slug);
    if (isLocalTenant(slug)) return read(slug).studio;
    return request<Studio>(slug, `studio?slug=${encodeURIComponent(slug)}`);
  },
  async availability(slug: string, serviceId: string, date: string): Promise<Availability> {
    if (isRemoteStudio(slug)) return remoteAvailability(slug, serviceId, date);
    if (isLocalTenant(slug)) { const s = read(slug); const service = s.studio.services.find(x => x.id === serviceId); if (!service) throw Error('Услуга не найдена'); return calculateAvailability(s.studio, service, date, s.bookings); }
    return request<Availability>(slug, `availability?slug=${encodeURIComponent(slug)}&serviceId=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(date)}`);
  },
  async reserve(slug: string, input: BookingInput): Promise<Booking> {
    const validated = bookingInputSchema.parse(input);
    if (isRemoteStudio(slug)) return remoteReserve(slug, validated);
    if (!isLocalTenant(slug)) return request<Booking>(slug, 'reserve', 'POST', validated);
    const state = read(slug);
    const existing = state.bookings.find(b => b.id === validated.idempotencyKey);
    if (existing) return existing;
    const service = state.studio.services.find(s => s.id === validated.serviceId);
    if (!service) throw Error('Услуга недоступна');
    const date = formatInTimeZone(new Date(validated.startsAt), state.studio.timezone, 'yyyy-MM-dd');
    const avail = calculateAvailability(state.studio, service, date, state.bookings);
    if (!avail.available.includes(validated.startsAt)) throw Error('Время уже занято. Выберите другое.');
    const end = addMinutes(new Date(validated.startsAt), service.durationMinutes + service.bufferMinutes).toISOString();
    const bay = state.studio.bays.find(b => b.enabled && !state.bookings.some(x => x.status !== 'cancelled' && x.bayId === b.id && Date.parse(x.startsAt) < Date.parse(end) && Date.parse(x.endsAt) > Date.parse(validated.startsAt)));
    if (!bay) throw Error('Нет свободного бокса');
    const booking: Booking = { id: validated.idempotencyKey, cancellationToken: createUUID(), serviceId: service.id, serviceTitle: service.title, bayId: bay.id, customerName: validated.customerName, phone: validated.phone, car: validated.car, startsAt: validated.startsAt, endsAt: end, status: 'reserved', createdAt: new Date().toISOString() };
    state.bookings.push(booking); save(slug, state); return booking;
  },
  async ownBooking(slug: string, id: string, token: string): Promise<Booking> {
    if (isRemoteStudio(slug)) return readRemoteReceipt(slug, id);
    if (!isLocalTenant(slug)) return request<Booking>(slug, `booking?slug=${encodeURIComponent(slug)}&id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`);
    const b = read(slug).bookings.find(x => x.id === id && x.cancellationToken === token);
    if (!b) throw Error('Запись не найдена'); return b;
  },
  async cancel(slug: string, id: string, token: string) {
    if (isRemoteStudio(slug)) throw new Error('Отменить запись может владелец через /admin');
    if (!isLocalTenant(slug)) return request<Booking>(slug, 'cancel', 'POST', { id, token });
    const state = read(slug); const b = state.bookings.find(x => x.id === id && x.cancellationToken === token);
    if (!b) throw Error('Запись не найдена');
    if ((Date.parse(b.startsAt) - Date.now()) / 3600000 < state.studio.cancellationHours) throw Error('Срок самостоятельной отмены истёк');
    b.status = 'cancelled'; save(slug, state); return b;
  },
  async overview(slug: string): Promise<Overview> {
    if (isLocalTenant(slug)) { const s = read(slug); return { bookings: s.bookings, payments: s.payments }; }
    return request<Overview>(slug, `owner/overview?slug=${encodeURIComponent(slug)}`);
  },
  async updateStudio(slug: string, patch: Partial<Studio>): Promise<Studio> {
    if (!isLocalTenant(slug)) return request<Studio>(slug, 'owner/studio', 'PATCH', { patch });
    const state = read(slug); state.studio = studioSchema.parse({ ...state.studio, ...patch }); save(slug, state); return state.studio;
  },
  async changeBooking(slug: string, id: string, patch: { status?: Booking['status']; startsAt?: string }): Promise<Booking> {
    if (!isLocalTenant(slug)) return request<Booking>(slug, 'owner/booking', 'PATCH', { id, patch });
    const state = read(slug); const b = state.bookings.find(x => x.id === id); if (!b) throw Error('Запись не найдена');
    if (patch.startsAt) { const service = state.studio.services.find(x => x.id === b.serviceId)!; const date = formatInTimeZone(new Date(patch.startsAt),state.studio.timezone,'yyyy-MM-dd'); const other = state.bookings.filter(x => x.id !== id); if (!calculateAvailability(state.studio, service, date, other).available.includes(patch.startsAt)) throw Error('Новое время занято'); b.startsAt = patch.startsAt; b.endsAt = addMinutes(new Date(patch.startsAt), service.durationMinutes + service.bufferMinutes).toISOString(); }
    if (patch.status) b.status = patch.status; save(slug,state); return b;
  },
  async payment(slug: string, bookingId: string, amount: number, type: 'payment'|'refund') {
    if (!isLocalTenant(slug)) return request(slug, 'owner/payment', 'POST', { bookingId, amount, type });
    const s = read(slug); s.payments.push({ id: createUUID(), bookingId, amount, type, createdAt: new Date().toISOString() }); save(slug,s);
  },
  async addGallery(slug: string, image: string, caption: string) {
    if (!isLocalTenant(slug)) return request(slug, 'owner/gallery', 'POST', { image, caption });
    const s = read(slug); s.studio.gallery.push({ id: createUUID(), image, caption }); save(slug,s);
  },
  async updateGallery(slug: string, id: string, patch: { image?: string; caption?: string }) {
    if (!isLocalTenant(slug)) return request(slug, 'owner/gallery', 'PATCH', { id, patch });
    const s = read(slug); const p = s.studio.gallery.find(x => x.id === id); if (!p) throw Error('Фото не найдено'); Object.assign(p, patch); save(slug,s);
  },
  async upload(slug: string, file: File): Promise<string> {
    if (file.size > 5_000_000 || !['image/jpeg','image/png','image/webp'].includes(file.type)) throw Error('Фото: JPG, PNG или WebP до 5 МБ');
    if (isLocalTenant(slug)) return URL.createObjectURL(file);
    const { path, token } = await request<{ path: string; token: string }>(slug, 'owner/upload', 'POST', { mime: file.type });
    const { error } = await supabase!.storage.from('studio-media').uploadToSignedUrl(path,token,file,{contentType:file.type});
    if (error) throw Error(error.message);
    return supabase!.storage.from('studio-media').getPublicUrl(path).data.publicUrl;
  },
  async ask(slug: string, message: string, owner = false): Promise<string> {
    if (!isLocalTenant(slug)) return 'Свяжитесь со студией, чтобы уточнить детали записи.';
    const s = read(slug); const m = message.toLowerCase();
    if (owner) {
      if (/день|завтр|запис|машин/.test(m)) return `Сейчас записей: ${s.bookings.filter(b => b.status !== 'cancelled').length}. Завтра: ${s.bookings.filter(b => formatInTimeZone(new Date(b.startsAt),s.studio.timezone,'yyyy-MM-dd') === formatInTimeZone(addMinutes(new Date(),1440),s.studio.timezone,'yyyy-MM-dd')).length}.`;
      if (/ден|выруч|получ|оплат/.test(m)) return `Оплаты с учётом возвратов: ${s.payments.reduce((sum,p) => sum + (p.type==='payment'?p.amount:-p.amount),0)} ₽.`;
    }
    if (/цен|стои|полиров|услуг/.test(m)) return s.studio.services.map(x => `${x.title}: от ${x.price.toLocaleString('ru-RU')} ₽`).join('\n');
    if (/адрес|найти|где|ехать/.test(m)) return `${s.studio.address}. Телефон: ${s.studio.phone}.`;
    if (/окно|время|запис/.test(m)) return 'На какую услугу хотите записаться? Выберите её в разделе «Услуги», и я помогу проверить свободные часы.';
    return 'Могу подсказать стоимость услуг, адрес и свободное время. Что вас интересует?';
  }
};
