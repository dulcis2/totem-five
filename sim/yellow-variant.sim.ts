import { it } from 'vitest';
import { decide } from '../src/ai/ai';
import { applyAction, createGame, legalActions } from '../src/engine/engine';
import type { Rules } from '../src/engine/rules';
import { toView } from '../src/engine/view';

function play(seed: number, rules: Partial<Rules>, randomHuman = false) {
  let s = createGame({ seed, rules, firstPlayer: seed % 2 ? 'human' : 'ai' });
  let yellowPlays = 0, yellowFizzles = 0, counteredYellow = 0;
  while (!s.winner) {
    const p = s.pending!;
    const a = randomHuman && p.player === 'human'
      ? (() => { const x = legalActions(s, 'human'); return x[Math.floor(Math.random() * x.length)]; })()
      : decide(toView(s, p.player));
    const before = s.log.length;
    s = applyAction(s, p.player, a);
    for (const l of s.log.slice(before)) {
      if (l.kind === 'play' && l.text.includes('Repeat')) yellowPlays++;
      if (l.text.startsWith('Repeat has no target')) yellowFizzles++;
      if (l.kind === 'counter' && l.text.includes('counter Repeat')) counteredYellow++;
    }
  }
  return { s, yellowPlays, yellowFizzles, counteredYellow };
}

it('compare yellow variants', () => {
  const N = 2000;
  const rows: string[] = [];
  for (const [label, rules] of [
    ['Repeat (default)', { yellowEffect: 'repeat' }],
    ['Draw 1', { yellowEffect: 'draw1' }],
    ['Repeat, reshuffle deck', { yellowEffect: 'repeat', emptyDeck: 'reshuffleDiscards' }],
    ['Draw 1, reshuffle deck', { yellowEffect: 'draw1', emptyDeck: 'reshuffleDiscards' }],
  ] as [string, Partial<Rules>][]) {
    let first = 0, draws = 0, turns = 0, yp = 0, yf = 0, yc = 0, colors = 0, copies = 0, yellowOnWin = 0, copiesYellow = 0;
    const tl: number[] = [];
    for (let seed = 1; seed <= N; seed++) {
      const r = play(seed, rules);
      const s = r.s;
      turns += s.turn; tl.push(s.turn);
      yp += r.yellowPlays; yf += r.yellowFizzles; yc += r.counteredYellow;
      if (s.winner === 'draw') { draws++; continue; }
      if (s.winner === s.firstPlayer) first++;
      if (s.winReason === 'Five Colors') colors++; else { copies++; if (s.players[s.winner].table.filter((c) => c.type === 'repeat').length >= 5) copiesYellow++; }
      yellowOnWin += s.players[s.winner].table.filter((c) => c.type === 'repeat').length;
    }
    let aiWins = 0; const M = 500;
    for (let seed = 1; seed <= M; seed++) if (play(seed, rules, true).s.winner === 'ai') aiWins++;
    tl.sort((a, b) => a - b);
    const dec = N - draws;
    rows.push([label, (first / dec * 100).toFixed(1) + '%', (draws / N * 100).toFixed(1) + '%', (turns / N).toFixed(1), tl[N >> 1], tl[Math.floor(N * 0.9)],
      (colors / dec * 100).toFixed(0) + '%', (copiesYellow / dec * 100).toFixed(1) + '%', (yp / N).toFixed(2), (yp ? yf / yp * 100 : 0).toFixed(0) + '%', (yp ? yc / yp * 100 : 0).toFixed(1) + '%', (yellowOnWin / dec).toFixed(2), (aiWins / M * 100).toFixed(0) + '%'].join(' | '));
  }
  console.log('variant | 1st-player win | draws | avg turns | median | p90 | Five Colors wins | Five Yellow wins | yellow plays/game | yellow fizzle | yellow countered | yellow on winner table | AI vs random');
  console.log(rows.join('\n'));
}, 600000);
