// Supabase project credentials.
// Either set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY at build time,
// or paste the values here directly. The anon key is safe to expose in
// a browser app — all real access control lives in the database (RLS).
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isConfigured = () =>
  SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 20
