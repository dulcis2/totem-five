/**
 * Heuristic AI.
 *
 * Decides only from a PlayerView (no access to hidden zones). The core idea is a
 * "heat" score for a table: how close it is to either winning condition. Every
 * decision compares how a move changes my heat versus my opponent's heat.
 *
 * Priorities (PRD 7.1) emerge from the weights:
 *   1. Winning moves score 10000.
 *   2. Opponent threats (heat near a win) make Shatter/Discard/Cancel/counters valuable.
 *   3-7. Card effects are valued by their concrete impact on the tables.
 */
import { CARD_TYPES } from '../engine/cards';
import type { Rules } from '../engine/rules';
import type { Action, Card, CardType, EffectChoice } from '../engine/types';
import type { PlayerView } from '../engine/view';
import { winNeeds } from '../engine/win';

// Heat by number of cards still needed for a win path (index = need).
const HEAT = [100, 20, 9, 4, 1.5, 0.5, 0];
const DEFENSE = 1.15;
const COUNTER_THRESHOLD = 7;

const types = (cards: Card[]) => cards.map((c) => c.type);
const heatFor = (n: number) => HEAT[Math.min(n, HEAT.length - 1)];

export function heat(t: CardType[], rules: Rules): number {
  const n = winNeeds(t, rules);
  const a = heatFor(n.colors);
  const b = heatFor(n.copies);
  return Math.max(a, b) + 0.25 * Math.min(a, b);
}

export function minNeed(t: CardType[], rules: Rules): number {
  const n = winNeeds(t, rules);
  return Math.min(n.colors, n.copies);
}

const wins = (t: CardType[], add: CardType, rules: Rules) => minNeed([...t, add], rules) === 0;
const gain = (t: CardType[], add: CardType, rules: Rules) => heat([...t, add], rules) - heat(t, rules);

function without(t: CardType[], remove: CardType): CardType[] {
  const i = t.indexOf(remove);
  return i < 0 ? t : [...t.slice(0, i), ...t.slice(i + 1)];
}

/** How valuable holding a counter-capable pair of Cancels is, given the opponent's threat. */
function pairValue(v: PlayerView): number {
  const need = minNeed(types(v.oppTable), v.rules);
  return need <= 1 ? 6 : need === 2 ? 3 : 1;
}

/** Card value of a type to the owner of table `t` (used for draws, Return, Discard targets). */
function cardValue(t: CardType[], type: CardType, rules: Rules): number {
  return gain(t, type, rules) + (wins(t, type, rules) ? 30 : 0);
}

/** Cards that could be in the opponent's hand or the deck, by type. */
function unseenCounts(v: PlayerView): Record<CardType, number> {
  const out = Object.fromEntries(CARD_TYPES.map((t) => [t, v.rules.copiesPerType])) as Record<CardType, number>;
  const seen = [...v.myHand, ...v.myTable, ...v.myDiscard, ...v.oppTable, ...v.oppDiscard];
  if (v.stack) seen.push(v.stack.card);
  for (const c of seen) out[c.type] = Math.max(0, out[c.type] - 1);
  return out;
}

/** Expected value of drawing one unseen card for the owner of table `t` (Yellow "Draw 1" variant). */
function drawValue(v: PlayerView, t: CardType[]): number {
  if (v.deckCount === 0) return 0;
  const unseen = unseenCounts(v);
  const total = Object.values(unseen).reduce((a, b) => a + b, 0) || 1;
  // A card in hand is worth a fraction of a card on the table (it still has to be played).
  return CARD_TYPES.reduce((acc, ty) => acc + (unseen[ty] / total) * cardValue(t, ty, v.rules), 0) * 0.6 + 0.5;
}

/** Estimated value of activating the effect of `type` for me, given the current view. */
function effectValue(v: PlayerView, type: CardType, myT: CardType[], exclude: string[], depth = 0): number {
  const r = v.rules;
  const oppT = types(v.oppTable);
  switch (type) {
    case 'shatter': {
      if (oppT.length === 0) return 0;
      const base = heat(oppT, r);
      return Math.max(...[...new Set(oppT)].map((t) => base - heat(without(oppT, t), r))) * DEFENSE;
    }
    case 'discard': {
      const h = v.oppHandCount;
      if (h === 0) return 0;
      const unseen = unseenCounts(v);
      const total = Object.values(unseen).reduce((a, b) => a + b, 0) || 1;
      let best = 0;
      for (const t of CARD_TYPES) {
        const f = unseen[t] / total;
        const pAny = 1 - Math.pow(1 - f, h);
        best = Math.max(best, pAny * cardValue(oppT, t, r) * DEFENSE);
      }
      return best + 0.6;
    }
    case 'return': {
      if (v.myDiscard.length === 0) return 0;
      const cancelsInHand = v.myHand.filter((c) => c.type === 'cancel').length;
      return Math.max(
        ...v.myDiscard.map(
          (c) =>
            cardValue(myT, c.type, r) * 0.7 +
            (c.type === 'cancel' && cancelsInHand === r.counterCost - 1 ? 1.5 : 0),
        ),
      ) + 0.3;
    }
    case 'repeat': {
      if (r.yellowEffect === 'draw1') return drawValue(v, myT);
      if (depth >= 2) return 0;
      const targets = v.myTable.filter(
        (c) => !exclude.includes(c.id) && (c.type !== 'repeat' || r.repeatCanTargetRepeat),
      );
      if (targets.length === 0) return 0;
      return Math.max(...targets.map((c) => effectValue(v, c.type, myT, [...exclude, c.id], depth + 1)));
    }
    case 'cancel': {
      if (v.deckCount === 0) return 0;
      const need = minNeed(oppT, r);
      return 0.8 + (need <= 1 ? 3 : need === 2 ? 1 : 0);
    }
  }
}

/** Score for playing a card of `type` from my hand this turn. */
function playScore(v: PlayerView, card: Card): number {
  const r = v.rules;
  const myT = types(v.myTable);
  if (wins(myT, card.type, r)) return 10000;
  const afterT = r.playedCardEntersTable === 'beforeEffect' ? [...myT, card.type] : myT;
  let score = gain(myT, card.type, r);
  score += effectValue(v, card.type, afterT, [card.id]);
  // Keeping a counter-capable pair of Cancels has defensive value.
  if (card.type === 'cancel') {
    const cancels = v.myHand.filter((c) => c.type === 'cancel').length;
    if (cancels === r.counterCost) score -= pairValue(v);
  }
  // Don't hand the opponent an easy Shatter target that is also our only path card? Light penalty
  // for playing cards that leave our hand empty of options is not modelled; tiny jitter for variety.
  return score + Math.random() * 0.25;
}

function choosePlay(v: PlayerView): Action {
  const legal = v.myHand.filter((c) => v.myPlayable.includes(c.id));
  const pool = legal.length ? legal : v.myHand;
  let best = pool[0];
  let bestScore = -Infinity;
  for (const c of pool) {
    const sc = playScore(v, c);
    if (sc > bestScore) {
      bestScore = sc;
      best = c;
    }
  }
  return { type: 'play', cardId: best.id };
}

/** Harm the opponent's play of `type` would do to me. */
function threatOf(v: PlayerView, type: CardType, depth = 0): number {
  const r = v.rules;
  const oppT = types(v.oppTable);
  const myT = types(v.myTable);
  switch (type) {
    case 'shatter': {
      if (myT.length === 0) return 0;
      const base = heat(myT, r);
      return Math.max(...[...new Set(myT)].map((t) => base - heat(without(myT, t), r)));
    }
    case 'discard': {
      if (v.myHand.length === 0) return 0;
      const cancels = v.myHand.filter((c) => c.type === 'cancel').length;
      // After a counter we would hold fewer cards; estimate with our best non-Cancel card.
      return Math.max(0, ...v.myHand.filter((c) => c.type !== 'cancel').map((c) => cardValue(myT, c.type, r))) +
        (cancels >= r.counterCost * 2 ? pairValue(v) * 0.5 : 0);
    }
    case 'return':
      return v.oppDiscard.length ? Math.max(...v.oppDiscard.map((c) => cardValue(oppT, c.type, r) * 0.7)) : 0;
    case 'repeat': {
      if (r.yellowEffect === 'draw1') return v.deckCount ? drawValue(v, types(v.oppTable)) : 0;
      if (depth >= 2) return 0;
      const targets = v.oppTable.filter((c) => c.type !== 'repeat' || r.repeatCanTargetRepeat);
      return targets.length ? Math.max(...targets.map((c) => threatOf(v, c.type, depth + 1))) : 0;
    }
    case 'cancel': {
      const need = minNeed(myT, r);
      return v.deckCount ? 0.8 + (need <= 1 ? 2 : 0) : 0;
    }
  }
}

function decideCounter(v: PlayerView): Action {
  const st = v.stack;
  if (!st) return { type: 'counter', use: false };
  const r = v.rules;
  if (st.owner !== v.me) {
    const oppT = types(v.oppTable);
    const entersFirst = r.playedCardEntersTable === 'beforeEffect';
    if (wins(oppT, st.card.type, r)) return { type: 'counter', use: true };
    const harm = (entersFirst ? gain(oppT, st.card.type, r) * DEFENSE : 0) + threatOf(v, st.card.type);
    const cancels = v.myHand.filter((c) => c.type === 'cancel').length;
    const cost = COUNTER_THRESHOLD - (cancels >= r.counterCost * 2 ? 2 : 0);
    return { type: 'counter', use: harm >= cost };
  }
  // Counter-counter on my own play (only when the rule allows it).
  const myT = types(v.myTable);
  const value = wins(myT, st.card.type, r) ? 10000 : playScore(v, st.card);
  return { type: 'counter', use: value >= COUNTER_THRESHOLD };
}

function chooseSelect(v: PlayerView, choice: Extract<EffectChoice, { type: 'selectCard' }>, exclude: string[]): Action {
  const r = v.rules;
  const myT = types(v.myTable);
  const oppT = types(v.oppTable);
  const score = (c: Card): number => {
    switch (choice.zone) {
      case 'opponentTable':
        return heat(oppT, r) - heat(without(oppT, c.type), r);
      case 'opponentHand': {
        const oppCancels = choice.cards.filter((x) => x.type === 'cancel').length;
        return (
          cardValue(oppT, c.type, r) * DEFENSE +
          (c.type === 'cancel' && oppCancels === r.counterCost ? 4 : 0)
        );
      }
      case 'ownDiscard': {
        const cancels = v.myHand.filter((x) => x.type === 'cancel').length;
        return cardValue(myT, c.type, r) + (c.type === 'cancel' && cancels === r.counterCost - 1 ? 2 : 0);
      }
      case 'ownTable':
        return effectValue(v, c.type, myT, [...exclude, c.id], 1);
    }
  };
  let best = choice.cards[0];
  let bestScore = -Infinity;
  for (const c of choice.cards) {
    const sc = score(c) + Math.random() * 0.01;
    if (sc > bestScore) {
      bestScore = sc;
      best = c;
    }
  }
  return { type: 'select', cardId: best.id };
}

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  return arr.flatMap((x, i) => permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p]));
}

function chooseArrange(v: PlayerView, choice: Extract<EffectChoice, { type: 'arrangeDeck' }>): Action {
  const r = v.rules;
  const myT = types(v.myTable);
  const oppT = types(v.oppTable);
  const weights = [1, 0.8, 0.6, 0.4, 0.3];
  const orders = choice.allowReorder ? permutations(choice.cards) : [choice.cards];
  let best = { top: choice.cards.map((c) => c.id), bottom: [] as string[] };
  let bestScore = -Infinity;
  for (const order of orders) {
    const splits = choice.allowBottom ? order.map((_, i) => i).concat(order.length) : [order.length];
    for (const k of splits) {
      const top = order.slice(0, k);
      // After my turn the opponent draws first, then me, alternating.
      const sc = top.reduce((acc, c, i) => {
        const w = weights[i] ?? 0.2;
        return acc + (i % 2 === 1 ? w * cardValue(myT, c.type, r) : -w * cardValue(oppT, c.type, r) * DEFENSE);
      }, 0);
      if (sc > bestScore + 1e-9) {
        bestScore = sc;
        best = { top: top.map((c) => c.id), bottom: order.slice(k).map((c) => c.id) };
      }
    }
  }
  return { type: 'arrange', ...best };
}

/** Main entry point: pick an action for the AI's pending decision. */
export function decide(v: PlayerView): Action {
  const p = v.pending;
  if (!p || p.kind === 'waiting') throw new Error('AI has no decision to make');
  switch (p.kind) {
    case 'play':
      return choosePlay(v);
    case 'counter':
      return decideCounter(v);
    case 'effect':
      return p.choice.type === 'selectCard' ? chooseSelect(v, p.choice, p.ctx.chain) : chooseArrange(v, p.choice);
  }
}
