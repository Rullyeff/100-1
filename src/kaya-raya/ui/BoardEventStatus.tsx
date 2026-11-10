import { Waves, PartyPopper, TrendingUp } from "lucide-react";
import { activeBoardEvent, affectedCities, EVENT_RULES } from "../sim/events";
import { useGame } from "../store";
import { cn } from "@/lib/utils";

const icons = { flood: Waves, festival: PartyPopper, boom: TrendingUp };
export function BoardEventStatus({ tile, compact = false }: { tile?: number; compact?: boolean }) {
  const game = useGame((s) => s.game);
  const event = activeBoardEvent(game, tile);
  if (!event) return null;
  const rule = EVENT_RULES[event.kind];
  const Icon = icons[event.kind];
  return <div data-board-event={event.kind} className={cn("max-w-full border-l-4 px-3 py-2", compact ? "bg-paper-foreground/5 text-paper-foreground" : "bg-background/95 text-foreground", event.kind === "flood" ? "border-accent" : event.kind === "festival" ? "border-gold" : "border-good")}>
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs font-bold">
      <Icon className="h-4 w-4 shrink-0" />
      <span>{rule.name}</span><span>{rule.impact}</span>
      <span className="font-normal">{event.endsRound - game.round + 1} putaran tersisa</span>
    </div>
    <div className="mt-1 text-center text-[11px]">{affectedCities(event).map((city) => city.name).join(" · ")}</div>
    {compact && <div className="mt-1 text-center text-[11px] opacity-70">Harga beli dan biaya bangun tetap</div>}
  </div>;
}