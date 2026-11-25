import type { CSSProperties, ReactNode } from 'react';
import { CARD_DEFS } from '../engine/cards';
import type { CardType } from '../engine/types';
import { TotemFace } from './TotemFace';

export type CardSize = 'sm' | 'md' | 'lg';

interface Props {
  type?: CardType;
  faceDown?: boolean;
  size?: CardSize;
  /** Compact carved block used for cards stacked into a totem pole. */
  block?: boolean;
  selectable?: boolean;
  selected?: boolean;
  dim?: boolean;
  onClick?: () => void;
  badge?: ReactNode;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

export function CardView({ type, faceDown, size = 'md', block, selectable, selected, dim, onClick, badge, className = '', style, title }: Props) {
  const cls = [
    'card',
    `card--${size}`,
    block ? 'card--block' : '',
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
  const vars = { ...style, '--c': def.color } as CSSProperties;
  const content = (
    <>
      {!block && <span className="card__band" aria-hidden />}
      <TotemFace type={type} className="card__face" />
      {!block && <span className="card__name">{def.name}</span>}
      {!block && size !== 'sm' && <span className="card__text">{def.text}</span>}
      {!block && <span className="card__band card__band--bottom" aria-hidden />}
      {badge !== undefined && <span className="card__badge">{badge}</span>}
    </>
  );
  const label = title ?? `${def.name} — ${def.text}`;

  if (onClick) {
    return (
      <button type="button" className={cls} style={vars} onClick={onClick} disabled={!selectable && !selected} title={label}>
        {content}
      </button>
    );
  }
  return (
    <div className={cls} style={vars} title={label}>
      {content}
    </div>
  );
}
