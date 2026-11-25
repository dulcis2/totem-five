import { CARD_DEFS, CARD_TYPES } from '../engine/cards';
import type { Rules } from '../engine/rules';
import type { Card, CardType } from '../engine/types';
import { winNeeds } from '../engine/win';
import { CardView } from './CardView';

/** Cards on a player's table, grouped by type into overlapping stacks. */
export function TableZone({
  cards,
  selectableIds,
  onSelect,
  highlightId,
  label,
}: {
  cards: Card[];
  selectableIds?: string[];
  onSelect?: (id: string) => void;
  highlightId?: string | null;
  label: string;
}) {
  const groups = CARD_TYPES.map((t) => ({ type: t, cards: cards.filter((c) => c.type === t) })).filter((g) => g.cards.length);
  return (
    <div className="table-zone" aria-label={label}>
      {groups.length === 0 && <div className="zone-empty">No cards on the table</div>}
      {groups.map((g) => {
        const choice = g.cards.find((c) => selectableIds?.includes(c.id));
        return (
          <div key={g.type} className={`stack ${choice ? 'stack--selectable' : ''}`} style={{ ['--n' as string]: g.cards.length }}>
            {g.cards.map((c, i) => (
              <CardView
                key={c.id}
                type={c.type}
                cardId={c.id}
                size="sm"
                className={`stack__card ${c.id === highlightId ? 'is-new' : ''}`}
                style={{ ['--i' as string]: i }}
                selectable={!!choice}
                onClick={choice && onSelect ? () => onSelect(choice.id) : undefined}
                badge={i === g.cards.length - 1 && g.cards.length > 1 ? `×${g.cards.length}` : undefined}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** Five-color and five-copy progress indicator. */
export function Progress({ cards, rules }: { cards: Card[]; rules: Rules }) {
  const types = cards.map((c) => c.type);
  const present = new Set(types);
  const n = winNeeds(types, rules);
  const best = rules.winCopies - n.copies;
  return (
    <div className="progress" aria-label="Win progress">
      <div className="progress__pips" title={`Five Colors: ${rules.winDistinctTypes - n.colors}/${rules.winDistinctTypes}`}>
        {CARD_TYPES.map((t) => (
          <span
            key={t}
            className={`pip ${present.has(t) ? 'is-on' : ''}`}
            style={{ ['--c' as string]: CARD_DEFS[t].color }}
            title={`${CARD_DEFS[t].name} ${present.has(t) ? '✓' : '—'}`}
          />
        ))}
        <span className="progress__label">{rules.winDistinctTypes - n.colors}/{rules.winDistinctTypes} colors</span>
      </div>
      <div className="progress__copies" title="Five Copies progress">
        {best}/{rules.winCopies} copies
      </div>
    </div>
  );
}

/** A discard pile shown as its top card plus a count. */
export function PileView({ cards, label, onOpen, highlight }: { cards: Card[]; label: string; onOpen: () => void; highlight?: boolean }) {
  const top = cards[cards.length - 1];
  return (
    <button type="button" className={`pile ${highlight ? 'pile--highlight' : ''}`} onClick={onOpen} title={`${label} — click to inspect`}>
      {top ? <CardView type={top.type} cardId={top.id} size="sm" /> : <div className="card card--sm card--empty">empty</div>}
      <span className="pile__label">
        {label} <b>{cards.length}</b>
      </span>
    </button>
  );
}

export function groupLabel(cards: Card[]): string {
  const counts = new Map<CardType, number>();
  for (const c of cards) counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
  return [...counts].map(([t, n]) => `${n}× ${CARD_DEFS[t].name}`).join(', ');
}
