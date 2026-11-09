import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { KeyRound, Search, Check } from "lucide-react";
import { InfoScreen, PageControls } from "@/components/InfoScreen";
import { Button } from "@/components/ui/button";
import { ASPIRASI, DEMOKRASI, MISI, KEJUTAN, PUTUSAN, PENTAGON, FDT } from "@/site/cards";

export const Route = createFileRoute("/kunci-jawaban")({
  head: () => ({
    meta: [
      { title: "Kunci Jawaban — 100 SUARA Bangun Bangsa" },
      { name: "description", content: "Seluruh kartu pertanyaan 100 SUARA beserta kunci jawabannya, bisa dicari memakai kode kartu." },
      { property: "og:title", content: "Kunci Jawaban — 100 SUARA" },
      { property: "og:description", content: "Katalog kartu pertanyaan dan kunci jawaban permainan 100 SUARA." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KunciJawaban,
});

const LETTERS = "ABCDE";
const LEVEL = ["", "Mudah", "Sedang", "Sulit"];
const SUB: Record<string, string> = { cekfakta: "Cek Fakta", dilema: "Dilema", forum: "Forum", refleksi: "Refleksi", peristiwa: "Peristiwa", kesempatan: "Kesempatan" };

type Entry = { code: string; deck: string; tag?: string; text: string; options?: string[]; answer?: number; weights?: number[]; notes?: string[] };

const ALL: Entry[] = [
  ...ASPIRASI.map(c => ({ code: c.code ?? c.id, deck: "Aspirasi", tag: LEVEL[c.level], text: c.prompt, options: c.options, answer: c.answer, weights: c.weights })),
  ...DEMOKRASI.map(c => ({ code: c.code ?? c.id, deck: "Demokrasi", tag: SUB[c.sub], text: c.prompt, options: c.options ?? c.choices?.map(x => x.label), answer: c.answer, weights: c.weights })),
  ...PENTAGON.map(c => ({ code: c.code ?? c.id, deck: "Pentagon", text: c.prompt, options: c.options, answer: c.answer })),
  ...MISI.map(c => ({ code: c.code ?? c.id, deck: "Misi", text: c.prompt, options: c.options, answer: c.answer })),
  ...PUTUSAN.map(c => ({ code: c.code ?? c.id, deck: "Putusan", text: c.text, notes: [`A. ${c.a.label}`, `B. ${c.b.label}`, `Konsekuensi lebih ringan: ${c.lighter.toUpperCase()}`] })),
  ...KEJUTAN.map(c => ({ code: c.code ?? c.id, deck: "Kejutan", tag: SUB[c.sub], text: c.text })),
  ...FDT.map(c => ({ code: c.code ?? c.id, deck: "FDT", text: c.text })),
];
const DECKS = ["Semua", "Aspirasi", "Demokrasi", "Pentagon", "Misi", "Putusan", "Kejutan", "FDT"];
const PER_PAGE = 4;

function AnswerCard({ e }: { e: Entry }) {
  const best = e.weights ? Math.max(...e.weights) : -1;
  return (
    <article className="key-card">
      <header><span className="key-code">{e.code}</span><span className="key-deck">{e.deck}{e.tag ? ` · ${e.tag}` : ""}</span></header>
      <p className="key-q">{e.text}</p>
      {e.options && <ol className="key-opts">{e.options.map((o, i) => {
        const ok = e.answer === i || (e.weights && e.weights[i] === best);
        return <li key={i} className={ok ? "is-key" : ""}><b>{LETTERS[i]}</b><span>{o}{e.weights ? ` (bobot ${e.weights[i]})` : ""}</span>{ok && <Check aria-label="Kunci jawaban" />}</li>;
      })}</ol>}
      {e.notes && <ul className="key-notes">{e.notes.map(n => <li key={n}>{n}</li>)}</ul>}
      {!e.options && !e.notes && <p className="key-notes">Kartu tanpa kunci jawaban.</p>}
    </article>
  );
}

function KunciJawaban() {
  const [q, setQ] = useState("");
  const [deck, setDeck] = useState("Semua");
  const [page, setPage] = useState(0);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return ALL.filter(e => (deck === "Semua" || e.deck === deck) && (!s || e.code.toLowerCase().includes(s) || e.text.toLowerCase().includes(s)));
  }, [q, deck]);
  const total = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const cur = Math.min(page, total - 1);
  const shown = list.slice(cur * PER_PAGE, cur * PER_PAGE + PER_PAGE);
  return (
    <InfoScreen title="Kunci Jawaban" subtitle={`${ALL.length} kartu pertanyaan 100 SUARA`} icon={KeyRound} footer={<PageControls page={cur} total={total} onChange={setPage} />}>
      <div className="key-search"><Search /><input value={q} onChange={e => { setQ(e.target.value); setPage(0); }} placeholder="Cari kode kartu, mis. A-EKO-M-01" aria-label="Cari kode kartu" /></div>
      <div className="guide-sections mt-3" aria-label="Filter jenis kartu">{DECKS.map(d => <Button key={d} size="sm" variant={deck === d ? "default" : "outline"} onClick={() => { setDeck(d); setPage(0); }}>{d}</Button>)}</div>
      <p className="mt-3 text-xs font-bold text-gold">{list.length} KARTU DITEMUKAN</p>
      <div className="key-grid">{shown.map(e => <AnswerCard key={e.code + e.deck} e={e} />)}{!shown.length && <p>Tidak ada kartu dengan kode itu.</p>}</div>
    </InfoScreen>
  );
}
