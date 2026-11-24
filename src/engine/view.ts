/**
 * Player view: the information one player is allowed to see.
 * The AI decides from this view only, so it never cheats by reading hidden zones
 * (opponent's hand, deck order) except where an effect reveals them to it.
 */
import { playableCards } from './engine';
import type { Rules } from './rules';
import { other } from './state';
import type { Card, GameState, Pending, PlayerId, StackItem } from './types';

export interface PlayerView {
  me: PlayerId;
  rules: Rules;
  myHand: Card[];
  /** Ids of hand cards I may legally play right now. */
  myPlayable: string[];
  myTable: Card[];
  myDiscard: Card[];
  oppTable: Card[];
  oppDiscard: Card[];
  oppHandCount: number;
  deckCount: number;
  current: PlayerId;
  turn: number;
  stack: StackItem | null;
  /** Full pending decision if it is mine, otherwise only who is deciding. */
  pending: Pending | { kind: 'waiting'; player: PlayerId } | null;
  winner: GameState['winner'];
}

export function toView(s: GameState, me: PlayerId): PlayerView {
  const opp = other(me);
  return {
    me,
    rules: s.rules,
    myHand: s.players[me].hand,
    myPlayable: playableCards(s, me).map((c) => c.id),
    myTable: s.players[me].table,
    myDiscard: s.players[me].discard,
    oppTable: s.players[opp].table,
    oppDiscard: s.players[opp].discard,
    oppHandCount: s.players[opp].hand.length,
    deckCount: s.deck.length,
    current: s.current,
    turn: s.turn,
    stack: s.stack,
    pending: s.pending ? (s.pending.player === me ? s.pending : { kind: 'waiting', player: s.pending.player }) : null,
    winner: s.winner,
  };
}
