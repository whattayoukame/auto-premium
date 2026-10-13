import { addDays } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import atelierTemplate from '../../tenants/atelier/settings.json';
import autoPremiumTemplate from '../../tenants/autopremium/settings.json';
import { studioSchema, type Availability, type Booking, type BookingInput, type Studio } from '../domain';
import { calculateAvailability } from '../slots';
import { requireSupabase } from './supabase';

// Remote schema deliberately has fewer columns than the site's original tenant model.
// Only presentation defaults (images, opening hours, currency) come from the template.
// The actual studio identity, timezone and complete service catalog come from Supabase.
const studioPromises = new Map<string, Promise<Studio>>();
export function remoteStudio(slug: string): Promise<Studio> {
  const cached = studioPromises.get(slug);
  if (cached) return cached;
  const visualTemplate = slug === 'autopremium' ? autoPremiumTemplate : atelierTemplate;
  const result = (async () => {
    const client = requireSupabase();
    const { data: studio, error } = await client.from('studios').select('id, slug, name, timezone').eq('slug', slug).single();
    if (error) throw new Error(error.code === 'PGRST116'
      ? `В Supabase не найдена студия ${slug}. Примените SQL для Авто Премиум и проверьте права чтения.` : error.message);
    const { data: services, error: serviceError } = await client.from('services').select('*').eq('studio_id', studio.id);
    if (serviceError) throw serviceError;
    if (!services?.length) throw new Error(`В Supabase нет услуг для студии ${slug}`);
    return studioSchema.parse({
      ...visualTemplate,
      id: studio.id,
      slug: studio.slug,
      name: studio.name,
      timezone: studio.timezone,
      published: true,
      // Single-capacity preview; the database create_booking function is authoritative.
      bays: [visualTemplate.bays[0]],
      services: [...services].sort((a, b) => {
        const order = (row: typeof a) => visualTemplate.services.findIndex(x => x.id === row.id || x.title === row.name);
        const ai = order(a), bi = order(b);
        return (ai < 0 ? Number.MAX_SAFE_INTEGER : ai) - (bi < 0 ? Number.MAX_SAFE_INTEGER : bi);
      }).map(row => {
        const preset = visualTemplate.services.find(x => x.id === row.id || x.title === row.name);
        return ({
        id: row.id,
        title: row.name ?? row.title,
        price: Number(row.price),
        durationMinutes: row.duration_min ?? row.duration_minutes,
        bufferMinutes: row.buffer_min ?? row.buffer_minutes ?? preset?.bufferMinutes ?? 0,
        category: row.category ?? preset?.category ?? 'УСЛУГИ',
        description: row.description ?? preset?.description ?? '',
        enabled: row.enabled ?? true,
      }); }),
    });
  })().catch(error => { studioPromises.delete(slug); throw error; });
  studioPromises.set(slug, result);
  return result;
}

export async function remoteAvailability(slug: string, serviceId: string, date: string): Promise<Availability> {
  const studio = await remoteStudio(slug);
  const service = studio.services.find(item => item.id === serviceId);
  if (!service) throw new Error('Услуга не найдена');
  const from = fromZonedTime(`${date}T00:00:00`, studio.timezone).toISOString();
  const nextDay = addDays(new Date(`${date}T12:00:00Z`), 1).toISOString().slice(0, 10);
  // Include overlapping bookings begun earlier (long-running services).
  const lookback = addDays(new Date(from), -8).toISOString();
  const to = fromZonedTime(`${nextDay}T00:00:00`, studio.timezone).toISOString();
  const { data, error } = await requireSupabase().rpc('get_busy', {
    p_studio: studio.id, p_from: lookback, p_to: to,
  });
  if (error) throw error;
  const bookings = (data ?? []).map((item: { starts_at: string; ends_at: string }) => ({
    startsAt: item.starts_at, endsAt: item.ends_at,
    status: 'reserved', bayId: studio.bays[0].id,
  })) as Booking[];
  return calculateAvailability(studio, service, date, bookings);
}

export async function remoteReserve(slug: string, input: BookingInput): Promise<Booking> {
  const studio = await remoteStudio(slug);
  const { data, error } = await requireSupabase().rpc('create_booking', {
    p_studio: studio.id,
    p_service: input.serviceId,
    p_name: input.customerName,
    p_phone: input.phone,
    p_car: input.car,
    p_start: input.startsAt,
    p_key: input.idempotencyKey,
  });
  if (error) {
    if (`${error.message} ${error.details} ${error.code}`.includes('slot_taken')) {
      throw new Error('Это время только что заняли, выберите другое');
    }
    throw error;
  }
  if (typeof data !== 'string') throw new Error('Сервер вернул некорректный номер записи');
  const service = studio.services.find(x => x.id === input.serviceId)!;
  return {
    id: data, serviceId: service.id, serviceTitle: service.title,
    customerName: input.customerName, phone: input.phone, car: input.car,
    startsAt: input.startsAt,
    endsAt: new Date(Date.parse(input.startsAt) + service.durationMinutes * 60_000).toISOString(),
    status: 'reserved', createdAt: new Date().toISOString(),
  };
}

export function readRemoteReceipt(slug: string, id: string): Booking {
  const receipt = localStorage.getItem(`remote-booking-receipt:${slug}`);
  const booking = receipt ? JSON.parse(receipt) as Booking : null;
  if (!booking || booking.id !== id) throw new Error('Подтверждение записи не найдено');
  return booking;
}

export type AdminBooking = Booking;
export async function remoteAdminBookings(slug: string): Promise<AdminBooking[]> {
  const studio = await remoteStudio(slug);
  const { data, error } = await requireSupabase().from('bookings').select('*')
    .eq('studio_id', studio.id).order('starts_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(row => ({
    id: row.id,
    studioId: row.studio_id,
    serviceId: row.service_id,
    serviceTitle: studio.services.find(x => x.id === row.service_id)?.title ?? 'Неизвестная услуга',
    customerName: row.customer_name ?? row.name ?? '',
    phone: row.phone ?? '', car: row.car ?? '',
    startsAt: row.starts_at, endsAt: row.ends_at,
    status: row.status ?? 'reserved', createdAt: row.created_at ?? row.starts_at,
  }));
}

export async function cancelRemoteBooking(slug: string, id: string): Promise<void> {
  const studio = await remoteStudio(slug);
  const { data, error } = await requireSupabase().from('bookings')
    .update({ status: 'cancelled' }).eq('studio_id', studio.id).eq('id', id)
    .select('id').single();
  if (error) throw error;
  if (!data) throw new Error('Запись не найдена или недостаточно прав');
}
