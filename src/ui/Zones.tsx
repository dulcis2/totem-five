import { CARD_DEFS, CARD_TYPES } from '../engine/cards';
import type { Rules } from '../engine/rules';
import type { Card, CardType } from '../engine/types';
import { copiesWinName, winNeeds } from '../engine/win';
import { CardView } from './CardView';

/**
 * Cards on a player's table, stacked into one totem pole per type.
 * Five standing poles = Five Colors; one pole `goal` high = Five Copies.
 */
export function TableZone({
  cards,
  selectableIds,
  onSelect,
  highlightId,
  label,
  goal = 5,
}: {
  cards: Card[];
  selectableIds?: string[];
  onSelect?: (id: string) => void;
  highlightId?: string | null;
  label: string;
  goal?: number;
}) {
  return (
    <div className="table-zone" aria-label={label}>
      {CARD_TYPES.map((t) => {
        const pole = cards.filter((c) => c.type === t);
        if (pole.length === 0) {
          return (
            <div key={t} className="pole pole--empty" title={`No ${CARD_DEFS[t].name} totem yet`}>
              <span className="pole__slot" style={{ ['--c' as string]: CARD_DEFS[t].color }} />
            </div>
          );
        }
        const choice = pole.find((c) => selectableIds?.includes(c.id));
        return (
          <div key={t} className={`pole ${choice ? 'pole--selectable' : ''}`}>
            <div className="stack" style={{ ['--n' as string]: pole.length }}>
              {pole.map((c, i) => (
                <CardView
                  key={c.id}
                  type={c.type}
                  cardId={c.id}
                  size="sm"
                  className={`stack__card ${c.id === highlightId ? 'is-new' : ''}`}
                  style={{ ['--i' as string]: i }}
                  selectable={!!choice}
                  onClick={choice && onSelect ? () => onSelect(choice.id) : undefined}
                />
              ))}
            </div>
            <span className="pole__count">
              {pole.length}/{goal}
            </span>
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
      <div className="progress__copies" title={`${copiesWinName(rules.winCopies)} progress`}>
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
