/**
 * Copies the hash of ONLINE_ROOM_SECRET into the database so room RPCs accept this server.
 * Only works where the service-role key exists (Lovable hosting); other hosts such as Vercel
 * reuse the hash registered here, so both must hold the same secret value.
 */
export async function syncRoomKey(): Promise<{ ok: boolean; reason?: string }> {
  const secret = process.env['ONLINE_ROOM_SECRET'];
  if (!secret) return { ok: false, reason: 'missing-secret' };
  if (secret.length < 32) return { ok: false, reason: 'secret-too-short' };
  if (!process.env['SUPABASE_SERVICE_ROLE_KEY']) return { ok: false, reason: 'no-service-role' };
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  const hash = Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { error } = await supabaseAdmin.from('online_server_key').upsert({ id: true, hash });
  return error ? { ok: false, reason: 'db-error' } : { ok: true };
}
