import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

/**
 * Same check as the generated requireSupabaseAuth, but falls back to the public build-time
 * values so room functions also work on hosts (e.g. Vercel) that lack server env settings.
 */
export const requireRoomAuth = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const url = process.env['SUPABASE_URL'] || import.meta.env['VITE_SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'] || import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) throw new Error('Server belum tersambung ke database permainan');

  const authHeader = getRequest()?.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token.split('.').length !== 3) throw new Error('Unauthorized: Invalid token');

  const supabase = createClient<Database>(url, key, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set('apikey', key);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new Error('Unauthorized: Invalid token');
  return next({ context: { supabase, userId: data.claims.sub, claims: data.claims } });
});
