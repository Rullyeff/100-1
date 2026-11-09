import { describe, expect, it } from 'vitest';
import { createGame, votesInPlay } from '../sim/state';
import { assertActor, resume, validateAnswer } from './runner';

describe('online authoritative game', () => {
  it('supports five humans without replacing any with bots', () => {
    const game = createGame(23, 5);
    expect(game.players.filter(p => !p.isBot)).toHaveLength(5);
    expect(resume({ version: 1, base: game, answers: [] }).pending?.player).toBe(game.turn);
  });
  it('recovers the exact prompt and state after another device reconnects', () => {
    let current = resume({ version: 1, base: createGame(23, 5), answers: [] });
    for (let i = 0; i < 30 && current.pending; i++) {
      const req = current.pending;
      const answer = req.kind === 'roll' ? null : req.kind === 'debate' ? 'Saya mempertimbangkan hak semua warga.' : req.kind === 'buy' ? -1 : 0;
      current = resume({ ...current.checkpoint, answers: [...current.checkpoint.answers, answer] });
      expect(resume(JSON.parse(JSON.stringify(current.checkpoint)))).toEqual(current);
      expect(votesInPlay(current.state)).toBe(100);
    }
  });
  it('rejects answers from a different player', () => {
    const req = { kind: 'roll' as const, player: 3 };
    expect(() => assertActor(req, 2)).toThrow('Tunggu giliranmu');
    expect(() => assertActor(req, 3)).not.toThrow();
  });
  it('does not accept client supplied dice outcomes', () => {
    expect(() => validateAnswer({ kind: 'roll', player: 0 }, 6)).toThrow();
    expect(validateAnswer({ kind: 'roll', player: 0 }, null)).toBe(null);
  });
  it('rejects choices outside the presented options', () => {
    const req = { kind: 'choose' as const, player: 0, title: '', text: '', prefer: 0, options: ['A', 'B'] };
    expect(() => validateAnswer(req, 2)).toThrow();
    expect(() => validateAnswer(req, -1)).toThrow();
    expect(validateAnswer(req, 1)).toBe(1);
  });
});