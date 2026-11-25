/**
 * Card registry.
 *
 * Each card type is a self-contained definition: presentation data plus its effect
 * as two pure-ish functions operating on a (cloned) GameState:
 *
 *   begin(state, ctx)            -> an EffectChoice the player must make, or null if the
 *                                   effect resolved / fizzled without a choice.
 *   resolve(state, ctx, input)   -> applies the choice. May return a nested EffectContext
 *                                   (used by Repeat) which the engine then begins.
 *
 * To add a new card: add its type to CardType, add a definition here, done.
 */
import type { Rules } from './rules';
import { IllegalActionError, countType, log, moveCard, other, poss, subj, verb } from './state';
import type { Card, CardType, EffectChoice, EffectContext, GameState } from './types';

export type ResolveInput = { cardId: string } | { top: string[]; bottom: string[] };

export interface CardDefinition {
  type: CardType;
  name: string;
  color: string;
  colorName: string;
  /** Text color that reads well on `color`. */
  ink: string;
  glyph: string;
  text: string;
  /** Does the effect currently have anything to act on? (Used for "no target" rules.) */
  hasTarget(s: GameState, ctx: Pick<EffectContext, 'player' | 'chain' | 'depth'>): boolean;
  begin(s: GameState, ctx: EffectContext): EffectChoice | null;
  resolve(s: GameState, ctx: EffectContext, input: ResolveInput, choice: EffectChoice): EffectContext | null;
}

const fizzle = (s: GameState, ctx: EffectContext, why: string) =>
  log(s, 'effect', `${CARD_DEFS[ctx.sourceType].name} has no target (${why}) — the effect fizzles.`, ctx.player);

function expectCardId(input: ResolveInput, choice: EffectChoice): string {
  if (!('cardId' in input) || choice.type !== 'selectCard') throw new IllegalActionError('Expected a card selection');
  if (!choice.cards.some((c) => c.id === input.cardId)) throw new IllegalActionError('That card is not a valid choice');
  return input.cardId;
}

function repeatTargets(s: GameState, ctx: Pick<EffectContext, 'player' | 'chain' | 'depth'>): Card[] {
  const r: Rules = s.rules;
  if (ctx.depth >= r.maxRepeatDepth) return [];
  return s.players[ctx.player].table.filter(
    (c) => !ctx.chain.includes(c.id) && (c.type !== 'repeat' || r.repeatCanTargetRepeat),
  );
}

export const CARD_DEFS: Record<CardType, CardDefinition> = {
  repeat: {
    type: 'repeat',
    name: 'Repeat',
    color: '#e9b824',
    colorName: 'Yellow',
    ink: '#2a2105',
    glyph: '↻',
    text: 'Choose another card on your table and activate its effect again.',
    hasTarget: (s, ctx) => repeatTargets(s, ctx).length > 0,
    begin(s, ctx) {
      const cards = repeatTargets(s, ctx);
      if (cards.length === 0) {
        fizzle(s, ctx, 'no other card on the table to repeat');
        return null;
      }
      return { type: 'selectCard', zone: 'ownTable', cards, prompt: 'Repeat: choose a card on your table to activate again.' };
    },
    resolve(s, ctx, input, choice) {
      const id = expectCardId(input, choice);
      const target = s.players[ctx.player].table.find((c) => c.id === id);
      if (!target) throw new IllegalActionError('Target is no longer on the table');
      log(s, 'effect', `${subj(ctx.player)} ${verb(ctx.player, 'repeat')} ${CARD_DEFS[target.type].name}.`, ctx.player);
      return {
        player: ctx.player,
        sourceCardId: target.id,
        sourceType: target.type,
        chain: [...ctx.chain, target.id],
        depth: ctx.depth + 1,
      };
    },
  },

  shatter: {
    type: 'shatter',
    name: 'Shatter',
    color: '#c8372d',
    colorName: 'Red',
    ink: '#ffffff',
    glyph: '✸',
    text: "Destroy one card on your opponent's table.",
    hasTarget: (s, ctx) => s.players[other(ctx.player)].table.length > 0,
    begin(s, ctx) {
      const cards = s.players[other(ctx.player)].table;
      if (cards.length === 0) {
        fizzle(s, ctx, "opponent's table is empty");
        return null;
      }
      return { type: 'selectCard', zone: 'opponentTable', cards: [...cards], prompt: "Shatter: choose a card on the opponent's table to destroy." };
    },
    resolve(s, ctx, input, choice) {
      const id = expectCardId(input, choice);
      const opp = other(ctx.player);
      const card = moveCard(s, opp, 'table', opp, 'discard', id);
      log(s, 'effect', `${subj(ctx.player)} ${verb(ctx.player, 'shatter')} ${poss(opp)} ${CARD_DEFS[card.type].name}.`, ctx.player);
      return null;
    },
  },

  discard: {
    type: 'discard',
    name: 'Discard',
    color: '#2b2b2b',
    colorName: 'Black',
    ink: '#f3efe6',
    glyph: '✕',
    text: "Look at your opponent's hand and choose one card to discard.",
    hasTarget: (s, ctx) => s.players[other(ctx.player)].hand.length > 0,
    begin(s, ctx) {
      const opp = other(ctx.player);
      const cards = s.players[opp].hand;
      if (cards.length === 0) {
        fizzle(s, ctx, "opponent's hand is empty");
        return null;
      }
      log(s, 'effect', `${subj(ctx.player)} ${verb(ctx.player, 'look')} at ${poss(opp)} hand.`, ctx.player);
      return { type: 'selectCard', zone: 'opponentHand', cards: [...cards], prompt: "Discard: choose a card from the opponent's hand to discard." };
    },
    resolve(s, ctx, input, choice) {
      const id = expectCardId(input, choice);
      const opp = other(ctx.player);
      const card = moveCard(s, opp, 'hand', opp, 'discard', id);
      log(s, 'effect', `${subj(ctx.player)} ${verb(ctx.player, 'discard')} ${poss(opp)} ${CARD_DEFS[card.type].name} from hand.`, ctx.player);
      return null;
    },
  },

  return: {
    type: 'return',
    name: 'Return',
    color: '#2e8b57',
    colorName: 'Green',
    ink: '#ffffff',
    glyph: '⟲',
    text: 'Choose one card from your discard pile and return it to your hand.',
    hasTarget: (s, ctx) => s.players[ctx.player].discard.length > 0,
    begin(s, ctx) {
      const cards = s.players[ctx.player].discard;
      if (cards.length === 0) {
        fizzle(s, ctx, 'discard pile is empty');
        return null;
      }
      return { type: 'selectCard', zone: 'ownDiscard', cards: [...cards], prompt: 'Return: choose a card from your discard pile to take into your hand.' };
    },
    resolve(s, ctx, input, choice) {
      const id = expectCardId(input, choice);
      const card = moveCard(s, ctx.player, 'discard', ctx.player, 'hand', id);
      log(s, 'effect', `${subj(ctx.player)} ${verb(ctx.player, 'return')} ${CARD_DEFS[card.type].name} from discard to hand.`, ctx.player);
      return null;
    },
  },

  cancel: {
    type: 'cancel',
    name: 'Cancel',
    color: '#2a6fdb',
    colorName: 'Blue',
    ink: '#ffffff',
    glyph: '⊘',
    text: 'Look at the top 3 cards of the deck and rearrange them. Reaction: discard 2 Cancel from hand to counter a card your opponent plays.',
    hasTarget: (s) => s.deck.length > 0,
    begin(s, ctx) {
      const n = Math.min(s.rules.cancelLookCount, s.deck.length);
      if (n === 0) {
        fizzle(s, ctx, 'deck is empty');
        return null;
      }
      log(s, 'effect', `${subj(ctx.player)} ${verb(ctx.player, 'look')} at the top ${n} card${n > 1 ? 's' : ''} of the deck.`, ctx.player);
      return {
        type: 'arrangeDeck',
        cards: s.deck.slice(0, n),
        allowBottom: s.rules.cancelAllowBottom,
        allowReorder: s.rules.cancelAllowReorder,
        prompt: 'Cancel: arrange the top cards of the deck.',
      };
    },
    resolve(s, ctx, input, choice) {
      if (!('top' in input) || choice.type !== 'arrangeDeck') throw new IllegalActionError('Expected a deck arrangement');
      const ids = choice.cards.map((c) => c.id);
      const given = [...input.top, ...input.bottom];
      if (given.length !== ids.length || new Set(given).size !== given.length || !given.every((id) => ids.includes(id)))
        throw new IllegalActionError('Arrangement must contain each looked-at card exactly once');
      if (input.bottom.length > 0 && !choice.allowBottom) throw new IllegalActionError('Cards may not be placed on the bottom');
      if (!choice.allowReorder && input.top.some((id, i) => id !== ids[i]))
        throw new IllegalActionError('Cards may not be reordered');
      const n = ids.length;
      if (s.deck.slice(0, n).some((c, i) => c.id !== ids[i])) throw new IllegalActionError('Deck changed unexpectedly');
      const byId = new Map(choice.cards.map((c) => [c.id, c]));
      const rest = s.deck.slice(n);
      s.deck = [...input.top.map((id) => byId.get(id)!), ...rest, ...input.bottom.map((id) => byId.get(id)!)];
      const changed = input.bottom.length > 0 || input.top.some((id, i) => id !== ids[i]);
      log(
        s,
        'effect',
        `${subj(ctx.player)} ${changed ? verb(ctx.player, 'rearrange') + ' the top of the deck' : verb(ctx.player, 'leave') + ' the deck order unchanged'}${
          input.bottom.length ? ` and ${verb(ctx.player, 'put')} ${input.bottom.length} on the bottom` : ''
        }.`,
        ctx.player,
      );
      return null;
    },
  },
};

export const CARD_TYPES: CardType[] = ['repeat', 'shatter', 'discard', 'return', 'cancel'];

export const cancelCount = (cards: Card[]) => countType(cards, 'cancel');
