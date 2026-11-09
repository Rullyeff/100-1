import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, KeyRound, CircleHelp, Home, Play, Trophy, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SoundToggle } from '@/components/SoundToggle';
import splash from '@/assets/beranda-game-splash.jpg';

const TABS = [
  { to: '/kunci-jawaban', label: 'Kunci Jawaban', icon: KeyRound },
  { to: '/peringkat', label: 'Peringkat', icon: Trophy },
  { to: '/tentang', label: 'Tentang', icon: CircleHelp },
] as const;

/** Game-style information screen: dark tokens, title-screen artwork, tabbed top bar and one framed panel. */
export function InfoScreen({ title, subtitle, icon: Icon, children, footer }: { title: string; subtitle: string; icon: LucideIcon; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="info-screen dark">
      <img src={splash} width={1920} height={1088} alt="" className="info-art" />
      <div className="info-shade" aria-hidden />
      <header className="info-top">
        <Link to="/" className="info-back" aria-label="Kembali ke beranda" title="Beranda"><Home /></Link>
        <nav className="info-tabs" aria-label="Menu informasi">
          {TABS.map((t) => (
            <Link key={t.to} to={t.to} className="info-tab" activeProps={{ className: 'info-tab-active', 'aria-current': 'page' }}>
              <t.icon /><span>{t.label}</span>
            </Link>
          ))}
        </nav>
        <Link to="/main" className="info-play"><Play /><span>MAIN</span></Link>
        <SoundToggle className="info-back" />
      </header>
      <main className="info-main">
        <section className="info-panel">
          <header className="info-heading">
            <span className="info-heading-icon"><Icon /></span>
            <div className="min-w-0"><h1>{title}</h1><p>{subtitle}</p></div>
          </header>
          <div className="info-content">{children}</div>
          {footer && <footer className="info-controls">{footer}</footer>}
        </section>
      </main>
    </div>
  );
}

export function PageControls({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  return <div className="flex items-center gap-3"><Button variant="outline" size="icon" className="info-page-btn" aria-label="Halaman sebelumnya" title="Halaman sebelumnya" disabled={page === 0} onClick={() => onChange(page - 1)}><ArrowLeft /></Button><span aria-live="polite" className="info-page-count">{page + 1} / {total}</span><Button variant="outline" size="icon" className="info-page-btn" aria-label="Halaman berikutnya" title="Halaman berikutnya" disabled={page >= total - 1} onClick={() => onChange(page + 1)}><ArrowRight /></Button></div>;
}
