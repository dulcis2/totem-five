/**
 * Game state machine.
 *
 * The state is a plain serialisable object. `applyAction` never mutates its input:
 * it clones, applies, and returns the new state (or throws IllegalActionError, in
 * which case the caller keeps the old state).
 *
 * Flow of a turn:
 *   startTurn -> draw -> pending 'play'
 *   play      -> card goes onto the stack -> counter window(s) -> finishPlay
 *   finishPlay-> (cancelled: card to discard, end turn)
 *              | card enters table, win check, begin effect
 *   effect    -> pending 'effect' choices (possibly nested via Repeat) -> completeEffect
 *   completeEffect -> win check -> endTurn -> startTurn(other player)
 */
import { CARD_DEFS, CARD_TYPES } from './cards';
import { DEFAULT_RULES, type Rules } from './rules';
import {
  IllegalActionError,
  allCards,
  countType,
  log,
  moveCard,
  other,
  random,
  shuffle,
  subj,
  verb,
} from './state';
import type { Action, Card, EffectContext, GameState, PlayerId } from './types';
import { evaluateWin } from './win';

export { IllegalActionError, other } from './state';

export interface NewGameOptions {
  rules?: Partial<Rules>;
  seed?: number;
  firstPlayer?: PlayerId;
}

export function createGame(opts: NewGameOptions = {}): GameState {
  const rules: Rules = { ...DEFAULT_RULES, ...opts.rules };
  const seed = (opts.seed ?? Math.floor(Math.random() * 2 ** 32)) >>> 0;
  const s: GameState = {
    rules,
    seed,
    rng: seed,
    deck: [],
    players: {
      human: { hand: [], table: [], discard: [] },
      ai: { hand: [], table: [], discard: [] },
    },
    firstPlayer: 'human',
    current: 'human',
    turn: 0,
    stack: null,
    lastPlayed: null,
    pending: null,
    winner: null,
    winReason: null,
    log: [],
    logSeq: 0,
  };

  for (const type of CARD_TYPES) {
    for (let i = 1; i <= rules.copiesPerType; i++) s.deck.push({ id: `${type}-${i}`, type });
  }
  shuffle(s, s.deck);

  const first: PlayerId =
    opts.firstPlayer ?? (rules.firstPlayer === 'random' ? (random(s) < 0.5 ? 'human' : 'ai') : rules.firstPlayer);
  s.firstPlayer = first;
  s.current = first;
  s.players[first].hand.push(...s.deck.splice(0, rules.startingHandFirst));
  s.players[other(first)].hand.push(...s.deck.splice(0, rules.startingHandSecond));
  log(s, 'info', `New game. ${first === 'human' ? 'You go' : 'AI goes'} first.`);

  startTurn(s);
  return s;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Can `player` legally play this card from hand right now (ignoring whose turn it is)? */
export function canPlayCard(s: GameState, player: PlayerId, card: Card): boolean {
  if (s.rules.allowPlayWithoutTarget) return true;
  const ctx = { player, chain: [card.id], depth: 0 };
  // With 'beforeEffect', a Repeat played now would itself be on the table but is excluded by `chain`.
  return CARD_DEFS[card.type].hasTarget(s, ctx);
}

export function playableCards(s: GameState, player: PlayerId): Card[] {
  return s.players[player].hand.filter((c) => canPlayCard(s, player, c));
}

/**
 * Enumerate legal actions for the player who must decide. For a deck arrangement,
 * only the "keep order" option is returned (the full space is large but trivially legal).
 */
export function legalActions(s: GameState, player: PlayerId): Action[] {
  const p = s.pending;
  if (s.winner || !p || p.player !== player) return [];
  switch (p.kind) {
    case 'play':
      return playableCards(s, player).map((c) => ({ type: 'play', cardId: c.id }));
    case 'counter': {
      const acts: Action[] = [{ type: 'counter', use: false }];
      if (countType(s.players[player].hand, 'cancel') >= s.rules.counterCost) acts.unshift({ type: 'counter', use: true });
      return acts;
    }
    case 'effect':
      if (p.choice.type === 'selectCard') return p.choice.cards.map((c) => ({ type: 'select', cardId: c.id }));
      return [{ type: 'arrange', top: p.choice.cards.map((c) => c.id), bottom: [] }];
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function applyAction(state: GameState, player: PlayerId, action: Action): GameState {
  if (state.winner) throw new IllegalActionError('The game is over');
  const pending = state.pending;
  if (!pending || pending.player !== player) throw new IllegalActionError('It is not your decision');

  const s: GameState = structuredClone(state);
  const p = s.pending!;

  switch (action.type) {
    case 'play': {
      if (p.kind !== 'play') throw new IllegalActionError('You cannot play a card now');
      const card = s.players[player].hand.find((c) => c.id === action.cardId);
      if (!card) throw new IllegalActionError('That card is not in your hand');
      if (!canPlayCard(s, player, card)) throw new IllegalActionError(`${CARD_DEFS[card.type].name} has no valid target`);
      s.players[player].hand = s.players[player].hand.filter((c) => c.id !== card.id);
      s.stack = { card, owner: player, counters: 0 };
      s.lastPlayed = { player, card, turn: s.turn };
      s.pending = null;
      log(s, 'play', `${subj(player)} ${verb(player, 'play')} ${CARD_DEFS[card.type].name}.`, player);
      openCounterWindow(s);
      break;
    }

    case 'counter': {
      if (p.kind !== 'counter' || !s.stack) throw new IllegalActionError('There is nothing to counter');
      s.pending = null;
      if (action.use) {
        const cancels = s.players[player].hand.filter((c) => c.type === 'cancel').slice(0, s.rules.counterCost);
        if (cancels.length < s.rules.counterCost)
          throw new IllegalActionError(`You need ${s.rules.counterCost} Cancel cards to counter`);
        for (const c of cancels) moveCard(s, player, 'hand', player, 'discard', c.id);
        s.stack.counters += 1;
        const targetName =
          s.stack.counters === 1 ? CARD_DEFS[s.stack.card.type].name : 'the counter';
        log(
          s,
          'counter',
          `${subj(player)} ${verb(player, 'discard')} ${s.rules.counterCost} Cancel cards to counter ${targetName}!`,
          player,
        );
        openCounterWindow(s);
      } else {
        finishPlay(s);
      }
      break;
    }

    case 'select':
    case 'arrange': {
      if (p.kind !== 'effect') throw new IllegalActionError('No effect is waiting for a choice');
      if (action.type === 'select' && p.choice.type !== 'selectCard') throw new IllegalActionError('Expected a deck arrangement');
      if (action.type === 'arrange' && p.choice.type !== 'arrangeDeck') throw new IllegalActionError('Expected a card selection');
      s.pending = null;
      const input = action.type === 'select' ? { cardId: action.cardId } : { top: action.top, bottom: action.bottom };
      const nested = CARD_DEFS[p.effect].resolve(s, p.ctx, input, p.choice);
      if (checkWin(s)) break;
      if (nested) beginEffect(s, nested);
      else completeEffect(s);
      break;
    }

    default:
      throw new IllegalActionError('Unknown action');
  }

  return s;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function openCounterWindow(s: GameState) {
  const st = s.stack!;
  const r = s.rules;
  // Even number of counters so far: the play's opponent may counter. Odd: the owner may counter the counter.
  const reactor = st.counters % 2 === 0 ? other(st.owner) : st.owner;
  const allowed = r.counterEnabled && (st.counters === 0 || r.counterCanBeCountered);
  if (allowed && countType(s.players[reactor].hand, 'cancel') >= r.counterCost) {
    s.pending = { kind: 'counter', player: reactor };
  } else {
    finishPlay(s);
  }
}

function finishPlay(s: GameState) {
  const st = s.stack!;
  const def = CARD_DEFS[st.card.type];
  if (st.counters % 2 === 1) {
    s.players[st.owner].discard.push(st.card);
    s.stack = null;
    log(s, 'counter', `${def.name} is cancelled — no effect, and it goes to ${st.owner === 'human' ? 'your' : "AI's"} discard pile.`, st.owner);
    endTurn(s);
    return;
  }
  if (s.rules.playedCardEntersTable === 'beforeEffect') {
    s.players[st.owner].table.push(st.card);
    s.stack = null;
    if (checkWin(s)) return;
  }
  beginEffect(s, {
    player: st.owner,
    sourceCardId: st.card.id,
    sourceType: st.card.type,
    chain: [st.card.id],
    depth: 0,
  });
}

function beginEffect(s: GameState, ctx: EffectContext) {
  const choice = CARD_DEFS[ctx.sourceType].begin(s, ctx);
  if (choice) s.pending = { kind: 'effect', player: ctx.player, effect: ctx.sourceType, ctx, choice };
  else completeEffect(s);
}

function completeEffect(s: GameState) {
  s.pending = null;
  if (checkWin(s)) return;
  if (s.stack) {
    // 'afterEffect' timing: the played card lands now.
    s.players[s.stack.owner].table.push(s.stack.card);
    s.stack = null;
    if (checkWin(s)) return;
  }
  endTurn(s);
}

/** Checks both players (current player first). Ends the game if someone has won. */
function checkWin(s: GameState): boolean {
  for (const p of [s.current, other(s.current)]) {
    const res = evaluateWin(s.players[p].table, s.rules);
    if (res.won) {
      s.winner = p;
      s.winReason = res.reason;
      s.pending = null;
      log(s, 'win', `${p === 'human' ? 'You win' : 'AI wins'} with ${res.reason}!`, p);
      return true;
    }
  }
  return false;
}

function endGameDraw(s: GameState, why: string) {
  s.winner = 'draw';
  s.winReason = why;
  s.pending = null;
  log(s, 'win', `The game ends in a draw: ${why}.`);
}

function endTurn(s: GameState) {
  s.pending = null;
  if (s.winner) return;
  if (s.turn >= s.rules.maxTurns) {
    endGameDraw(s, `turn limit (${s.rules.maxTurns}) reached`);
    return;
  }
  s.current = other(s.current);
  startTurn(s);
}

function drawCard(s: GameState, p: PlayerId) {
  if (s.deck.length === 0) {
    switch (s.rules.emptyDeck) {
      case 'endInDraw':
        endGameDraw(s, 'the deck ran out');
        return;
      case 'reshuffleDiscards': {
        const pile = [...s.players.human.discard, ...s.players.ai.discard];
        if (pile.length > 0) {
          s.players.human.discard = [];
          s.players.ai.discard = [];
          s.deck = shuffle(s, pile);
          log(s, 'info', `The deck is empty — both discard piles are shuffled into a new deck (${pile.length} cards).`);
        }
        break;
      }
      case 'skip':
        break;
    }
  }
  if (s.deck.length === 0) {
    log(s, 'info', `The deck is empty — ${subj(p)} ${p === 'human' ? 'draw' : 'draws'} nothing.`, p);
    return;
  }
  s.players[p].hand.push(s.deck.shift()!);
}

function startTurn(s: GameState) {
  s.turn += 1;
  const p = s.current;
  log(s, 'turn', `Turn ${s.turn}: ${p === 'human' ? 'your' : "AI's"} turn.`, p);
  drawCard(s, p);
  if (s.winner) return;

  if (playableCards(s, p).length === 0) {
    const handEmpty = s.players[p].hand.length === 0;
    const who = p === 'human' ? 'You have' : 'AI has';
    log(s, 'info', `${who} ${handEmpty ? 'no cards' : 'no playable card'} — the turn passes.`, p);
    const oppStuck = playableCards(s, other(p)).length === 0;
    const canRefill =
      s.rules.emptyDeck === 'reshuffleDiscards' && s.players.human.discard.length + s.players.ai.discard.length > 0;
    if (s.deck.length === 0 && oppStuck && !canRefill) {
      endGameDraw(s, 'no player can make a move');
      return;
    }
    endTurn(s);
    return;
  }
  s.pending = { kind: 'play', player: p };
}

/** Sanity check used by tests: every card exists exactly once. */
export function checkInvariants(s: GameState): string | null {
  const cards = allCards(s);
  const expected = s.rules.copiesPerType * CARD_TYPES.length;
  if (cards.length !== expected) return `Expected ${expected} cards, found ${cards.length}`;
  const ids = new Set(cards.map((c) => c.id));
  if (ids.size !== cards.length) return 'Duplicate card ids found';
  if (!s.winner && !s.pending) return 'Game is running but nothing is pending';
  return null;
}
