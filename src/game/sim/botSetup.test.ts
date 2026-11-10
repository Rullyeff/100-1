import { describe, expect, it } from "vitest";
import { botAnswer } from "./bot";
import { playTurn } from "./engine";
import { LEVEL_ACCURACY, botAccuracy } from "./quiz";
import { createGame } from "./state";

function runBots(seed: number, opponents: number) {
  const s = createGame(seed, 0, { opponents, level: "sedang", styles: ["hemat", "agresif", "seimbang", "seimbang"] });
  const turns: number[] = [];
  for (let i = 0; i < 4000 && !s.over; i++) {
    turns.push(s.turn);
    const g = playTurn(s);
    let r = g.next();
    while (!r.done) r = g.next(botAnswer(s, r.value));
  }
  return { s, turns };
}

describe("bot setup", () => {
  it("2 lawan: hanya 3 kursi yang bermain, kursi kosong tidak pernah dapat giliran", () => {
    const s = createGame(7, 1, { opponents: 2, level: "mudah", styles: ["hemat", "agresif"] });
    expect(s.players.filter((p) => !p.absent).map((p) => p.id)).toEqual([0, 1, 2]);
    const { turns } = runBots(7, 2);
    expect(turns.every((t) => t <= 2)).toBe(true);
  });

  it("permainan dengan 1 lawan bisa selesai", () => {
    expect(runBots(11, 1).s.over).toBe(true);
  });

  it("tingkat kesulitan mengubah peluang jawaban benar bot", () => {
    expect(LEVEL_ACCURACY.mudah).toBeLessThan(LEVEL_ACCURACY.sedang);
    expect(LEVEL_ACCURACY.sedang).toBeLessThan(LEVEL_ACCURACY.sulit);
    expect(botAccuracy(1, undefined, "sulit")).toBeGreaterThan(botAccuracy(1, undefined, "mudah"));
  });

  it("bot Hemat menolak klaim yang bot Agresif ambil", () => {
    const s = createGame(3, 1, { opponents: 2, level: "sedang", styles: ["hemat", "agresif"] });
    s.players[1]!.cash = 8;
    s.players[2]!.cash = 8;
    const req = (player: number) => ({ kind: "buy", player }) as never;
    expect(botAnswer(s, req(1))).toBe(-1);
    expect(botAnswer(s, req(2))).toBe(0);
  });
});

describe("susunan kursi Latihan vs Bot", () => {
  const seat = (name: string, bot: boolean) => ({ name, bot });
  it("1 Manusia + 4 Bot: kelima kursi bermain, hanya kursi 1 manusia", () => {
    const s = createGame(5, 1, {
      opponents: 4, level: "sedang", styles: ["hemat", "agresif", "seimbang", "seimbang"],
      seats: [seat("Kamu", false), seat("Bot Joko", true), seat("Bot Budi", true), seat("Bot Sari", true), seat("Bot Rina", true)],
    });
    expect(s.players.every((p) => !p.absent)).toBe(true);
    expect(s.players.map((p) => p.isBot)).toEqual([false, true, true, true, true]);
    expect(s.players[1]!.name).toBe("Bot Joko");
    expect(s.players[1]!.style).toBe("hemat");
  });

  it("2 Manusia + 3 Bot: dua kursi pertama dimainkan bergantian di perangkat ini", () => {
    const s = createGame(5, 1, {
      opponents: 4, level: "sedang", styles: ["seimbang"],
      seats: [seat("Ani", false), seat("Budi", false), seat("Bot Budi", true), seat("Bot Sari", true), seat("Bot Rina", true)],
    });
    expect(s.players.filter((p) => !p.isBot).map((p) => p.name)).toEqual(["Ani", "Budi"]);
  });

  it("Simulasi 5 Bot bisa selesai tanpa pemain manusia", () => {
    const s = createGame(9, 1, {
      opponents: 4, level: "sedang", styles: ["seimbang", "agresif", "hemat", "seimbang", "seimbang"],
      seats: [0, 1, 2, 3, 4].map((i) => seat(`Bot ${i}`, true)),
    });
    for (let i = 0; i < 6000 && !s.over; i++) {
      const g = playTurn(s);
      let r = g.next();
      while (!r.done) r = g.next(botAnswer(s, r.value));
    }
    expect(s.over).toBe(true);
  });
});
