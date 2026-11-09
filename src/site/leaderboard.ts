
export interface LeaderboardEntry {
  id: number;
  finishedAt: number;
  winners: string[];
  note: string;
  players: { name: string; area: number; score: number; isBot: boolean }[];
}

const KEY = "suara100-leaderboard-v1";

export function readLeaderboard(): LeaderboardEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

