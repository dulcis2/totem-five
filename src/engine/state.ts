import type { Card, CardType, GameState, LogKind, PlayerId, PlayerState } from './types';

export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalActionError';
  }
}

export const other = (p: PlayerId): PlayerId => (p === 'human' ? 'ai' : 'human');

// ---------- RNG (mulberry32, state kept inside GameState so games are reproducible) ----------
export function random(s: GameState): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function shuffle<T>(s: GameState, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- Text helpers for the log ----------
export const subj = (p: PlayerId) => (p === 'human' ? 'You' : 'AI');
export const poss = (p: PlayerId) => (p === 'human' ? 'your' : "AI's");
export const verb = (p: PlayerId, base: string) =>
  p === 'human' ? base : /(s|sh|ch|x)$/.test(base) ? `${base}es` : `${base}s`;

export function log(s: GameState, kind: LogKind, text: string, player: PlayerId | null = null) {
  s.logSeq += 1;
  s.log.push({ id: s.logSeq, turn: s.turn, player, kind, text });
}

// ---------- Zone helpers ----------
export type ZoneName = keyof PlayerState;

export function findIn(zone: Card[], id: string): Card | undefined {
  return zone.find((c) => c.id === id);
}

/** Move one card between zones. Throws if the card is not where expected (protects against lost/duplicated cards). */
export function moveCard(
  s: GameState,
  fromPlayer: PlayerId,
  fromZone: ZoneName,
  toPlayer: PlayerId,
  toZone: ZoneName,
  cardId: string,
): Card {
  const from = s.players[fromPlayer][fromZone];
  const idx = from.findIndex((c) => c.id === cardId);
  if (idx < 0) throw new IllegalActionError(`Card ${cardId} is not in ${fromPlayer}'s ${fromZone}`);
  const [card] = from.splice(idx, 1);
  s.players[toPlayer][toZone].push(card);
  return card;
}

export const countType = (cards: Card[], type: CardType) => cards.filter((c) => c.type === type).length;

/** Every card in the game, wherever it is. Used by invariant checks. */
export function allCards(s: GameState): Card[] {
  const out = [...s.deck];
  for (const p of ['human', 'ai'] as const) {
    const ps = s.players[p];
    out.push(...ps.hand, ...ps.table, ...ps.discard);
  }
  if (s.stack) out.push(s.stack.card);
  return out;
}
