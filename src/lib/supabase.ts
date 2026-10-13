import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// The placeholder in .env deliberately does not enable a fake backend.
export const isSupabaseConfigured = Boolean(url && anonKey && anonKey !== 'ВСТАВЬ_КЛЮЧ');
export const supabase = isSupabaseConfigured ? createClient(url!, anonKey!) : null;

export function requireSupabase() {
  if (!supabase) throw new Error('Supabase не настроен. Укажите VITE_SUPABASE_ANON_KEY в .env.');
  return supabase;
}
