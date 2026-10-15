import { formatInTimeZone } from 'date-fns-tz';
import type { AdminBooking, AdminPayment } from './remote-bookings';

export type BookingPeriod = 'today' | 'week' | 'all';

function studioDate(iso: string | Date, timezone: string): string {
  return formatInTimeZone(iso, timezone, 'yyyy-MM-dd');
}

function shiftCalendarDay(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function bookingsForPeriod(
  bookings: AdminBooking[], period: BookingPeriod, timezone: string, now: Date = new Date(),
): AdminBooking[] {
  if (period === 'all') return bookings;
  const today = studioDate(now, timezone);
  const lastDay = shiftCalendarDay(today, 6);
  return bookings.filter(booking => {
    const date = studioDate(booking.startsAt, timezone);
    return period === 'today' ? date === today : date >= today && date <= lastDay;
  });
}

export function dashboardMetrics(
  bookings: AdminBooking[], payments: AdminPayment[] | null | undefined,
  timezone: string, now: Date = new Date(),
) {
  const today = studioDate(now, timezone);
  const firstDay = shiftCalendarDay(today, -6);
  // «Готово» means the customer has arrived; «Завершено» means the work is done.
  // Until arrivals have their own timestamp, visits use the booking's scheduled day.
  const arrived = bookings.filter(booking => booking.status === 'ready' || booking.status === 'completed');
  return {
    visitsToday: arrived.filter(booking => studioDate(booking.startsAt, timezone) === today).length,
    visitsWeek: arrived.filter(booking => {
      const date = studioDate(booking.startsAt, timezone);
      return date >= firstDay && date <= today;
    }).length,
    completed: bookings.filter(booking => booking.status === 'completed').length,
    revenue: payments == null ? null : payments.reduce((sum, entry) =>
      sum + (entry.type === 'payment' ? 1 : -1) * Math.round(entry.amount * 100), 0) / 100,
  };
}
