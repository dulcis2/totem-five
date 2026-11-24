import type { Rules } from './rules';

export type CardType = 'repeat' | 'shatter' | 'discard' | 'return' | 'cancel';
export type PlayerId = 'human' | 'ai';

export interface Card {
  /** Unique, stable id (e.g. "shatter-3"). Never duplicated across zones. */
  id: string;
  type: CardType;
}

export interface PlayerState {
  hand: Card[];
  table: Card[];
  discard: Card[];
}

/** Which zone a card-selection effect picks from, relative to the choosing player. */
export type SelectZone = 'opponentTable' | 'opponentHand' | 'ownDiscard' | 'ownTable';

/** Context of one effect activation (an original play or a repeated activation). */
export interface EffectContext {
  player: PlayerId;
  /** The card whose effect is being resolved (for Repeat chains: the repeated card). */
  sourceCardId: string;
  sourceType: CardType;
  /** Card ids already activated in this chain (used to stop Repeat recursion). */
  chain: string[];
  /** How many Repeat hops deep we are. 0 = the played card itself. */
  depth: number;
}

export type EffectChoice =
  | {
      type: 'selectCard';
      zone: SelectZone;
      /** Cards that may be chosen (revealed to the chooser only). */
      cards: Card[];
      prompt: string;
    }
  | {
      type: 'arrangeDeck';
      /** Top cards of the deck, index 0 = top. Visible to the chooser only. */
      cards: Card[];
      allowBottom: boolean;
      allowReorder: boolean;
      prompt: string;
    };

/** A card that has been played from hand and is waiting for reactions / resolution. */
export interface StackItem {
  card: Card;
  owner: PlayerId;
  /** Number of Cancel counters applied so far. Odd = the play is cancelled. */
  counters: number;
}

/** The decision the game is currently waiting for. Exactly one at a time. */
export type Pending =
  | { kind: 'play'; player: PlayerId }
  | { kind: 'counter'; player: PlayerId }
  | { kind: 'effect'; player: PlayerId; effect: CardType; ctx: EffectContext; choice: EffectChoice };

export type Action =
  | { type: 'play'; cardId: string }
  | { type: 'counter'; use: boolean }
  | { type: 'select'; cardId: string }
  /** top: ids in order from the top of the deck; bottom: ids in order, first = placed first (ends deepest-but-one). */
  | { type: 'arrange'; top: string[]; bottom: string[] };

export type LogKind = 'info' | 'turn' | 'play' | 'effect' | 'counter' | 'win';

export interface LogEntry {
  id: number;
  turn: number;
  player: PlayerId | null;
  kind: LogKind;
  text: string;
}

export interface GameState {
  rules: Rules;
  seed: number;
  /** Internal RNG state (mulberry32). */
  rng: number;
  /** Shared deck, index 0 = top. Hidden information. */
  deck: Card[];
  players: Record<PlayerId, PlayerState>;
  firstPlayer: PlayerId;
  current: PlayerId;
  /** Turn counter, incremented each time a player's turn starts. */
  turn: number;
  stack: StackItem | null;
  /** Most recent card played from hand (for UI highlighting). */
  lastPlayed: { player: PlayerId; card: Card; turn: number } | null;
  pending: Pending | null;
  winner: PlayerId | 'draw' | null;
  winReason: string | null;
  log: LogEntry[];
  logSeq: number;
}
