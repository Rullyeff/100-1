import { createServerFn } from '@tanstack/react-start';
import { requireRoomAuth as requireSupabaseAuth } from './room-auth';
import { z } from 'zod';
import { createGame } from '../sim/state';
import { assertActor, resume, validateAnswer, type Checkpoint } from './runner';
import type { Json } from '@/integrations/supabase/types';

/** Server-only key proving room writes come from this app's server, not a player's browser. */
function serverSecret() {
  const secret = process.env['ONLINE_ROOM_SECRET'];
  if (!secret) throw new Error('Server belum diatur: kunci ruang online (ONLINE_ROOM_SECRET) belum diisi');
  return secret;
}

const roomInput = z.object({ roomId: z.string().uuid() });
export const roomOperation = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    operation: z.enum(['create', 'join', 'leave']),
    name: z.string().trim().min(1).max(24),
    code: z.string().max(8).optional(),
    roomId: z.string().uuid().optional(),
    seat: z.number().int().min(0).max(4).optional(),
    avatar: z.number().int().min(0).max(63).optional(),
  }))
  .handler(async ({ data, context }) => {
    const result = data.operation === 'create'
      ? await context.supabase.rpc('create_online_room', { p_name: data.name, p_seat: data.seat ?? 0, p_avatar: data.avatar ?? 0 })
      : data.operation === 'join'
        ? await context.supabase.rpc('join_online_room', { p_name: data.name, p_code: data.code ?? '', ...(data.seat === undefined ? {} : { p_seat: data.seat }), p_avatar: data.avatar ?? 0 })
        : await context.supabase.rpc('leave_online_room', { p_room: data.roomId ?? '' });
    if (result.error) throw new Error(result.error.message);
    return typeof result.data === 'string' ? result.data : null;
  });
export const readRoom = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth]).inputValidator(roomInput)
  .handler(async ({ data, context }) => {
    const { data: room, error } = await context.supabase.from('online_rooms').select('*').eq('id', data.roomId).single();
    if (error || !room) throw new Error('Ruang tidak ditemukan atau kamu bukan anggotanya');
    const { data: members, error: memberError } = await context.supabase.from('online_members').select('*').eq('room_id', data.roomId).order('seat');
    if (memberError || !members) throw new Error('Pemain tidak dapat dimuat');
    const me = members.find(m => m.user_id === context.userId);
    if (!me) throw new Error('Bukan anggota ruang');
    if (room.status !== 'playing') return { room, members, seat: me.seat, runtime: null };
    const { data: rows } = await context.supabase.rpc('online_runtime_get', { p_secret: serverSecret(), p_room: room.id });
    const runtime = rows?.[0];
    if (!runtime) throw new Error('Permainan tidak dapat dimuat');
    const result = resume(runtime.checkpoint as unknown as Checkpoint);
    // Never disclose future draws or the private answer transcript to players.
    const state = { ...result.state, rng: 0, decks: {} };
    const pending = result.pending?.player === me.seat ? result.pending : null;
    return { room, members, seat: me.seat, runtime: { revision: runtime.revision, state, pending, actor: result.pending?.player ?? null, dice: result.dice } };
  });
export const startRoom = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth]).inputValidator(roomInput)
  .handler(async ({ data, context }) => {
    const { data: room } = await context.supabase.from('online_rooms').select('*').eq('id', data.roomId).single();
    if (!room || room.host_id !== context.userId) throw new Error('Hanya pembuat ruang dapat memulai');
    const { data: members } = await context.supabase.from('online_members').select('*').eq('room_id', room.id);
    if (!members || members.length < 2) throw new Error('Tunggu minimal 2 pemain');
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
    const game = createGame(seed, 0);
    for (const member of members) {
      const player = game.players[member.seat];
      if (player) { player.name = member.name; player.isBot = false; }
    }
    const checkpoint = resume({ version: 1, base: game, answers: [] }).checkpoint;
    const { error } = await context.supabase.rpc('online_room_begin', { p_secret: serverSecret(), p_room: room.id, p_checkpoint: checkpoint as unknown as Json });
    if (error) throw new Error(error.message);
    return true;
  });
export const submitRoomAnswer = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(roomInput.extend({ revision: z.number().int().min(0), answer: z.union([z.number(), z.string().max(4000), z.null()]) }))
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase.from('online_members').select('seat').eq('room_id', data.roomId).eq('user_id', context.userId).single();
    if (!member) throw new Error('Bukan anggota ruang');
    const secret = serverSecret();
    const { data: rows } = await context.supabase.rpc('online_runtime_get', { p_secret: secret, p_room: data.roomId });
    const runtime = rows?.[0];
    if (!runtime || runtime.revision !== data.revision) return { accepted: false };
    const result = resume(runtime.checkpoint as unknown as Checkpoint);
    assertActor(result.pending, member.seat);
    if (!result.pending) throw new Error('Permainan selesai');
    const answer = validateAnswer(result.pending, data.answer);
    const next = resume({ ...result.checkpoint, answers: [...result.checkpoint.answers, answer] });
    const { data: saved, error } = await context.supabase.rpc('online_runtime_save', { p_secret: secret, p_room: data.roomId, p_revision: data.revision, p_checkpoint: next.checkpoint as unknown as Json });
    if (error) throw new Error('Jawaban belum tersimpan, coba lagi');
    return { accepted: saved === true };
  });