import type { Rules } from './rules';
import type { Card, CardType } from './types';

export interface WinResult {
  won: boolean;
  reason: 'Five Colors' | 'Five Copies' | null;
}

export function tableCounts(types: CardType[]): Map<CardType, number> {
  const m = new Map<CardType, number>();
  for (const t of types) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

/** How many more cards each win path needs. 0 = fulfilled. */
export function winNeeds(types: CardType[], rules: Rules): { colors: number; copies: number } {
  const counts = tableCounts(types);
  const distinct = counts.size;
  const maxCount = Math.max(0, ...counts.values());
  return {
    colors: Math.max(0, rules.winDistinctTypes - distinct),
    copies: Math.max(0, rules.winCopies - maxCount),
  };
}

export function evaluateWin(table: Card[], rules: Rules): WinResult {
  const n = winNeeds(
    table.map((c) => c.type),
    rules,
  );
  if (n.colors === 0) return { won: true, reason: 'Five Colors' };
  if (n.copies === 0) return { won: true, reason: 'Five Copies' };
  return { won: false, reason: null };
}
