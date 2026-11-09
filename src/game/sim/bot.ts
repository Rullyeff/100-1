import { PLEDGE } from "./board";
import type { Req } from "./engine";
import { QUESTIONS, botAccuracy } from "./quiz";
import { rand, rollDie, type GameState } from "./state";

/** Votes a bot keeps in hand after a claim once duels are live (to pay a lost duel). */
const DUEL_RESERVE = 2;

export function botAnswer(s: GameState, req: Req): unknown {
  switch (req.kind) {
    case "roll":
      return rollDie(s);
    case "buy": {
      const p = s.players[req.player];
      // Hemat keeps a bigger cushion, Agresif claims whenever it can afford the pledge.
      const reserve = p?.style === "hemat" ? 10 : p?.style === "agresif" ? 0 : 5;
      return p && p.cash - PLEDGE >= reserve ? 0 : -1;
    }
    case "quiz": {
      const q = QUESTIONS[req.deck][req.question]!;
      if (rand(s) < botAccuracy(req.player, req.tag, s.botLevel)) return q.answer;
      return (q.answer + 1 + Math.floor(rand(s) * (q.options.length - 1))) % q.options.length;
    }
    case "choose":
      return req.prefer;
    case "debate":
      return "Saya mempertimbangkan bukti, kebutuhan warga, keterbukaan keputusan, perlindungan hak, dan evaluasi. Kritik ditanggapi dengan memeriksa bukti serta memperbaiki kebijakan.";
    default:
      return undefined;
  }
}
