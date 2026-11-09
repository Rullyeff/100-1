import { playTurn, type Req } from '../sim/engine';
import { botAnswer } from '../sim/bot';
import { rollDie, type GameState } from '../sim/state';
import { QUESTIONS } from '../sim/quiz';

export type InputReq = Extract<Req, { kind: 'roll' | 'buy' | 'quiz' | 'choose' | 'debate' }>;
export interface Checkpoint { version: 1; base: GameState; answers: unknown[] }
export function validateAnswer(req: InputReq, value: unknown): unknown {
  if (req.kind === 'roll') {
    if (value !== null) throw new Error('Lemparan tidak valid');
    return null;
  }
  if (req.kind === 'debate') {
    if (typeof value !== 'string' || !value.trim() || value.length > 4000) throw new Error('Tanggapan tidak valid');
    return value.trim();
  }
  const count = req.kind === 'quiz' ? QUESTIONS[req.deck][req.question]?.options.length ?? 0 : req.options.length;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < (req.kind === 'buy' ? -1 : 0) || value >= count) throw new Error('Pilihan tidak valid');
  return value;
}
/** Reconstruct a suspended generator from the turn boundary and its canonical inputs. */
export function resume(checkpoint: Checkpoint) {
  if (checkpoint.version !== 1) throw new Error('Versi permainan tidak didukung');
  let base = structuredClone(checkpoint.base);
  // JSON has no Infinity; an effectively unbounded cap must still survive storage.
  if (!Number.isFinite(base.maxRounds)) base.maxRounds = Number.MAX_SAFE_INTEGER;
  let answers = [...checkpoint.answers];
  let state = structuredClone(base);
  let input = 0;
  let dice = state.lastDice;
  for (let safety = 0; safety < 4000; safety++) {
    if (state.over) return { checkpoint: { version: 1 as const, base: state, answers: [] }, state, pending: null, dice };
    const turn = playTurn(state);
    let step = turn.next();
    while (!step.done) {
      const req = step.value;
      if (req.kind === 'step' || req.kind === 'jump' || req.kind === 'notice') { step = turn.next(); continue; }
      if (state.players[req.player]?.isBot) {
        const answer = botAnswer(state, req);
        if (req.kind === 'roll') dice = Number(answer);
        step = turn.next(answer);
        continue;
      }
      if (input >= answers.length) return { checkpoint: { version: 1 as const, base, answers }, state, pending: req, dice };
      const answer = validateAnswer(req, answers[input++]);
      const resolved = req.kind === 'roll' ? rollDie(state) : answer;
      if (req.kind === 'roll') dice = Number(resolved);
      step = turn.next(resolved);
    }
    if (input < answers.length) throw new Error('Urutan jawaban tidak valid');
    base = structuredClone(state);
    answers = [];
    input = 0;
  }
  throw new Error('Permainan tidak dapat dilanjutkan');
}
export function assertActor(pending: InputReq | null, seat: number) {
  if (!pending || pending.player !== seat) throw new Error('Tunggu giliranmu');
}