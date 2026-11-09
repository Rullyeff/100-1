import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { InfoScreen, PageControls } from "@/components/InfoScreen";
import civicWorld from "@/assets/beranda-dunia-demokrasi.jpg";
import { AREA_BG } from "@/components/game/theme";
import { AREAS } from "@/site/view";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tentang")({
  head: () => ({
    meta: [
      { title: "Tentang Permainan — 100 SUARA Bangun Bangsa" },
      { name: "description", content: "100 SUARA adalah boardgame edukasi demokrasi lima pemain, kini dalam versi website." },
      { property: "og:title", content: "Tentang Permainan — 100 SUARA" },
      { property: "og:description", content: "Latar, tujuan, dan komponen permainan edukasi demokrasi 100 SUARA." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Tentang,
});

const FACTS = [
  ["5", "pemain aktif"],
  ["120", "petak lintasan"],
  ["100", "token suara asli"],
  ["355", "kartu resmi"],
];

function Tentang() {
  const [page, setPage] = useState(0);
  return <InfoScreen title="Tentang Permainan" subtitle="Inovasi Program Pendidikan Politik" icon={CircleHelp} footer={<PageControls page={page} total={3} onChange={setPage} />}>
    {page === 0 && <section className="about-overview"><img src={civicWorld} width={1536} height={1024} alt="Dunia permainan 100 SUARA" className="about-art" /><h2 className="text-xl font-bold">Demokrasi dalam permainan.</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">100 SUARA — Bangun Bangsa mensimulasikan pengumpulan aspirasi, pengambilan keputusan publik, putusan rakyat, dan kompetisi suara.</p><p className="mt-3 text-sm leading-6 text-muted-foreground">Adaptasi digital boardgame fisik: perpindahan pion, token suara, kepemilikan petak, dan hasil voting diproses secara konsisten oleh sistem.</p><p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">Developed by <span className="font-semibold text-foreground">Ibrahim Rully Effendy</span></p></section>}
    {page === 1 && <section><h2 className="text-xl font-bold">Komponen permainan</h2><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{FACTS.map(([n,l])=><div key={l} className="rounded-lg border border-t-4 border-t-gold bg-card p-3 text-center"><div className="font-display text-2xl font-extrabold">{n}</div><div className="text-xs text-muted-foreground">{l}</div></div>)}</div><p className="mt-4 text-xs leading-5 text-muted-foreground">120 petak: 75 Jalur Luar, 25 Gerbang Demokrasi, dan 20 Pentagon. Bank 355 kartu resmi: 150 Aspirasi, 115 Demokrasi, 40 Kejutan, dan 50 Pentagon.</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Petak polos adalah petak kosong: pion yang berhenti di sana tidak membuka kartu, dan giliran langsung selesai.</p></section>}
    {page === 2 && <section><h2 className="text-xl font-bold">Lima bidang kebijakan</h2><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{AREAS.map((a,i)=><div key={a.name} className={cn("flex items-center gap-2 rounded-lg p-3 text-xs font-bold text-primary-foreground sm:flex-col sm:text-center",AREA_BG[i])}><span aria-hidden>{a.icon}</span>{a.name}</div>)}</div><h2 className="mt-5 text-lg font-bold">Tim penyusun</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Amanda Nisa Hafiza · Ayla Sabrina · Miranda Amalia — Universitas Borneo Lestari.</p></section>}
  </InfoScreen>;
}
