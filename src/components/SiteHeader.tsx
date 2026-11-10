import { Link } from "@tanstack/react-router";
import { Home, CircleHelp, KeyRound, Trophy } from "lucide-react";
import { Button } from '@/components/ui/button';
import logoUrl from "@/assets/logo-100-suara.png";
const logo = { url: logoUrl };
import { SoundToggle } from '@/components/SoundToggle';

const NAV = [
  { to: "/", label: "Beranda", icon: Home },
  { to: "/tentang", label: "Tentang Permainan", icon: CircleHelp },
  { to: "/kunci-jawaban", label: "Kunci Jawaban", icon: KeyRound },
  { to: "/peringkat", label: "Papan Peringkat", icon: Trophy },
] as const;

export function SiteHeader() {
  return (
    <header className="site-header border-b bg-card text-primary">
      <div className="mx-auto flex max-w-[1560px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link to="/" className="site-brand flex items-center gap-3" aria-label="100 SUARA, beranda">
          <img src={logo.url} alt="100 SUARA — Bangun Bangsa" className="h-11 w-auto" width={900} height={574} />
        </Link>
        <nav className="order-last -mx-1 flex w-full gap-1 overflow-x-auto text-sm md:order-none md:mx-0 md:w-auto">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: true }}
              className="flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 hover:bg-accent"
              activeProps={{ className: "bg-primary text-primary-foreground font-semibold" }}
            >
              <n.icon className="size-3.5" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <SoundToggle className="sound-toggle-light" />
          <Button asChild variant="gold"><Link to="/main">Main</Link></Button>
        </div>
      </div>
    </header>
  );
}
