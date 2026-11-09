import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crown, Trophy } from "lucide-react";
import { InfoScreen, PageControls } from "@/components/InfoScreen";
import { Button } from "@/components/ui/button";
import { AREA_BG } from "@/components/game/theme";
import { readLeaderboard, type LeaderboardEntry } from "@/site/leaderboard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/peringkat")({
  head: () => ({
    meta: [
      { title: "Papan Peringkat — 100 SUARA Bangun Bangsa" },
      { name: "description", content: "Rekap hasil permainan 100 SUARA yang dimainkan di perangkat ini: pemenang dan perolehan suara sah." },
      { property: "og:title", content: "Papan Peringkat — 100 SUARA" },
      { property: "og:description", content: "Rekap pemenang dan perolehan suara sah permainan 100 SUARA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Peringkat,
});

function Peringkat() {
  const [page, setPage] = useState(0);
  const [list, setList] = useState<LeaderboardEntry[] | null>(null);
  useEffect(() => setList(readLeaderboard()), []);

  const wins = new Map<string, number>();
  list?.forEach((e) => e.winners.forEach((w) => wins.set(w, (wins.get(w) ?? 0) + 1)));
  const top = [...wins.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <InfoScreen title="Papan Peringkat" subtitle="Hasil permainan yang selesai di perangkat ini." icon={Trophy} footer={list && list.length > 0 ? <PageControls page={page} total={list.length} onChange={setPage} /> : undefined}>

        {list && list.length === 0 && (
          <div className="mt-8 rounded-lg border-2 border-dashed p-10 text-center">
            <p className="text-muted-foreground">Belum ada permainan yang selesai.</p>
            <Button asChild variant="gold" className="mt-4">
              <Link to="/main">Mulai permainan</Link>
            </Button>
          </div>
        )}

        {top.length > 0 && (
          <div className="leaderboard-podium mt-4 grid grid-cols-3 gap-2">
            {top.slice(0, 3).map(([name, n], i) => (
              <div key={name} className={cn("rounded-lg border bg-card p-4 text-center shadow-card", i === 0 && "border-gold ring-2 ring-gold/50")}>
                <Crown className={cn("mx-auto size-6", i === 0 ? "text-gold" : "text-muted-foreground")} />
                <div className="mt-1 font-display text-lg font-extrabold">{name}</div>
                <div className="text-sm text-muted-foreground">{n} kemenangan</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 space-y-3">
          {list?.slice(page, page + 1).map((e) => (
            <article key={e.id} className="rounded-lg border bg-card p-4 shadow-card">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-display text-lg font-extrabold">🏆 {e.winners.join(" & ")}</div>
                <time className="text-xs text-muted-foreground">{new Date(e.finishedAt).toLocaleString("id-ID")}</time>
              </div>
              <div className="text-xs text-muted-foreground">{e.note}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[...e.players]
                  .sort((a, b) => b.score - a.score)
                  .map((p) => (
                    <span key={p.name} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs">
                      <span className={cn("size-2.5 rounded-full", AREA_BG[p.area])} />
                      {p.name} <b>{p.score}</b>
                    </span>
                  ))}
              </div>
            </article>
          ))}
        </div>
    </InfoScreen>
  );
}
