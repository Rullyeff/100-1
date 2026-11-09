import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { ArrowLeft, Copy, LogOut, Play, Plus, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo-100-suara.png';
import GameApp from '../GameApp';
import { enterOnline, leaveOnline, useGame } from '../store';
import { readRoom, roomOperation, startRoom, submitRoomAnswer } from './rooms.functions';
import { AREAS } from '../sim/board';

type RoomData = Awaited<ReturnType<typeof readRoom>>;
export function RoomPage({ roomId }: { roomId?: string }) {
  const navigate = useNavigate();
  const read = useServerFn(readRoom);
  const operation = useServerFn(roomOperation);
  const start = useServerFn(startRoom);
  const submit = useServerFn(submitRoomAnswer);
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [name, setName] = useState('');
  useEffect(() => { const n = localStorage.getItem('player-name'); if (n) setName(n); }, []);
  const [code, setCode] = useState('');
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
      const fullName = session?.user.user_metadata?.['full_name'];
      if (typeof fullName === 'string') setName(fullName.slice(0, 24));
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
      <Link to="/ruang" aria-label="Kembali ke ruang" title="Kembali ke ruang"><ArrowLeft className="size-4" /></Link>
      <span>Ruang {data.room.code}</span><span className={connected ? 'text-good' : 'text-bad'}>{busy ? 'Mengirim…' : connected ? 'Online' : 'Menghubungkan…'}</span>
      <Button variant="ghost" size="icon" className="size-6" aria-label="Sambung kembali" title="Sambung kembali" onClick={() => void refresh()}><RefreshCw className="size-3" /></Button>
    </div>
    {error && <div role="alert" className="game-ui-theme fixed bottom-12 left-1/2 z-50 w-[min(90vw,400px)] -translate-x-1/2 rounded border border-bad bg-background p-3 text-center text-sm">{error}</div>}
  </>;
  return <main className="game-ui-theme min-h-dvh bg-background px-5 py-6">
    <header className="mx-auto flex max-w-3xl items-center justify-between">
      <Button asChild variant="ghost"><Link to="/"><ArrowLeft />Beranda</Link></Button>
      {userId && <Button variant="ghost" size="icon" aria-label="Keluar akun" title="Keluar akun" onClick={() => void act(async () => { await supabase.auth.signOut(); setData(null); await navigate({ to: '/ruang', replace: true }); })}><LogOut /></Button>}
    </header>
    <section className="mx-auto max-w-lg py-6">
      <img src={logo} width={900} height={574} alt="100 SUARA — Bangun Bangsa" className="mx-auto mb-4 w-44" />
      <h1 className="mb-6 text-center font-display text-3xl text-gold">{data ? `Ruang ${data.room.code}` : 'Main Bersama'}</h1>
      {!authReady ? <p className="text-center">Memuat…</p> : !userId ? <p className="text-center">Menyiapkan…</p> : data ? <div className="space-y-5">
        <div className="flex items-center justify-between border-b border-border pb-3"><span className="flex items-center gap-2"><Users className="size-4" />{data.members.length}/5 pemain</span>
          <Button variant="secondary" size="sm" onClick={() => void act(async () => { await navigator.clipboard.writeText(data.room.code); setCopied(true); })}><Copy />{copied ? 'Tersalin' : 'Salin kode'}</Button></div>
        <ol className="divide-y divide-border">{Array.from({ length: 5 }, (_, seat) => {
          const member = data.members.find(m => m.seat === seat);
          return <li key={seat} className="flex items-center justify-between gap-3 py-3"><div><b>{member?.name ?? 'Menunggu pemain…'}</b><small className="block text-muted-foreground">{AREAS[seat]?.name}</small></div><span className="text-xs text-gold">{member?.user_id === data.room.host_id ? 'Pembuat ruang' : member?.user_id === userId ? 'Kamu' : ''}</span></li>;
        })}</ol>
        {data.room.host_id === userId && <Button className="w-full" disabled={busy || data.members.length < 2} onClick={() => void act(async () => { await start({ data: { roomId: data.room.id } }); await refresh(); })}><Play />Mulai permainan</Button>}
        <p className="text-center text-sm text-muted-foreground">{data.room.host_id === userId ? 'Minimal 2 pemain. Kursi kosong dimainkan bot.' : 'Menunggu pembuat ruang memulai permainan.'}</p>
        <Button variant="secondary" className="w-full" disabled={busy} onClick={() => void act(async () => { await operation({ data: { operation: 'leave', name: name || 'Pemain', roomId: data.room.id } }); await navigate({ to: '/ruang' }); })}><LogOut />Tinggalkan ruang</Button>
      </div> : roomId ? <Button className="w-full" onClick={() => void refresh()}><RefreshCw />Sambung kembali</Button> : <div className="space-y-5">
        <label className="block text-sm font-bold">Nama pemain<input aria-label="Nama pemain" maxLength={24} value={name} onChange={e => { setName(e.target.value); localStorage.setItem('player-name', e.target.value); }} className="mt-2 w-full rounded border border-border bg-secondary px-3 py-3 text-foreground" /></label>
        <Button className="w-full" disabled={busy || !name.trim()} onClick={() => void act(async () => { const id = await operation({ data: { operation: 'create', name } }); if (id) await navigate({ to: '/ruang/$roomId', params: { roomId: id } }); })}><Plus />Buat ruang privat</Button>
        <div className="border-t border-border pt-5"><label className="block text-sm font-bold">Kode ruang<input aria-label="Kode ruang" autoCapitalize="characters" maxLength={8} value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} className="mt-2 w-full rounded border border-border bg-secondary px-3 py-3 font-mono text-lg text-foreground" /></label>
        <Button variant="secondary" className="mt-3 w-full" disabled={busy || !name.trim() || code.length !== 8} onClick={() => void act(async () => { const id = await operation({ data: { operation: 'join', name, code } }); if (id) await navigate({ to: '/ruang/$roomId', params: { roomId: id } }); })}><Users />Gabung ruang</Button></div>
      </div>}
      {error && <p role="alert" className="mt-4 text-center text-sm text-bad">{error}</p>}
    </section>
  </main>;
}