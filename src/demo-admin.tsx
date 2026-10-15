import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ArrowUpRight, CalendarBlank, CarProfile, CaretRight, ChartBar, CheckCircle, CurrencyCircleDollar, SignOut, Trash } from '@phosphor-icons/react';
import { formatInTimeZone } from 'date-fns-tz';
import { ru } from 'date-fns/locale';
import { bookingsForPeriod, dashboardMetrics, type BookingPeriod } from './lib/admin-analytics';
import { archiveRemoteBooking, recordRemotePayment, remoteAdminBookings, remoteAdminPayments, remoteStudio, updateRemoteBookingStatus, type AdminBooking, type AdminBookingStatus, type AdminEditableStatus } from './lib/remote-bookings';
import { requireSupabase, supabase } from './lib/supabase';
import { createUUID } from './uuid';

const studioSlug = 'autopremium';
const queryPrefix = 'autopremium-admin';
const statusLabels: Record<AdminBookingStatus, string> = {
  new: 'Новое', reserved: 'Новое', arrived: 'Новое',
  ready: 'Готово', completed: 'Завершено', cancelled: 'Отменено',
};
const actions: { value: AdminEditableStatus; title: string }[] = [
  { value: 'reserved', title: 'Новое' },
  { value: 'ready', title: 'Готово' },
  { value: 'completed', title: 'Завершено' },
  { value: 'cancelled', title: 'Отменено' },
];
function russianDate(iso: string, timezone: string) {
  return formatInTimeZone(new Date(iso), timezone, 'd MMMM, HH:mm', { locale: ru });
}
function rub(amount: number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(amount);
}
function loginError(e: unknown) {
  const details = e instanceof Error ? e.message : '';
  if (/invalid login credentials|invalid credentials|invalid password/i.test(details))
    return 'Неверная электронная почта или пароль.';
  if (/email not confirmed/i.test(details))
    return 'Сначала подтвердите электронную почту.';
  if (/rate limit|too many requests/i.test(details))
    return 'Слишком много попыток входа. Попробуйте позднее.';
  return 'Не удалось войти. Проверьте соединение и попробуйте ещё раз.';
}
function statusError(e: unknown) {
  const details = e instanceof Error ? e.message : '';
  if (/exclusion|no_overlap|slot_taken|23P01|conflict/i.test(details))
    return 'На это время уже есть другая запись. Невозможно вернуть отменённую запись в работу.';
  if (/policy|permission denied|42501|row-level security/i.test(details))
    return 'Недостаточно прав для изменения статуса. Примените обновление политики Supabase.';
  if (/check constraint|23514/i.test(details))
    return 'В базе данных пока не разрешён этот статус. Примените обновление SQL для статусов.';
  if (/Статус записи уже изменился/.test(details)) return details;
  return 'Не удалось изменить статус записи. Проверьте подключение к серверу.';
}

function archiveError(e: unknown) {
  const details = e && typeof e === 'object' && 'message' in e && typeof e.message === 'string'
    ? e.message : '';
  if (/booking_has_payments/.test(details)) return 'У этой записи есть оплаты или возвраты. Удаление заблокировано для сохранения финансовой истории.';
  if (/booking_not_found/.test(details)) return 'Запись уже удалена или изменилась. Обновите список.';
  if (/not_authorized|permission denied|42501|row-level security/i.test(details)) return 'Удалять записи может только владелец студии.';
  if (/PGRST202|schema cache|autopremium_archive_booking/i.test(details)) return 'Функция удаления ещё не установлена в Supabase. Примените SQL-миграцию для удаления записей.';
  return 'Не удалось удалить запись. Проверьте подключение к серверу.';
}

export function AutoPremiumAdminPage() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [changing, setChanging] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AdminBooking | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const [realtime, setRealtime] = useState('Подключаем обновления…');
  const [section, setSection] = useState<'overview' | 'bookings'>('bookings');
  const [period, setPeriod] = useState<BookingPeriod>('all');
  const [paymentBookingId, setPaymentBookingId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState<'payment' | 'refund'>('payment');
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentOperationId, setPaymentOperationId] = useState(createUUID);
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const dialog = deleteDialog.current;
    if (!deleteTarget || !dialog) return;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, [deleteTarget]);

  useEffect(() => {
    if (!supabase) { setUserId(null); return; }
    let active = true;
    void supabase.auth.getUser().then(({ data }) => { if (active) setUserId(data.user?.id ?? null); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        if (_event === 'SIGNED_IN') { setSection('bookings'); setPeriod('all'); }
        setUserId(session?.user?.id ?? null);
        qc.removeQueries({ queryKey: [queryPrefix] });
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [qc]);

  const studio = useQuery({ queryKey: [queryPrefix, 'studio'], queryFn: () => remoteStudio(studioSlug), enabled: !!userId });
  const access = useQuery({
    queryKey: [queryPrefix, 'access', userId, studio.data?.id],
    enabled: !!userId && !!studio.data?.id,
    queryFn: async () => {
      const { data, error: dbError } = await requireSupabase().from('studio_owners')
        .select('studio_id').eq('studio_id', studio.data!.id!).eq('user_id', userId!).maybeSingle();
      if (dbError) throw dbError;
      if (!data) throw new Error('Этот аккаунт не является владельцем студии «Авто Премиум»');
      return true;
    },
  });
  const bookings = useQuery({
    queryKey: [queryPrefix, 'bookings'],
    queryFn: () => remoteAdminBookings(studioSlug),
    enabled: access.isSuccess,
    refetchInterval: 15_000, // fallback if Realtime is unavailable
  });
  const payments = useQuery({
    queryKey: [queryPrefix, 'payments'],
    queryFn: () => remoteAdminPayments(studioSlug),
    enabled: access.isSuccess,
    refetchInterval: 15_000,
    retry: 1,
  });

  useEffect(() => {
    if (!access.isSuccess || !studio.data?.id || !supabase) return;
    const channel = supabase.channel(`autopremium-bookings-${studio.data.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'bookings', filter: `studio_id=eq.${studio.data.id}`,
      }, () => { void qc.invalidateQueries({ queryKey: [queryPrefix, 'bookings'] }); })
      .subscribe(status => {
        setRealtime(status === 'SUBSCRIBED' ? 'Обновления в реальном времени включены'
          : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? 'Переподключаемся; список обновляется каждые 15 секунд'
          : 'Подключаем обновления…');
      });
    return () => { void supabase?.removeChannel(channel); };
  }, [access.isSuccess, studio.data?.id, qc]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const { error: authError } = await requireSupabase().auth.signInWithPassword({ email, password });
      if (authError) throw authError;
    } catch (e) { setError(loginError(e)); }
    finally { setBusy(false); }
  }

  async function changeStatus(id: string, previousStatus: AdminBookingStatus, nextStatus: AdminEditableStatus) {
    if (nextStatus === previousStatus || (nextStatus === 'reserved' && (previousStatus === 'new' || previousStatus === 'arrived'))) return;
    if (nextStatus === 'cancelled' && !window.confirm('Отменить эту запись?')) return;
    setChanging(id); setError('');
    try {
      await updateRemoteBookingStatus(studioSlug, id, previousStatus, nextStatus);
      await qc.invalidateQueries({ queryKey: [queryPrefix, 'bookings'] });
    } catch (e) { setError(statusError(e)); }
    finally { setChanging(''); }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true); setError(''); setNotice('');
    try {
      await archiveRemoteBooking(studioSlug, deleteTarget.id);
      if (paymentBookingId === deleteTarget.id) setPaymentBookingId(null);
      setDeleteTarget(null);
      await Promise.allSettled([
        qc.invalidateQueries({ queryKey: [queryPrefix, 'bookings'] }),
        qc.invalidateQueries({ queryKey: [queryPrefix, 'payments'] }),
      ]);
      setNotice('Запись удалена из списка. Время снова доступно для бронирования.');
    } catch (e) { setError(archiveError(e)); }
    finally { setDeleting(false); }
  }

  async function addPayment(event: React.FormEvent) {
    event.preventDefault();
    if (!paymentBookingId || paymentBusy) return;
    setError(''); setNotice('');
    const amount = Number(paymentAmount.trim().replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0 || Math.abs(Math.round(amount * 100) - amount * 100) > 1e-6) {
      setError('Введите положительную сумму с точностью до копеек.');
      return;
    }
    setPaymentBusy(true);
    try {
      await recordRemotePayment(studioSlug, paymentBookingId, amount, paymentType, paymentOperationId);
      await qc.invalidateQueries({ queryKey: [queryPrefix, 'payments'] });
      setPaymentBookingId(null); setPaymentAmount(''); setPaymentOperationId(createUUID());
      setNotice('Операция записана в учёт оплат.');
    } catch {
      setError('Не удалось записать оплату. Проверьте подключение и права владельца.');
    } finally { setPaymentBusy(false); }
  }

  if (userId === undefined) return <div className="splash" role="status">Проверяем вход…</div>;
  if (!userId) return <div className="app admin-mode autopremium"><div className="login-page"><div className="login-card">
    <span className="eyebrow">АВТО ПРЕМИУМ / ВЛАДЕЛЕЦ</span><h1>Вход владельца</h1>
    <p>Записи «Авто Премиум» доступны только авторизованному владельцу.</p>
    <form onSubmit={signIn}><label>Электронная почта<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label>
      <label>Пароль<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Входим…' : 'Войти'}</button>
    </form><Link className="back-link" to="/s/autopremium/">← Вернуться на сайт</Link>
  </div></div></div>;

  const failure = studio.error || access.error || bookings.error;
  const timezone = studio.data?.timezone ?? 'Asia/Novosibirsk';
  const allBookings = bookings.data ?? [];
  const filtered = bookingsForPeriod(allBookings, period, timezone, now);
  const metrics = dashboardMetrics(allBookings, payments.data, timezone, now);
  const nextBookings = allBookings.filter(booking =>
    booking.status !== 'cancelled' && Date.parse(booking.startsAt) >= now.getTime(),
  ).slice(0, 5);
  const paymentBooking = allBookings.find(booking => booking.id === paymentBookingId);
  const stats = [
    { label: 'ЗАЕЗДОВ СЕГОДНЯ', value: String(metrics.visitsToday), detail: 'Клиенты, отмеченные как приехавшие', Icon: CarProfile },
    { label: 'ЗА ПОСЛЕДНИЕ 7 ДНЕЙ', value: String(metrics.visitsWeek), detail: 'С учётом сегодняшнего дня', Icon: CalendarBlank },
    { label: 'ЗАВЕРШЁННЫХ РАБОТ', value: String(metrics.completed), detail: 'За всё время', Icon: CheckCircle },
    { label: 'ПОЛУЧЕНО ДЕНЕГ', value: metrics.revenue == null ? '—' : rub(metrics.revenue),
      detail: payments.isError ? 'Ошибка загрузки оплат' : payments.isPending ? 'Загружаем оплаты…' : metrics.revenue == null ? 'Учёт оплат ещё не подключён' : 'Поступления за вычетом возвратов', Icon: CurrencyCircleDollar },
  ];

  return <div className="app admin-mode autopremium"><div className="owner-shell demo-admin-shell">
    <aside className="owner-sidebar demo-admin-sidebar">
      <nav aria-label="Разделы управления">
        <button type="button" className={section === 'overview' ? 'active' : ''} aria-current={section === 'overview' ? 'page' : undefined} onClick={() => setSection('overview')}>
          <ChartBar size={20}/> Обзор {section === 'overview' && <CaretRight size={16} className="menu-caret"/>}
        </button>
        <button type="button" className={section === 'bookings' ? 'active' : ''} aria-current={section === 'bookings' ? 'page' : undefined} onClick={() => setSection('bookings')}>
          <CalendarBlank size={20}/> Записи {section === 'bookings' && <CaretRight size={16} className="menu-caret"/>}
        </button>
      </nav>
      <div className="owner-sidebar-bottom">
        <Link to="/s/autopremium/"><ArrowUpRight size={20}/> Открыть сайт</Link>
        <button type="button" onClick={() => { void requireSupabase().auth.signOut(); }}><SignOut size={20}/> Выйти</button>
      </div>
    </aside>
    <div className="owner-content demo-admin">
      <div className="owner-topbar"><span>АВТО ПРЕМИУМ / {section === 'overview' ? 'ОБЗОР СТУДИИ' : 'ЗАПИСИ'}</span><span className="demo-admin-online"><i className="status-dot"/> ПАНЕЛЬ ВЛАДЕЛЬЦА</span></div>
      <section className="owner-page">
        <div className="owner-heading"><div><span className="eyebrow">ПАНЕЛЬ ВЛАДЕЛЬЦА</span>
          <h1>{section === 'overview' ? 'Обзор студии' : 'Записи'}<span>.</span></h1>
          <p>{section === 'overview' ? 'Показатели работы и ближайшие клиенты.' : <span aria-live="polite">{realtime}</span>}</p>
        </div>{section === 'bookings' ?
          <button type="button" className="btn btn-outline" onClick={() => void bookings.refetch()} disabled={!access.isSuccess}>Обновить список</button> :
          <button type="button" className="btn btn-outline" onClick={() => setSection('bookings')}>К записям <ArrowRight size={18}/></button>
        }</div>
        {failure && <div className="form-error" role="alert">Не удалось загрузить данные. Проверьте подключение к серверу или права доступа.</div>}
        {error && <div className="form-error" role="alert">{error}</div>}
        {notice && <p className="demo-admin-notice" role="status">{notice}</p>}
        {(studio.isLoading || access.isLoading || bookings.isLoading) && <p role="status">Загружаем записи…</p>}

        {section === 'overview' && access.isSuccess && bookings.data && <>
          <div className="stats-grid demo-admin-stats">{stats.map(({ label, value, detail, Icon }) =>
            <div className="stat-card" key={label}><div><span>{label}</span><Icon size={23}/></div><strong>{value}</strong><small>{detail}</small></div>,
          )}</div>
          <p className="demo-admin-metrics-note">Заезды считаются по записям со статусом «Готово» или «Завершено» и дате записи по времени студии.</p>
          {payments.data === null && <div className="demo-admin-info" role="note">Учёт реальных оплат ещё не подключён к Supabase. Чтобы видеть полученную сумму, примените миграцию <code>supabase/autopremium-payments.sql</code>. Стоимость услуги не считается полученными деньгами.</div>}
          {payments.isError && <div className="form-error" role="alert">Не удалось загрузить операции оплаты. Проверьте права доступа к учёту оплат.</div>}
          <div className="owner-section-head demo-admin-preview-heading"><h2>Ближайшие записи</h2><button type="button" onClick={() => { setSection('bookings'); setPeriod('all'); }}>Все записи <ArrowRight size={17}/></button></div>
          <div className="owner-table-wrap"><table className="owner-table"><thead><tr><th>ДАТА И ВРЕМЯ</th><th>КЛИЕНТ / АВТО</th><th>УСЛУГА</th><th>СТАТУС</th></tr></thead>
            <tbody>{nextBookings.map(booking => <tr key={booking.id}><td>{russianDate(booking.startsAt, timezone)}</td><td><strong>{booking.customerName || '—'}</strong><small>{booking.car}</small></td><td>{booking.serviceTitle}</td><td><span className={`status-tag ${['new', 'arrived'].includes(booking.status) ? 'reserved' : booking.status}`}>{statusLabels[booking.status]}</span></td></tr>)}</tbody>
          </table>{!nextBookings.length && <div className="empty-table">Предстоящих записей пока нет.</div>}</div>
        </>}

        {section === 'bookings' && <>
          <div className="tabs demo-admin-periods" aria-label="Период записей">{([['today', 'Сегодня'], ['week', '7 дней'], ['all', 'Все записи']] as const).map(([value, label]) =>
            <button type="button" key={value} className={period === value ? 'active' : ''} aria-pressed={period === value} onClick={() => setPeriod(value)}>{label}</button>,
          )}</div>
          {paymentBooking && payments.data != null && <form className="demo-admin-payment-form" onSubmit={addPayment}>
            <div><strong>Учёт оплаты: {paymentBooking.customerName || paymentBooking.car}</strong><p>Записывайте только фактически полученные суммы и возвраты.</p></div>
            <label>Операция<select value={paymentType} disabled={paymentBusy} onChange={event => { setPaymentType(event.target.value as 'payment' | 'refund'); setPaymentOperationId(createUUID()); }}><option value="payment">Оплата</option><option value="refund">Возврат</option></select></label>
            <label>Сумма, ₽<input value={paymentAmount} disabled={paymentBusy} inputMode="decimal" type="text" placeholder="0,00" onChange={event => { setPaymentAmount(event.target.value); setPaymentOperationId(createUUID()); }} required/></label>
            <button className="btn btn-primary" type="submit" disabled={paymentBusy}>{paymentBusy ? 'Сохраняем…' : 'Записать'}</button>
            <button className="btn btn-outline" type="button" disabled={paymentBusy} onClick={() => setPaymentBookingId(null)}>Закрыть</button>
          </form>}
          {access.isSuccess && bookings.data && <div className="owner-table-wrap"><table className="owner-table demo-admin-bookings-table"><thead><tr><th>ДАТА И ВРЕМЯ</th><th>УСЛУГА</th><th>КЛИЕНТ</th><th>ТЕЛЕФОН</th><th>АВТО</th><th>СТАТУС</th><th>ДЕЙСТВИЯ</th></tr></thead><tbody>
            {filtered.map(booking => <tr key={booking.id}><td>{russianDate(booking.startsAt, timezone)}</td><td>{booking.serviceTitle}</td><td>{booking.customerName || '—'}</td><td>{booking.phone || '—'}</td><td>{booking.car}</td><td><span className={`status-tag ${['new', 'arrived'].includes(booking.status) ? 'reserved' : booking.status}`} title={booking.status === 'ready' ? 'Клиент приехал, услуга ещё не выполнена' : undefined}>{statusLabels[booking.status] ?? 'Неизвестно'}</span></td><td>
              <select className="admin-status-select" aria-label={`Действия с записью ${booking.customerName || booking.id}`} value="" disabled={changing === booking.id || deleting} onChange={event => void changeStatus(booking.id, booking.status, event.target.value as AdminEditableStatus)}>
                <option value="" disabled>{changing === booking.id ? 'Сохраняем…' : 'Действия'}</option>
                {actions.map(action => <option key={action.value} value={action.value} disabled={action.value === booking.status || (action.value === 'reserved' && (booking.status === 'new' || booking.status === 'arrived'))}>{action.title}</option>)}
              </select>
              {payments.data != null && <button type="button" className="demo-admin-payment-open" onClick={() => { setPaymentBookingId(booking.id); setPaymentOperationId(createUUID()); setPaymentAmount(''); setNotice(''); }}>Учесть оплату</button>}
              <button type="button" className="demo-admin-delete-open" disabled={changing === booking.id || deleting || !!payments.data?.some(payment => payment.bookingId === booking.id)} title={payments.data?.some(payment => payment.bookingId === booking.id) ? 'Запись с оплатами или возвратами удалить нельзя' : 'Удалить запись из CRM'} onClick={() => { setError(''); setNotice(''); setDeleteTarget(booking); }}><Trash size={14}/> Удалить</button>
            </td></tr>)}
          </tbody></table>{!filtered.length && <div className="empty-table"><CalendarBlank size={24}/> На выбранный период записей нет.</div>}</div>}
        </>}
      </section>
    </div>
    {deleteTarget && <dialog ref={deleteDialog} className="demo-admin-delete-dialog" aria-labelledby="delete-booking-title" aria-describedby="delete-booking-description" onCancel={event => { if (deleting) event.preventDefault(); else setDeleteTarget(null); }}>
      <h2 id="delete-booking-title">Точно удалить запись?</h2>
      <p id="delete-booking-description">{deleteTarget.customerName || 'Клиент'} · {deleteTarget.serviceTitle} · {russianDate(deleteTarget.startsAt, timezone)}</p>
      <p>Запись исчезнет из CRM, а время освободится для новых клиентов. Действие нельзя отменить через панель. Записи с оплатами защищены от удаления.</p>
      <div className="demo-admin-delete-dialog-actions">
        <button type="button" className="btn btn-outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>Оставить запись</button>
        <button type="button" className="btn demo-admin-delete-confirm" disabled={deleting} onClick={() => void confirmDelete()}>{deleting ? 'Удаляем…' : 'Да, удалить запись'}</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </dialog>}
  </div></div>;
}
