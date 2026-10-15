import { z } from 'zod';

export const serviceSchema = z.object({
  id: z.string().uuid(), title: z.string().min(2).max(100), category: z.string().min(2),
  description: z.string().max(350), price: z.number().nonnegative(), durationMinutes: z.number().int().min(30).max(10080),
  bufferMinutes: z.number().int().min(0).max(240), enabled: z.boolean().default(true)
});
export const baySchema = z.object({ id: z.string().uuid(), title: z.string().min(1), enabled: z.boolean().default(true) });
export const hoursSchema = z.object({ open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }).nullable();
export const studioSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,38}$/),
  published: z.boolean().default(false),
  name: z.string().min(2).max(90), eyebrow: z.string().max(100),
  tagline: z.string().min(5).max(140), description: z.string().max(1000),
  address: z.string().min(5).max(200), phone: z.string().min(5).max(40),
  timezone: z.string().min(3), currency: z.string().length(3),
  hero: z.string().min(1), logo: z.string().min(1),
  cancellationHours: z.number().int().min(0).max(720),
  infoCards: z.array(z.object({ icon: z.string(), title: z.string(), text: z.string() })).length(3),
  schedule: z.record(z.string(), hoursSchema),
  daysOff: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  services: z.array(serviceSchema).min(1), bays: z.array(baySchema).min(1),
  gallery: z.array(z.object({ id: z.string().uuid(), image: z.string().min(1), caption: z.string().min(1) }))
});
export type Studio = z.infer<typeof studioSchema>;
export type Service = z.infer<typeof serviceSchema>;
export type BookingStatus = 'reserved' | 'arrived' | 'ready' | 'completed' | 'cancelled';
export type Booking = { id: string; studioId?: string; serviceId: string; serviceTitle: string; bayId?: string;
  customerName: string; phone: string; car: string; startsAt: string; endsAt: string; status: BookingStatus;
  cancellationToken?: string; createdAt: string };
export const bookingContactSchemas = {
  customerName: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^\+?[\d\s()\-]{7,22}$/).refine(value => {
    const digits = value.replace(/\D/g, '').length;
    return digits >= 7 && digits <= 15;
  }),
  car: z.string().trim().min(2).max(100),
};
export const bookingInputSchema = z.object({ serviceId: z.string().uuid(), startsAt: z.string().datetime(),
  ...bookingContactSchemas, idempotencyKey: z.string().uuid() });
export type BookingInput = z.infer<typeof bookingInputSchema>;
export type Availability = { available: string[]; unavailable: string[]; date: string };
export type Overview = { bookings: Booking[]; payments: { id: string; bookingId: string; amount: number; type: 'payment'|'refund'; createdAt: string }[] };

export function money(value: number, currency = 'RUB') { return new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value); }
export function minutesText(minutes: number) { return minutes >= 1440 ? `${Math.ceil(minutes / 1440)} дн.` : minutes >= 60 ? `${Math.round(minutes / 60 * 10) / 10} ч` : `${minutes} мин`; }
