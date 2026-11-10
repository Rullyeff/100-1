import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { ArrowLeft, Copy, LogOut, Play, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo-100-suara.png';
import GameApp from '../GameApp';
import { enterOnline, leaveOnline, useGame } from '../store';
import { readRoom, roomOperation, startRoom, submitRoomAnswer } from './rooms.functions';
import { AREAS } from '../sim/board';
import { DEFAULT_SEAT_AVATARS, avatarSrc } from '../ui/avatars';

const PLAYER_BG = ['bg-player-1', 'bg-player-2', 'bg-player-3', 'bg-player-4', 'bg-player-5'];

type RoomData = Awaited<ReturnType<typeof readRoom>>;
export function RoomPage({ roomId }: { roomId: string }) {
  const navigate = useNavigate();
  const read = useServerFn(readRoom);
  const operation = useServerFn(roomOperation);
  const start = useServerFn(startRoom);
  const submit = useServerFn(submitRoomAnswer);
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState<RoomData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(true);
  const [copied, setCopied] = useState(false);
  const current = useRef<RoomData | null>(null);
  const submitting = useRef(false);
  const revision = useRef(-1);
  const refresh = useCallback(async () => {
    if (!roomId) return;
    try {
      const next = await read({ data: { roomId } });
      if (next.runtime && next.runtime.revision < revision.current) return;
      current.current = next;
      setData(next);
      useGame.setState({ seatAvatars: Array.from({ length: 5 }, (_, seat) => next.members.find(m => m.seat === seat)?.avatar ?? DEFAULT_SEAT_AVATARS[seat]!) });
      setConnected(true);
      const runtime = next.runtime;
      if (runtime) {
        const prev = useGame.getState();
        useGame.setState({ game: runtime.state, dice: runtime.dice, rollId: prev.rollId + (revision.current >= 0 && runtime.dice !== prev.dice ? 1 : 0), mySeat: next.seat, onlineActor: runtime.actor, awaiting: runtime.pending });
        revision.current = runtime.revision;
      }
    } catch (e) { setConnected(false); setError(e instanceof Error ? e.message : 'Ruang belum dapat dimuat'); }
  }, [roomId, read]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (!session) {
        const { error: anonError } = await supabase.auth.signInAnonymously();
        if (anonError) setError('Belum bisa terhubung. Coba muat ulang halaman.');
        if (!anonError) return; // onAuthStateChange reloads
      }
      setUserId(session?.user.id ?? null);
      setAuthReady(true);
    };
    void load();
    const { data: listener } = supabase.auth.onAuthStateChange(() => { void load(); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!roomId || !userId) return;
    revision.current = -1;
    enterOnline((value) => {
      const runtime = current.current?.runtime;
      if (!runtime || submitting.current) return;
      submitting.current = true;
      setBusy(true);
      void submit({ data: { roomId, revision: runtime.revision, answer: value === undefined ? null : value as string | number | null } })
        .then(result => { if (!result.accepted) setError('Giliran sudah diperbarui.'); else setError(''); })
        .catch(e => setError(e instanceof Error ? e.message : 'Jawaban belum terkirim'))
        .finally(() => { submitting.current = false; setBusy(false); void refresh(); });
    });
    void refresh();
    // Bounded polling also catches private runtime updates and missed notifications.
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 2000);
    const channel = supabase.channel(`room-${roomId}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'online_rooms', filter: `id=eq.${roomId}` }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'online_members', filter: `room_id=eq.${roomId}` }, () => void refresh()).subscribe();
    const onFocus = () => void refresh();
    window.addEventListener('online', onFocus);
    window.addEventListener('focus', onFocus);
    const onOffline = () => setConnected(false);
    window.addEventListener('offline', onOffline);
    return () => { clearInterval(timer); void supabase.removeChannel(channel); window.removeEventListener('online', onFocus); window.removeEventListener('offline', onOffline); window.removeEventListener('focus', onFocus); leaveOnline(); };
  }, [roomId, userId, submit, refresh]);
  const act = async (action: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Coba lagi'); }
    finally { setBusy(false); }
  };
  if (data?.runtime) return <>
    <GameApp online />
    <div className="game-ui-theme pointer-events-auto fixed bottom-2 left-1/2 z-50 flex max-w-[95vw] -translate-x-1/2 items-center gap-2 rounded border border-border bg-background px-3 py-1 text-xs">
      <Link to="/main" search={{ mode: 'bersama' }} aria-label="Keluar dari permainan" title="Keluar dari permainan"><ArrowLeft className="size-4" /></Link>
      <span>Ruang {data.room.code}</span><span className={connected ? 'text-good' : 'text-bad'}>{busy ? 'Mengirim…' : connected ? 'Online' : 'Menghubungkan…'}</span>
      <Button variant="ghost" size="icon" className="size-6" aria-label="Sambung kembali" title="Sambung kembali" onClick={() => void refresh()}><RefreshCw className="size-3" /></Button>
    </div>
    {error && <div role="alert" className="game-ui-theme fixed bottom-12 left-1/2 z-50 w-[min(90vw,400px)] -translate-x-1/2 rounded border border-bad bg-background p-3 text-center text-sm">{error}</div>}
  </>;
  const me = data?.members.find(m => m.user_id === userId);
  const isHost = data?.room.host_id === userId;
  return <main className="game-ui-theme lobby min-h-dvh bg-background">
    <div className="lobby-topbar">
      <Link to="/main" search={{ mode: 'bersama' }} className="lobby-icon-btn" aria-label="Kembali" title="Kembali"><ArrowLeft className="h-5 w-5" /></Link>
      <img src={logo} width={900} height={574} alt="100 SUARA — Bangun Bangsa" className="w-28" />
      {userId ? <button className="lobby-icon-btn" aria-label="Keluar akun" title="Keluar akun" onClick={() => void act(async () => { await supabase.auth.signOut(); setData(null); await navigate({ to: '/main', search: { mode: 'bersama' }, replace: true }); })}><LogOut className="h-5 w-5" /></button> : <span className="w-11" />}
    </div>
    <section className="mx-auto w-full max-w-3xl px-3 pb-8 pt-4 sm:px-5">
      <div className="lobby-card">
        <header className="lobby-card-head">
          <span className="lobby-badge"><Users className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl leading-tight sm:text-3xl">{data ? `Ruang ${data.room.code}` : 'Main Bersama'}</h1>
            <p className="text-sm text-muted-foreground">{data ? 'Bagikan kode ini ke teman. Kursi kosong dimainkan bot.' : 'Menyambungkan ke ruang…'}</p>
          </div>
          {data && <button className="lobby-join" onClick={() => void act(async () => { await navigator.clipboard.writeText(data.room.code); setCopied(true); })}><Copy className="h-4 w-4" />{copied ? 'Tersalin' : 'Salin kode'}</button>}
        </header>
        {!authReady || !userId ? <p className="py-6 text-center">Memuat…</p> : data ? <div className="space-y-4">
          <div className="lobby-label flex items-center gap-2"><Users className="size-4" />{data.members.length}/5 pemain</div>
          <ol className="space-y-2">{Array.from({ length: 5 }, (_, seat) => {
            const member = data.members.find(m => m.seat === seat);
            return <li key={seat} className={`lobby-seat ${member ? '' : 'opacity-60'}`}>
              <span className={`lobby-avatar ${PLAYER_BG[seat]}`}><img src={member ? avatarSrc(member.avatar, seat) : avatarSrc(undefined, seat)} alt="" width={96} height={96} className={member ? '' : 'grayscale'} /></span>
              <div className="min-w-0 flex-1"><b className="block truncate">{member?.name ?? 'Menunggu pemain… (bot)'}</b><small className="text-muted-foreground">{AREAS[seat]?.name} · Start {seat + 1}</small></div>
              <span className="text-xs font-semibold text-gold">{member?.user_id === data.room.host_id ? 'Pembuat ruang' : member?.user_id === userId ? 'Kamu' : ''}</span>
            </li>;
          })}</ol>
          {isHost && <button className="btn-gold flex w-full items-center justify-center gap-2 py-3 text-xl disabled:opacity-50" disabled={busy || data.members.length < 2} onClick={() => void act(async () => { await start({ data: { roomId: data.room.id } }); await refresh(); })}><Play className="h-5 w-5" />Mulai Permainan</button>}
          <p className="text-center text-sm text-muted-foreground">{isHost ? (data.members.length < 2 ? 'Tunggu minimal 1 teman bergabung untuk mulai.' : 'Semua siap? Mulai saat kamu mau.') : 'Menunggu pembuat ruang memulai permainan.'}</p>
          <button className="w-full rounded-xl border border-border py-2.5 font-semibold hover:bg-muted disabled:opacity-50" disabled={busy} onClick={() => void act(async () => { await operation({ data: { operation: 'leave', name: me?.name || 'Pemain', roomId: data.room.id } }); await navigate({ to: '/main', search: { mode: 'bersama' } }); })}><LogOut className="mr-2 inline size-4" />Tinggalkan ruang</button>
        </div> : <button className="lobby-create justify-center" onClick={() => void refresh()}><RefreshCw className="h-4 w-4" />Sambung kembali</button>}
        {error && <p role="alert" className="mt-4 text-center text-sm text-bad">{error}</p>}
      </div>
    </section>
  </main>;
}
