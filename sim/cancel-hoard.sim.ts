/**
 * Playtest strategy check: "hoard Cancels until you have the winning play, then
 * counter their counter". A Hoarder bot (built on the normal AI) plays against the
 * normal AI, with the counter-the-counter rule off and on.
 */
import { it } from 'vitest';
import { decide } from '../src/ai/ai';
import { applyAction, createGame } from '../src/engine/engine';
import type { Rules } from '../src/engine/rules';
import type { Action, GameState, PlayerId } from '../src/engine/types';
import { toView } from '../src/engine/view';
import { evaluateWin } from '../src/engine/win';

const cancelsIn = (s: GameState, p: PlayerId) => s.players[p].hand.filter((c) => c.type === 'cancel').length;
const wouldWin = (s: GameState, p: PlayerId) =>
  !!s.stack && s.stack.owner === p && evaluateWin([...s.players[p].table, s.stack.card], s.rules).won;

/** Hoarder: never plays a Cancel while holding <= `keep` of them (unless nothing else is playable);
 *  only counters a play that would win; counters back whenever its own play would win. */
function hoarder(s: GameState, me: PlayerId, keep: number): Action {
  const v = toView(s, me);
  const p = s.pending!;
  if (p.kind === 'play' && cancelsIn(s, me) <= keep) {
    const nonCancel = v.myPlayable.filter((id) => v.myHand.find((c) => c.id === id)!.type !== 'cancel');
    if (nonCancel.length) return decide({ ...v, myPlayable: nonCancel });
  }
  if (p.kind === 'counter' && s.stack) {
    const opp = s.stack.owner === me ? null : s.stack.owner;
    return { type: 'counter', use: opp ? wouldWin(s, opp) : wouldWin(s, me) };
  }
  return decide(v);
}

function game(seed: number, rules: Partial<Rules>, keep: number) {
  const hoard: PlayerId = seed % 2 ? 'human' : 'ai';
  let s = createGame({ seed, rules, firstPlayer: (seed >> 1) % 2 ? 'human' : 'ai' });
  let hoardWinPlays = 0, countered = 0, counterCountered = 0;
  let watching = false;
  while (!s.winner) {
    const p = s.pending!;
    const seen = s.log.length;
    const action = p.player === hoard ? hoarder(s, hoard, keep) : decide(toView(s, p.player));
    if (p.kind === 'play' && p.player === hoard && action.type === 'play') {
      const card = s.players[hoard].hand.find((c) => c.id === action.cardId)!;
      if (evaluateWin([...s.players[hoard].table, card], s.rules).won) {
        hoardWinPlays++;
        watching = true;
      }
    }
    s = applyAction(s, p.player, action);
    if (watching) {
      for (const l of s.log.slice(seen)) {
        if (l.kind !== 'counter' || !l.text.includes('to counter')) continue;
        if (l.player === hoard) counterCountered++;
        else countered++;
      }
      if (!s.stack) watching = false;
    }
  }
  return { s, hoard, hoardWinPlays, countered, counterCountered };
}

it('cancel hoarding vs normal AI', () => {
  const N = 2000;
  console.log('rule | Cancels kept | hoarder win % | winning plays countered | ...then countered back | avg turns');
  for (const ccc of [false, true]) {
    for (const keep of [0, 2, 4]) {
      let w = 0, dec = 0, plays = 0, c1 = 0, c2 = 0, turns = 0;
      for (let seed = 1; seed <= N; seed++) {
        const r = game(seed, { counterCanBeCountered: ccc }, keep);
        turns += r.s.turn;
        if (r.s.winner !== 'draw') dec++;
        if (r.s.winner === r.hoard) w++;
        plays += r.hoardWinPlays; c1 += r.countered; c2 += r.counterCountered;
      }
      console.log([ccc ? 'counter-counter ON ' : 'counter-counter OFF', keep, (w / dec * 100).toFixed(1) + '%',
        (c1 / plays * 100).toFixed(0) + '%', (c1 ? c2 / c1 * 100 : 0).toFixed(0) + '%', (turns / N).toFixed(1)].join(' | '));
    }
  }
}, 900000);
