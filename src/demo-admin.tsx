import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarBlank, SignOut, XCircle } from '@phosphor-icons/react';
import { cancelDemoBooking, demoAdminBookings, demoStudio } from './lib/demo-bookings';
import { requireSupabase, supabase } from './lib/supabase';
import { prettyDate } from './slots';

export function DemoAdminPage() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState('');
  const [realtime, setRealtime] = useState('Подключаем обновления…');

  useEffect(() => {
    if (!supabase) { setUserId(null); return; }
    let active = true;
    void supabase.auth.getUser().then(({ data }) => { if (active) setUserId(data.user?.id ?? null); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) { setUserId(session?.user?.id ?? null); qc.removeQueries({ queryKey: ['demo-admin'] }); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [qc]);

  const studio = useQuery({ queryKey: ['demo-admin', 'studio'], queryFn: demoStudio, enabled: !!userId });
  const access = useQuery({
    queryKey: ['demo-admin', 'access', userId, studio.data?.id],
    enabled: !!userId && !!studio.data?.id,
    queryFn: async () => {
      const { data, error: dbError } = await requireSupabase().from('studio_owners')
        .select('studio_id').eq('studio_id', studio.data!.id!).eq('user_id', userId!).maybeSingle();
      if (dbError) throw dbError;
      if (!data) throw new Error('Этот аккаунт не является владельцем студии demo');
      return true;
    },
  });
  const bookings = useQuery({
    queryKey: ['demo-admin', 'bookings'],
    queryFn: demoAdminBookings,
    enabled: access.isSuccess,
    refetchInterval: 15_000, // fallback if Realtime is unavailable
  });

  useEffect(() => {
    if (!access.isSuccess || !studio.data?.id || !supabase) return;
    const channel = supabase.channel(`demo-bookings-${studio.data.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'bookings', filter: `studio_id=eq.${studio.data.id}`,
      }, () => { void qc.invalidateQueries({ queryKey: ['demo-admin', 'bookings'] }); })
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
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось войти'); }
    finally { setBusy(false); }
  }

  async function cancel(id: string) {
    if (!window.confirm('Отменить эту запись?')) return;
    setCancelling(id); setError('');
    try { await cancelDemoBooking(id); await qc.invalidateQueries({ queryKey: ['demo-admin', 'bookings'] }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось отменить запись'); }
    finally { setCancelling(''); }
  }

  if (userId === undefined) return <div className="splash" role="status">Проверяем вход…</div>;
  if (!userId) return <div className="app admin-mode"><div className="login-page"><div className="login-card">
    <span className="eyebrow">SUPABASE / OWNER</span><h1>Вход владельца</h1>
    <p>Записи студии demo доступны только авторизованному владельцу.</p>
    <form onSubmit={signIn}><label>Email<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label>
      <label>Пароль<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Входим…' : 'Войти'}</button>
    </form><Link className="back-link" to="/s/demo/">← Вернуться на сайт</Link>
  </div></div></div>;

  const failure = studio.error || access.error || bookings.error;
  return <div className="app admin-mode"><div className="owner-content demo-admin">
    <div className="owner-topbar"><span>SUPABASE / {studio.data?.name ?? 'DEMO'}</span><div><Link to="/s/demo/">Открыть сайт</Link><button type="button" onClick={() => { void requireSupabase().auth.signOut(); }}> <SignOut size={18}/> Выйти</button></div></div>
    <section className="owner-page"><div className="owner-heading"><div><span className="eyebrow">ПАНЕЛЬ ВЛАДЕЛЬЦА</span><h1>Записи<span>.</span></h1><p aria-live="polite">{realtime}</p></div><button type="button" className="btn btn-outline" onClick={() => void bookings.refetch()} disabled={!access.isSuccess}>Обновить список</button></div>
      {failure && <div className="form-error" role="alert">{failure.message}</div>}
      {error && <div className="form-error" role="alert">{error}</div>}
      {(studio.isLoading || access.isLoading || bookings.isLoading) && <p role="status">Загружаем записи…</p>}
      {access.isSuccess && bookings.data && <div className="owner-table-wrap"><table className="owner-table"><thead><tr><th>ДАТА И ВРЕМЯ</th><th>УСЛУГА</th><th>КЛИЕНТ</th><th>ТЕЛЕФОН</th><th>АВТО</th><th>СТАТУС / ДЕЙСТВИЕ</th></tr></thead><tbody>
        {bookings.data.map(booking => <tr key={booking.id}><td>{prettyDate(booking.startsAt, studio.data!.timezone)}</td><td>{booking.serviceTitle}</td><td>{booking.customerName}</td><td>{booking.phone}</td><td>{booking.car}</td><td><span className={`status-tag ${booking.status}`}>{booking.status === 'cancelled' ? 'Отменена' : booking.status === 'reserved' ? 'Записан' : booking.status}</span>{booking.status !== 'cancelled' && <button type="button" className="small-action" disabled={cancelling === booking.id} onClick={() => void cancel(booking.id)}><XCircle size={16}/> {cancelling === booking.id ? 'Отменяем…' : 'Отменить'}</button>}</td></tr>)}
      </tbody></table>{!bookings.data.length && <div className="empty-table"><CalendarBlank size={24}/> Пока нет записей.</div>}</div>}
    </section>
  </div></div>;
}
