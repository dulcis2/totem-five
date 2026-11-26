import type { CSSProperties, ReactNode } from 'react';
import { CARD_DEFS } from '../engine/cards';
import type { CardType } from '../engine/types';
import { TOTEM_FACES, faceIndex } from './totemArt';

export type CardSize = 'sm' | 'md' | 'lg';

interface Props {
  type?: CardType;
  /** The card's id; picks which of the five totem faces it shows. */
  cardId?: string;
  faceDown?: boolean;
  size?: CardSize;
  selectable?: boolean;
  selected?: boolean;
  dim?: boolean;
  onClick?: () => void;
  badge?: ReactNode;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

export function CardView({ type, cardId, faceDown, size = 'md', selectable, selected, dim, onClick, badge, className = '', style, title }: Props) {
  const cls = [
    'card',
    `card--${size}`,
    faceDown ? 'card--back' : `card--${type}`,
    selectable ? 'is-selectable' : '',
    selected ? 'is-selected' : '',
    dim ? 'is-dim' : '',
    className,
  ].join(' ');

  if (faceDown || !type) {
    return (
      <div className={cls} style={style} aria-label="Face-down card">
        <span className="card__knot" aria-hidden />
      </div>
    );
  }

  const def = CARD_DEFS[type];
  const faces = TOTEM_FACES[type];
  const face = faces[faceIndex(cardId, faces.length)];
  const vars = { ...style, '--c': def.color, '--ink': def.ink } as CSSProperties;
  const content = (
    <>
      <svg className="card__art" viewBox="0 0 100 140" aria-hidden dangerouslySetInnerHTML={{ __html: face.svg }} />
      <span className="card__corner">{def.glyph}</span>
      <span className="card__name">{def.name}</span>
      {size !== 'sm' && <span className="card__text">{def.text}</span>}
      {badge !== undefined && <span className="card__badge">{badge}</span>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={cls} style={vars} onClick={onClick} disabled={!selectable && !selected} title={title ?? `${def.name} — ${def.text}`}>
        {content}
      </button>
    );
  }
  return (
    <div className={cls} style={vars} title={title ?? `${def.name} — ${def.text}`}>
      {content}
    </div>
  );
}
