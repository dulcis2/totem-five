/**
 * Rule configuration.
 *
 * Every rule that the design document marks as open/ambiguous (section 12) is
 * isolated here as an explicit option, so it can be changed without touching
 * the engine. Defaults are the interpretation used by the prototype and are
 * listed in the README under "Rule interpretations".
 */
export type EmptyDeckRule =
  /** The draw is skipped; play continues. If neither player can play, the game is a draw. */
  | 'skip'
  /** Both discard piles are shuffled together to form a new deck. */
  | 'reshuffleDiscards'
  /** The game immediately ends in a draw. */
  | 'endInDraw';

/**
 * Set bonus: reward for the Nth totem of the same color entering your table.
 * 'draw': draw a card. 'reactivate': the card's effect resolves a second time.
 * 'choice': the player picks one of the two.
 */
export type SetBonusRule = 'off' | 'draw' | 'reactivate' | 'choice';

export interface Rules {
  // --- Setup -----------------------------------------------------------
  copiesPerType: number;
  startingHandFirst: number;
  startingHandSecond: number;
  firstPlayer: 'random' | 'human' | 'ai';

  // --- Winning ---------------------------------------------------------
  /** Distinct card types needed for "Five Colors". */
  winDistinctTypes: number;
  /** Copies of one type needed for the copies win ("Five Copies", or "Four Copies" when 4). */
  winCopies: number;

  // --- Drawing ----------------------------------------------------------
  /**
   * Size of a face-up row next to the deck. 0 = off (always draw blind from the deck).
   * When on, each draw is either a face-up card (the row refills from the deck) or the top of the deck.
   */
  marketSize: number;

  // --- Set bonus ----------------------------------------------------------
  setBonus: SetBonusRule;
  /** Which totem of the same color triggers the bonus (3 = the third one). */
  setBonusAt: number;

  // --- Timing ----------------------------------------------------------
  /**
   * When a played card lands on the table.
   * 'beforeEffect': the card enters the table, win is checked, then its effect resolves.
   * 'afterEffect': the effect resolves first, then the card enters the table.
   */
  playedCardEntersTable: 'beforeEffect' | 'afterEffect';

  // --- Open question 1: Cancel deck manipulation --------------------------
  cancelLookCount: number;
  /** May the player change the order of the looked-at cards? */
  cancelAllowReorder: boolean;
  /** May some/all of the looked-at cards be placed on the bottom of the deck? */
  cancelAllowBottom: boolean;

  // --- Open question 2: Repeat -------------------------------------------
  /** May Repeat choose another Repeat card? A card is never activated twice in one chain. */
  repeatCanTargetRepeat: boolean;
  /** Hard safety cap on chained Repeat hops. */
  maxRepeatDepth: number;

  // --- Open question 3: Cancel reaction ------------------------------------
  counterEnabled: boolean;
  /** Cancel cards discarded from hand to counter. */
  counterCost: number;
  /** May the original player counter the counter (and so on)? */
  counterCanBeCountered: boolean;

  // --- Open question 4: Empty zones ---------------------------------------
  /**
   * If true, Shatter / Discard / Return / Repeat / Cancel may be played with no valid
   * target: the card still enters the table and its effect fizzles.
   * If false, such a card cannot be played while it has no target.
   */
  allowPlayWithoutTarget: boolean;

  // --- Open question 5: Empty deck -----------------------------------------
  emptyDeck: EmptyDeckRule;

  /** Safety valve: game is declared a draw after this many turns. */
  maxTurns: number;
}

export const DEFAULT_RULES: Rules = {
  copiesPerType: 10,
  startingHandFirst: 4,
  startingHandSecond: 5,
  firstPlayer: 'random',

  winDistinctTypes: 5,
  winCopies: 5,

  marketSize: 0,

  setBonus: 'off',
  setBonusAt: 3,

  playedCardEntersTable: 'beforeEffect',

  cancelLookCount: 3,
  cancelAllowReorder: true,
  cancelAllowBottom: false,

  repeatCanTargetRepeat: false,
  maxRepeatDepth: 5,

  counterEnabled: true,
  counterCost: 2,
  counterCanBeCountered: false,

  allowPlayWithoutTarget: true,

  emptyDeck: 'skip',

  maxTurns: 300,
};
