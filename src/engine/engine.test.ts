import { describe, expect, it } from 'vitest';
import { decide } from '../ai/ai';
import { applyAction, checkInvariants, createGame, IllegalActionError, legalActions } from './engine';
import type { Rules } from './rules';
import type { Card, CardType, GameState, PlayerId } from './types';
import { toView } from './view';
import { evaluateWin } from './win';

/** Build a game, then rearrange zones by pulling specific card types out of the deck. */
function setup(
  spec: Partial<Record<PlayerId, { hand?: CardType[]; table?: CardType[]; discard?: CardType[] }>>,
  opts: { rules?: Partial<Rules>; current?: PlayerId; deckTop?: CardType[] } = {},
): GameState {
  const s = createGame({ seed: 1, firstPlayer: 'human', rules: opts.rules });
  // Put every card back into the deck.
  for (const p of ['human', 'ai'] as const) {
    s.deck.push(...s.players[p].hand, ...s.players[p].table, ...s.players[p].discard);
    s.players[p] = { hand: [], table: [], discard: [] };
  }
  const take = (t: CardType): Card => {
    const i = s.deck.findIndex((c) => c.type === t);
    if (i < 0) throw new Error(`no ${t} left`);
    return s.deck.splice(i, 1)[0];
  };
  for (const p of ['human', 'ai'] as const) {
    const z = spec[p] ?? {};
    s.players[p].hand = (z.hand ?? []).map(take);
    s.players[p].table = (z.table ?? []).map(take);
    s.players[p].discard = (z.discard ?? []).map(take);
  }
  if (opts.deckTop) s.deck.unshift(...opts.deckTop.map(take));
  s.current = opts.current ?? 'human';
  s.pending = { kind: 'play', player: s.current };
  s.stack = null;
  return s;
}

const idOf = (s: GameState, p: PlayerId, zone: 'hand' | 'table' | 'discard', t: CardType) =>
  s.players[p][zone].find((c) => c.type === t)!.id;

describe('setup', () => {
  it('deals 4 to the first player (+1 draw) and 5 to the second', () => {
    const s = createGame({ seed: 42, firstPlayer: 'ai' });
    expect(s.players.ai.hand).toHaveLength(5); // 4 + first draw
    expect(s.players.human.hand).toHaveLength(5);
    expect(s.deck).toHaveLength(40);
    expect(s.pending).toEqual({ kind: 'play', player: 'ai' });
    expect(checkInvariants(s)).toBeNull();
  });

  it('builds 10 of each card type', () => {
    const s = createGame({ seed: 7 });
    const all = [...s.deck, ...s.players.ai.hand, ...s.players.human.hand];
    for (const t of ['repeat', 'shatter', 'discard', 'return', 'cancel']) {
      expect(all.filter((c) => c.type === t)).toHaveLength(10);
    }
  });
});

describe('win conditions', () => {
  const rules = createGame({ seed: 1 }).rules;
  const cards = (ts: CardType[]) => ts.map((type, i) => ({ id: `${type}-${i}`, type }));
  it('Five Colors', () => {
    expect(evaluateWin(cards(['repeat', 'shatter', 'discard', 'return', 'cancel']), rules).reason).toBe('Five Colors');
  });
  it('Five Copies', () => {
    expect(evaluateWin(cards(['shatter', 'shatter', 'shatter', 'shatter', 'shatter']), rules).reason).toBe('Five Copies');
  });
  it('not yet', () => {
    expect(evaluateWin(cards(['shatter', 'shatter', 'shatter', 'shatter', 'cancel']), rules).won).toBe(false);
  });
  it('playing the fifth color wins immediately and blocks further actions', () => {
    const s = setup({ human: { hand: ['cancel'], table: ['repeat', 'shatter', 'discard', 'return'] }, ai: { hand: ['shatter'] } });
    const n = applyAction(s, 'human', { type: 'play', cardId: idOf(s, 'human', 'hand', 'cancel') });
    expect(n.winner).toBe('human');
    expect(n.winReason).toBe('Five Colors');
    expect(() => applyAction(n, 'ai', { type: 'play', cardId: 'x' })).toThrow(IllegalActionError);
  });
});

describe('card effects', () => {
  it('Shatter destroys an opponent table card into its owner discard', () => {
    const s = setup({ human: { hand: ['shatter'] }, ai: { table: ['return'], hand: ['repeat'] } });
    let n = applyAction(s, 'human', { type: 'play', cardId: idOf(s, 'human', 'hand', 'shatter') });
    expect(n.pending?.kind).toBe('effect');
    n = applyAction(n, 'human', { type: 'select', cardId: idOf(s, 'ai', 'table', 'return') });
    expect(n.players.ai.table).toHaveLength(0);
    expect(n.players.ai.discard.map((c) => c.type)).toEqual(['return']);
    expect(n.players.human.table.map((c) => c.type)).toEqual(['shatter']);
    expect(n.current).toBe('ai');
    expect(checkInvariants(n)).toBeNull();
  });

  it('Discard reveals the opponent hand and discards the chosen card', () => {
    const s = setup({ human: { hand: ['discard'] }, ai: { hand: ['cancel', 'repeat'] } });
    let n = applyAction(s, 'human', { type: 'play', cardId: idOf(s, 'human', 'hand', 'discard') });
    expect(n.pending?.kind === 'effect' && n.pending.choice.type === 'selectCard' && n.pending.choice.cards).toHaveLength(2);
    n = applyAction(n, 'human', { type: 'select', cardId: idOf(s, 'ai', 'hand', 'repeat') });
    expect(n.players.ai.discard.map((c) => c.type)).toEqual(['repeat']);
  });

  it('Return takes a card from own discard into hand', () => {
    const s = setup({ human: { hand: ['return'], discard: ['shatter'] }, ai: { hand: ['repeat'] } });
    let n = applyAction(s, 'human', { type: 'play', cardId: idOf(s, 'human', 'hand', 'return') });
    n = applyAction(n, 'human', { type: 'select', cardId: idOf(s, 'human', 'discard', 'shatter') });
    expect(n.players.human.hand.map((c) => c.type)).toEqual(['shatter']);
    expect(n.players.human.discard).toHaveLength(0);
  });

  it('Repeat re-activates another table card (not itself, not Repeat by default)', () => {
    const s = setup({ human: { hand: ['repeat'], table: ['shatter', 'repeat'] }, ai: { table: ['cancel', 'return'], hand: ['repeat'] } });
    let n = applyAction(s, 'human', { type: 'play', cardId: idOf(s, 'human', 'hand', 'repeat') });
    const p = n.pending!;
    expect(p.kind === 'effect' && p.choice.type === 'selectCard' && p.choice.cards.map((c) => c.type)).toEqual(['shatter']);
    n = applyAction(n, 'human', { type: 'select', cardId: idOf(s, 'human', 'table', 'shatter') });
    expect(n.pending?.kind === 'effect' && n.pending.effect).toBe('shatter');
    n = applyAction(n, 'human', { type: 'select', cardId: idOf(s, 'ai', 'table', 'cancel') });
    expect(n.players.ai.table.map((c) => c.type)).toEqual(['return']);
    expect(n.current).toBe('ai');
  });

  it('Repeat chain may hit another Repeat when enabled, without reusing a card', () => {
    const s = setup(
      { human: { hand: ['repeat'], table: ['repeat', 'return'], discard: ['cancel'] }, ai: { hand: ['shatter'] } },
      { rules: { repeatCanTargetRepeat: true } },
    );
    const handRepeat = idOf(s, 'human', 'hand', 'repeat');
    const tableRepeat = idOf(s, 'human', 'table', 'repeat');
    let n = applyAction(s, 'human', { type: 'play', cardId: handRepeat });
    n = applyAction(n, 'human', { type: 'select', cardId: tableRepeat });
    const p = n.pending!;
    // Second hop can only pick Return (both Repeats already used in the chain).
    expect(p.kind === 'effect' && p.choice.type === 'selectCard' && p.choice.cards.map((c) => c.type)).toEqual(['return']);
  });

  describe('Yellow variant: Draw 1', () => {
    const rules = { yellowEffect: 'draw1' as const };

    it('draws the top card of the deck and stays on the table', () => {
      const s = setup({ human: { hand: ['repeat'], table: ['shatter'] }, ai: { table: ['cancel'], hand: ['return'] } }, { rules, deckTop: ['discard'] });
      const topId = s.deck[0].id;
      const n = applyAction(s, 'human', { type: 'play', cardId: idOf(s, 'human', 'hand', 'repeat') });
      expect(n.players.human.table.map((c) => c.type)).toEqual(['shatter', 'repeat']);
      expect(n.players.human.hand.map((c) => c.id)).toEqual([topId]);
      // No selection: Shatter on the table is NOT re-activated.
      expect(n.players.ai.table.map((c) => c.type)).toEqual(['cancel']);
      expect(n.current).toBe('ai');
      expect(checkInvariants(n)).toBeNull();
    });

    it('fizzles on an empty deck', () => {
      const s = setup({ human: { hand: ['repeat'] }, ai: { hand: ['shatter'] } }, { rules });
      s.players.ai.discard.push(...s.deck.splice(0));
      const n = applyAction(s, 'human', { type: 'play', cardId: idOf(s, 'human', 'hand', 'repeat') });
      expect(n.players.human.hand).toHaveLength(0);
      expect(n.players.human.table.map((c) => c.type)).toEqual(['repeat']);
      expect(n.log.some((l) => l.text.includes('fizzles'))).toBe(true);
    });

    it('reshuffles discards first when that empty-deck rule is on', () => {
      const s = setup({ human: { hand: ['repeat'] }, ai: { hand: ['shatter'] } }, { rules: { ...rules, emptyDeck: 'reshuffleDiscards' } });
      s.players.ai.discard.push(...s.deck.splice(0));
      const n = applyAction(s, 'human', { type: 'play', cardId: idOf(s, 'human', 'hand', 'repeat') });
      expect(n.players.human.hand).toHaveLength(1);
      expect(checkInvariants(n)).toBeNull();
    });

    it('is unplayable on an empty deck when targets are required', () => {
      const s = setup({ human: { hand: ['repeat', 'shatter'] }, ai: { table: ['cancel'] } }, { rules: { ...rules, allowPlayWithoutTarget: false } });
      expect(legalActions(s, 'human')).toHaveLength(2);
      s.players.ai.discard.push(...s.deck.splice(0));
      expect(legalActions(s, 'human').map((a) => (a.type === 'play' ? a.cardId : ''))).toEqual([idOf(s, 'human', 'hand', 'shatter')]);
    });
  });

  it('Repeat with nothing to repeat fizzles but stays on the table', () => {
    const s = setup({ human: { hand: ['repeat'] }, ai: { hand: ['shatter'] } });
    const n = applyAction(s, 'human', { type: 'play', cardId: idOf(s, 'human', 'hand', 'repeat') });
    expect(n.players.human.table.map((c) => c.type)).toEqual(['repeat']);
    expect(n.current).toBe('ai');
  });

  it('Cards without a target are unplayable when the rule says so', () => {
    const s = setup({ human: { hand: ['shatter', 'cancel'] }, ai: { hand: ['shatter'] } }, { rules: { allowPlayWithoutTarget: false } });
    expect(legalActions(s, 'human')).toEqual([{ type: 'play', cardId: idOf(s, 'human', 'hand', 'cancel') }]);
    expect(() => applyAction(s, 'human', { type: 'play', cardId: idOf(s, 'human', 'hand', 'shatter') })).toThrow(IllegalActionError);
  });

  it('Cancel lets the player reorder the top 3 cards', () => {
    const s = setup({ human: { hand: ['cancel'] }, ai: { hand: ['shatter'] } }, { deckTop: ['repeat', 'shatter', 'discard'] });
    let n = applyAction(s, 'human', { type: 'play', cardId: idOf(s, 'human', 'hand', 'cancel') });
    const p = n.pending!;
    if (p.kind !== 'effect' || p.choice.type !== 'arrangeDeck') throw new Error('expected arrange');
    const [a, b, c] = p.choice.cards.map((x) => x.id);
    expect(() => applyAction(n, 'human', { type: 'arrange', top: [a, b], bottom: [c] })).toThrow(IllegalActionError);
    expect(() => applyAction(n, 'human', { type: 'arrange', top: [a, a, b], bottom: [] })).toThrow(IllegalActionError);
    n = applyAction(n, 'human', { type: 'arrange', top: [c, b, a], bottom: [] });
    // AI drew the new top card (discard) at the start of its turn.
    expect(n.players.ai.hand.map((x) => x.type)).toEqual(['shatter', 'discard']);
    expect(n.deck.slice(0, 2).map((x) => x.type)).toEqual(['shatter', 'repeat']);
  });

  it('Cancel may send cards to the bottom when enabled', () => {
    const s = setup({ human: { hand: ['cancel'] }, ai: { hand: ['shatter'] } }, { deckTop: ['repeat', 'shatter', 'discard'], rules: { cancelAllowBottom: true } });
    let n = applyAction(s, 'human', { type: 'play', cardId: idOf(s, 'human', 'hand', 'cancel') });
    const p = n.pending!;
    if (p.kind !== 'effect' || p.choice.type !== 'arrangeDeck') throw new Error('expected arrange');
    const [a, b, c] = p.choice.cards.map((x) => x.id);
    n = applyAction(n, 'human', { type: 'arrange', top: [b], bottom: [a, c] });
    expect(n.players.ai.hand.map((x) => x.id)).toContain(b);
    expect(n.deck.slice(-2).map((x) => x.id)).toEqual([a, c]);
    expect(checkInvariants(n)).toBeNull();
  });
});

describe('Cancel counter reaction', () => {
  it('opponent with 2 Cancels gets a counter window; countering sends the card to discard with no effect', () => {
    const s = setup({ human: { hand: ['shatter'] }, ai: { hand: ['cancel', 'cancel', 'repeat'], table: ['return'] } });
    let n = applyAction(s, 'human', { type: 'play', cardId: idOf(s, 'human', 'hand', 'shatter') });
    expect(n.pending).toEqual({ kind: 'counter', player: 'ai' });
    expect(n.stack?.card.type).toBe('shatter');
    n = applyAction(n, 'ai', { type: 'counter', use: true });
    expect(n.players.human.table).toHaveLength(0);
    expect(n.players.human.discard.map((c) => c.type)).toEqual(['shatter']);
    expect(n.players.ai.discard.map((c) => c.type)).toEqual(['cancel', 'cancel']);
    expect(n.players.ai.table.map((c) => c.type)).toEqual(['return']);
    expect(n.current).toBe('ai');
    expect(checkInvariants(n)).toBeNull();
  });

  it('declining lets the card resolve', () => {
    const s = setup({ human: { hand: ['shatter'] }, ai: { hand: ['cancel', 'cancel'], table: ['return'] } });
    let n = applyAction(s, 'human', { type: 'play', cardId: idOf(s, 'human', 'hand', 'shatter') });
    n = applyAction(n, 'ai', { type: 'counter', use: false });
    expect(n.pending?.kind).toBe('effect');
  });

  it('no window when the opponent has fewer than 2 Cancels', () => {
    const s = setup({ human: { hand: ['shatter'] }, ai: { hand: ['cancel'], table: ['return'] } });
    const n = applyAction(s, 'human', { type: 'play', cardId: idOf(s, 'human', 'hand', 'shatter') });
    expect(n.pending?.kind).toBe('effect');
  });

  it('a counter can be countered back when enabled', () => {
    const s = setup(
      { human: { hand: ['shatter', 'cancel', 'cancel'] }, ai: { hand: ['cancel', 'cancel'], table: ['return'] } },
      { rules: { counterCanBeCountered: true } },
    );
    let n = applyAction(s, 'human', { type: 'play', cardId: idOf(s, 'human', 'hand', 'shatter') });
    n = applyAction(n, 'ai', { type: 'counter', use: true });
    expect(n.pending).toEqual({ kind: 'counter', player: 'human' });
    n = applyAction(n, 'human', { type: 'counter', use: true });
    expect(n.pending?.kind).toBe('effect'); // Shatter resolves after all
    expect(n.players.human.table.map((c) => c.type)).toEqual(['shatter']);
  });

  it('a counter cannot be countered by default', () => {
    const s = setup({ human: { hand: ['shatter', 'cancel', 'cancel'] }, ai: { hand: ['cancel', 'cancel'], table: ['return'] } });
    let n = applyAction(s, 'human', { type: 'play', cardId: idOf(s, 'human', 'hand', 'shatter') });
    n = applyAction(n, 'ai', { type: 'counter', use: true });
    expect(n.current).toBe('ai');
    expect(n.players.human.discard.map((c) => c.type)).toEqual(['shatter']);
  });
});

describe('turn guards', () => {
  it('rejects actions from the wrong player', () => {
    const s = setup({ human: { hand: ['shatter'] }, ai: { hand: ['repeat'] } });
    expect(() => applyAction(s, 'ai', { type: 'play', cardId: idOf(s, 'ai', 'hand', 'repeat') })).toThrow(IllegalActionError);
  });
  it('does not mutate the input state', () => {
    const s = setup({ human: { hand: ['shatter'] }, ai: { hand: ['repeat'] } });
    const before = JSON.stringify(s);
    applyAction(s, 'human', { type: 'play', cardId: idOf(s, 'human', 'hand', 'shatter') });
    expect(JSON.stringify(s)).toBe(before);
  });
});

function playOut(seed: number, rules?: Partial<Rules>, randomHuman = false) {
  let s = createGame({ seed, rules });
  let steps = 0;
  while (!s.winner) {
    const p = s.pending!;
    let action;
    if (randomHuman && p.player === 'human') {
      const acts = legalActions(s, 'human');
      action = acts[Math.floor(Math.random() * acts.length)];
    } else {
      action = decide(toView(s, p.player));
    }
    s = applyAction(s, p.player, action);
    const err = checkInvariants(s);
    if (err) throw new Error(`seed ${seed} step ${steps}: ${err}`);
    if (++steps > 5000) throw new Error(`seed ${seed} did not terminate`);
  }
  return s;
}

describe('full games (AI vs AI)', () => {
  it('always terminate with all 50 cards accounted for', () => {
    const results = { human: 0, ai: 0, draw: 0 };
    for (let seed = 1; seed <= 150; seed++) results[playOut(seed).winner!] += 1;
    expect(results.human + results.ai + results.draw).toBe(150);
  });

  it('terminate under every empty-deck / variant rule', () => {
    const variants: Partial<Rules>[] = [
      { emptyDeck: 'reshuffleDiscards' },
      { emptyDeck: 'endInDraw' },
      { allowPlayWithoutTarget: false },
      { playedCardEntersTable: 'afterEffect' },
      { repeatCanTargetRepeat: true, counterCanBeCountered: true, cancelAllowBottom: true },
      { yellowEffect: 'draw1' },
      { yellowEffect: 'draw1', emptyDeck: 'reshuffleDiscards' },
    ];
    for (const v of variants) for (let seed = 1; seed <= 40; seed++) playOut(seed, v);
  });

  it('heuristic AI beats a random player most of the time', () => {
    let aiWins = 0;
    const N = 200;
    for (let seed = 1; seed <= N; seed++) if (playOut(seed, undefined, true).winner === 'ai') aiWins++;
    expect(aiWins / N).toBeGreaterThan(0.7);
  });
});
