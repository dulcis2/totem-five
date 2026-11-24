import type { CSSProperties, ReactNode } from 'react';
import { CARD_DEFS } from '../engine/cards';
import type { CardType } from '../engine/types';

export type CardSize = 'sm' | 'md' | 'lg';

interface Props {
  type?: CardType;
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

export function CardView({ type, faceDown, size = 'md', selectable, selected, dim, onClick, badge, className = '', style, title }: Props) {
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
        <div className="card__back-art">
          {['repeat', 'shatter', 'discard', 'return', 'cancel'].map((t) => (
            <span key={t} style={{ background: CARD_DEFS[t as CardType].color }} />
          ))}
        </div>
      </div>
    );
  }

  const def = CARD_DEFS[type];
  const vars = { ...style, '--c': def.color, '--ink': def.ink } as CSSProperties;
  const content = (
    <>
      <span className="card__corner">{def.glyph}</span>
      <span className="card__totem" aria-hidden>
        <span className="card__glyph">{def.glyph}</span>
      </span>
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
