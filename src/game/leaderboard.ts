import type { LeaderboardEntry } from "@/site/leaderboard";
import { validVotes, type GameState } from "./sim/state";

const KEY = "suara100-leaderboard-v1";

/** Records a finished 3D match into the shared Papan Peringkat storage once. */
export function recordFinishedGame(s: GameState, startedAt: number) {
  if (s.winnerId === null) return;
  let list: LeaderboardEntry[] = [];
  try {
    list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    list = [];
  }
  if (list.some((e) => e.id === startedAt)) return;
  const scores = s.players.map((p) => validVotes(s, p.id));
  const top = Math.max(...scores);
  list.unshift({
    id: startedAt,
    finishedAt: Date.now(),
    winners: s.players.filter((_, i) => scores[i] === top && i === s.winnerId).map((p) => p.name),
    note: "Penghitungan suara sah akhir",
    players: s.players.map((p, i) => ({ name: p.name, area: i, score: scores[i] ?? 0, isBot: p.isBot })),
  });
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
}
