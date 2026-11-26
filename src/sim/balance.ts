/**
 * Balance simulation: plays AI-vs-AI games under a rule set and reports how games end.
 *
 * "Set power" measures the set bonus: among games where someone got N totems of one color
 * (N = setBonusAt), how often the first player to get there went on to win. The same number
 * is measured with the bonus off, so the difference is the advantage the bonus itself adds.
 */
import { decide } from '../ai/ai';
import { CARD_TYPES } from '../engine/cards';
import { applyAction, checkInvariants, createGame } from '../engine/engine';
import type { Rules } from '../engine/rules';
import type { GameState, PlayerId } from '../engine/types';
import { toView } from '../engine/view';

export interface SimResult {
  games: number;
  /** Share of games by result: "Five Colors", "Four Copies", "draw", ... */
  outcomes: Record<string, number>;
  avgTurns: number;
  firstPlayerWins: number;
  /** Share of games in which someone reached `setBonusAt` copies of one color. */
  reachedSet: number;
  /** Of those games: share won by the first player to reach it. */
  firstToSetWins: number;
  /** Average number of set bonuses granted per game (0 when the bonus is off). */
  bonusesPerGame: number;
}

function firstToSet(s: GameState, n: number): PlayerId | null {
  for (const p of [s.current, s.current === 'human' ? 'ai' : 'human'] as const) {
    const t = s.players[p].table;
    if (CARD_TYPES.some((ty) => t.filter((c) => c.type === ty).length >= n)) return p;
  }
  return null;
}

export function simulate(rules: Partial<Rules>, games = 400, seed0 = 1): SimResult {
  const outcomes: Record<string, number> = {};
  let turns = 0;
  let firstWins = 0;
  let reached = 0;
  let firstToSetWon = 0;
  let bonuses = 0;
  for (let seed = seed0; seed < seed0 + games; seed++) {
    let s = createGame({ seed, rules });
    const n = s.rules.setBonusAt;
    let setLeader: PlayerId | null = null;
    let steps = 0;
    while (!s.winner) {
      const p = s.pending!;
      s = applyAction(s, p.player, decide(toView(s, p.player)));
      const err = checkInvariants(s);
      if (err) throw new Error(`seed ${seed}: ${err}`);
      if (++steps > 10000) throw new Error(`seed ${seed} did not terminate`);
      setLeader ??= firstToSet(s, n);
    }
    bonuses += s.log.filter((e) => e.text.includes('set bonus!')).length;
    const key = s.winner === 'draw' ? 'draw' : (s.winReason ?? '?');
    outcomes[key] = (outcomes[key] ?? 0) + 1;
    turns += s.turn;
    if (s.winner === s.firstPlayer) firstWins++;
    if (setLeader) {
      reached++;
      if (s.winner === setLeader) firstToSetWon++;
    }
  }
  for (const k of Object.keys(outcomes)) outcomes[k] /= games;
  return {
    games,
    outcomes,
    avgTurns: turns / games,
    firstPlayerWins: firstWins / games,
    reachedSet: reached / games,
    firstToSetWins: reached ? firstToSetWon / reached : 0,
    bonusesPerGame: bonuses / games,
  };
}

const pct = (x: number) => `${Math.round(x * 100)}%`.padStart(4);

export function formatRow(name: string, r: SimResult): string {
  const out = Object.entries(r.outcomes)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${pct(v)}`)
    .join(', ');
  return [
    name.padEnd(44),
    out.padEnd(44),
    `turns ${r.avgTurns.toFixed(1).padStart(4)}`,
    `1st player ${pct(r.firstPlayerWins)}`,
    `first-to-set wins ${pct(r.firstToSetWins)}`,
    `bonuses/game ${r.bonusesPerGame.toFixed(2)}`,
  ].join(' | ');
}
