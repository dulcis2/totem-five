import { useEffect, useState, type ReactNode } from 'react';
import { CARD_DEFS, CARD_TYPES } from '../engine/cards';
import { DEFAULT_RULES, type EmptyDeckRule, type Rules } from '../engine/rules';
import type { Card, CardType } from '../engine/types';
import { CardView } from './CardView';

export function Modal({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose?: () => void; wide?: boolean }) {
  useEffect(() => {
    if (!onClose) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${wide ? 'modal--wide' : ''}`} role="dialog" aria-modal aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>{title}</h2>
          {onClose && (
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

/** Choose one card from a list (revealed hand, discard pile). */
export function PickCardModal({ title, hint, cards, selectable, onPick, onClose }: {
  title: string;
  hint?: string;
  cards: Card[];
  selectable?: string[];
  onPick?: (id: string) => void;
  onClose?: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose} wide>
      {hint && <p className="modal__hint">{hint}</p>}
      {cards.length === 0 && <p className="zone-empty">No cards.</p>}
      <div className="card-row card-row--wrap">
        {cards.map((c) => (
          <CardView
            key={c.id}
            type={c.type}
            cardId={c.id}
            size="md"
            selectable={!!onPick && (!selectable || selectable.includes(c.id))}
            onClick={onPick ? () => onPick(c.id) : undefined}
          />
        ))}
      </div>
    </Modal>
  );
}

export function CounterModal({ card, isCounterCounter, cost, onDecide }: { card: CardType; isCounterCounter: boolean; cost: number; onDecide: (use: boolean) => void }) {
  return (
    <Modal title={isCounterCounter ? 'Your play was countered!' : 'Counter opportunity'}>
      <div className="counter">
        <CardView type={card} size="lg" />
        <div>
          <p>
            {isCounterCounter ? (
              <>
                The AI discarded {cost} Cancel cards to counter your <b>{CARD_DEFS[card].name}</b>. You may counter back with {cost} Cancel cards
                from your hand.
              </>
            ) : (
              <>
                The AI plays <b>{CARD_DEFS[card].name}</b>. You may discard {cost} <b>Cancel</b> cards from your hand to counter it — it will
                have no effect and will go to the AI's discard pile.
              </>
            )}
          </p>
          <div className="btn-row">
            <button type="button" className="btn btn--primary" onClick={() => onDecide(true)}>
              Counter (discard {cost} Cancel)
            </button>
            <button type="button" className="btn" onClick={() => onDecide(false)}>
              Let it resolve
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function ArrangeModal({ cards, allowBottom, allowReorder, onConfirm }: {
  cards: Card[];
  allowBottom: boolean;
  allowReorder: boolean;
  onConfirm: (top: string[], bottom: string[]) => void;
}) {
  const [order, setOrder] = useState(cards.map((c) => c.id));
  const [bottom, setBottom] = useState<string[]>([]);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const n = [...order];
    [n[i], n[j]] = [n[j], n[i]];
    setOrder(n);
  };
  const toggleBottom = (id: string) => setBottom((b) => (b.includes(id) ? b.filter((x) => x !== id) : [...b, id]));
  const top = order.filter((id) => !bottom.includes(id));
  const drawers = ['AI', 'You', 'AI', 'You', 'AI'];

  return (
    <Modal title="Cancel — arrange the deck" wide>
      <p className="modal__hint">
        These are the top {cards.length} cards of the shared deck (leftmost = top). After your turn the <b>AI draws first</b>, then you.
        {allowReorder ? ' Use the arrows to reorder.' : ' Reordering is disabled by the current rules.'}
        {allowBottom ? ' You may also send cards to the bottom of the deck.' : ''}
      </p>
      <div className="card-row arrange">
        {order.map((id, i) => {
          const c = byId.get(id)!;
          const isBottom = bottom.includes(id);
          const pos = top.indexOf(id);
          return (
            <div key={id} className={`arrange__slot ${isBottom ? 'is-bottom' : ''}`}>
              <div className="arrange__pos">{isBottom ? 'Bottom of deck' : `#${pos + 1} → ${drawers[pos]} draws`}</div>
              <CardView type={c.type} cardId={c.id} size="md" />
              <div className="btn-row btn-row--tight">
                {allowReorder && (
                  <>
                    <button type="button" className="btn btn--small" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                      ◀
                    </button>
                    <button type="button" className="btn btn--small" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label="Move down">
                      ▶
                    </button>
                  </>
                )}
                {allowBottom && (
                  <button type="button" className="btn btn--small" onClick={() => toggleBottom(id)}>
                    {isBottom ? 'Keep on top' : 'To bottom'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="btn-row">
        <button type="button" className="btn btn--primary" onClick={() => onConfirm(top, order.filter((id) => bottom.includes(id)))}>
          Confirm order
        </button>
      </div>
    </Modal>
  );
}

export function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="How to play Five Totems" onClose={onClose} wide>
      <div className="howto">
        <p>
          Two players share one deck of 50 cards — 10 each of five totems. On your turn you <b>draw one card</b>, then <b>play one card</b> from
          your hand. Played cards stay on your side of the table and their effect resolves.
        </p>
        <h3>Win immediately by having on your table</h3>
        <ul>
          <li>
            <b>Five Colors</b> — at least one card of each of the five types, or
          </li>
          <li>
            <b>Five Copies</b> — five cards of the same type.
          </li>
        </ul>
        <h3>The cards</h3>
        <div className="howto__cards">
          {CARD_TYPES.map((t) => (
            <div key={t} className="howto__card">
              <CardView type={t} size="sm" />
              <div>
                <b>
                  {CARD_DEFS[t].name} <span className="muted">({CARD_DEFS[t].colorName})</span>
                </b>
                <p>{CARD_DEFS[t].text}</p>
              </div>
            </div>
          ))}
        </div>
        <h3>Counter</h3>
        <p>
          When your opponent plays a card, you may discard <b>two Cancel cards</b> from your hand to counter it. A countered card has no effect
          and goes to its owner's discard pile instead of the table.
        </p>
        <p className="muted">The first player starts with 4 cards, the second with 5. Some details can be changed under “Rule variants”.</p>
      </div>
    </Modal>
  );
}

function Toggle({ label, help, checked, onChange }: { label: string; help: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="setting">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <b>{label}</b>
        <small>{help}</small>
      </span>
    </label>
  );
}

export function RulesModal({ rules, onApply, onClose }: { rules: Rules; onApply: (r: Rules) => void; onClose: () => void }) {
  const [r, setR] = useState<Rules>(rules);
  const set = <K extends keyof Rules>(k: K, v: Rules[K]) => setR((x) => ({ ...x, [k]: v }));
  return (
    <Modal title="Rule variants" onClose={onClose} wide>
      <p className="modal__hint">
        These options cover the rules that are still open questions for the physical game. Applying them starts a new game.
      </p>
      <div className="settings">
        <h3>Cancel — deck manipulation</h3>
        <Toggle label="Allow reordering" help="Rearrange the 3 cards you look at." checked={r.cancelAllowReorder} onChange={(v) => set('cancelAllowReorder', v)} />
        <Toggle label="Allow sending to the bottom" help="Any of the 3 cards may go to the bottom of the deck." checked={r.cancelAllowBottom} onChange={(v) => set('cancelAllowBottom', v)} />
        <h3>Repeat</h3>
        <Toggle
          label="Repeat may target another Repeat"
          help="Chains are allowed, but each card can activate only once per chain."
          checked={r.repeatCanTargetRepeat}
          onChange={(v) => set('repeatCanTargetRepeat', v)}
        />
        <h3>Cancel — counter</h3>
        <Toggle label="A counter can be countered" help="The original player may answer with two Cancels of their own." checked={r.counterCanBeCountered} onChange={(v) => set('counterCanBeCountered', v)} />
        <h3>Empty zones</h3>
        <Toggle
          label="Cards may be played without a target"
          help="If off, Shatter/Discard/Return/Repeat/Cancel can't be played while they have nothing to act on."
          checked={r.allowPlayWithoutTarget}
          onChange={(v) => set('allowPlayWithoutTarget', v)}
        />
        <h3>Timing</h3>
        <Toggle
          label="Played card enters the table before its effect"
          help="If on, a card that completes your set wins immediately."
          checked={r.playedCardEntersTable === 'beforeEffect'}
          onChange={(v) => set('playedCardEntersTable', v ? 'beforeEffect' : 'afterEffect')}
        />
        <h3>Empty deck</h3>
        <label className="setting setting--select">
          <span>
            <b>When the deck runs out</b>
          </span>
          <select value={r.emptyDeck} onChange={(e) => set('emptyDeck', e.target.value as EmptyDeckRule)}>
            <option value="skip">Skip the draw (draw game if nobody can play)</option>
            <option value="reshuffleDiscards">Shuffle both discard piles into a new deck</option>
            <option value="endInDraw">The game ends in a draw</option>
          </select>
        </label>
        <h3>Who starts</h3>
        <label className="setting setting--select">
          <span>
            <b>First player</b>
          </span>
          <select value={r.firstPlayer} onChange={(e) => set('firstPlayer', e.target.value as Rules['firstPlayer'])}>
            <option value="random">Random</option>
            <option value="human">You</option>
            <option value="ai">AI</option>
          </select>
        </label>
      </div>
      <div className="btn-row">
        <button type="button" className="btn btn--primary" onClick={() => onApply(r)}>
          Apply &amp; start new game
        </button>
        <button type="button" className="btn" onClick={() => setR({ ...DEFAULT_RULES })}>
          Reset to defaults
        </button>
      </div>
    </Modal>
  );
}
