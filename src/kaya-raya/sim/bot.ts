import { TILES, TRAVEL_INDEX } from "./board";
import type { Req } from "./engine";
import { rollDice, tollOf, type GameState } from "./state";

/** Cash a bot tries to keep in hand after buying. */
const BOT_RESERVE = 250;
const BOT_TAKEOVER_RESERVE = 400;

export function botAnswer(s: GameState, req: Req): unknown {
  switch (req.kind) {
    case "roll":
      return rollDice(s);
    case "buy": {
      const cash = s.players[req.player]!.cash;
      const reserve = req.mode === "takeover" ? BOT_TAKEOVER_RESERVE : BOT_RESERVE;
      let best = -1;
      req.options.forEach((o, i) => {
        if (o.cost <= cash - reserve) best = i;
      });
      // Always grab bare land if it is affordable at all on an empty board.
      if (best === -1 && req.mode === "buy" && req.options[0]!.cost <= cash * 0.5) best = 0;
      return best;
    }
    case "pick": {
      if (req.purpose === "festival") {
        return [...req.tiles].sort((a, b) => tollOf(s, b) - tollOf(s, a))[0];
      }
      // Travel: most expensive empty city we can afford, else our own city, else Start.
      const cash = s.players[req.player]!.cash;
      const empty = req.tiles
        .filter((t) => TILES[t]!.kind === "city" && s.owners[t]! === -1 && TILES[t]!.price <= cash - BOT_RESERVE)
        .sort((a, b) => TILES[b]!.price - TILES[a]!.price);
      if (empty.length) return empty[0];
      const own = req.tiles.filter((t) => s.owners[t]! === req.player && s.levels[t]! < 4);
      if (own.length) return own[0];
      return req.tiles.includes(0) ? 0 : req.tiles.find((t) => t !== TRAVEL_INDEX);
    }
    default:
      return undefined;
  }
}
