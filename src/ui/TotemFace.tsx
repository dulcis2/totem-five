import type { ReactElement } from 'react';
import type { CardType } from '../engine/types';

/*
 * Carved totem faces, one per card type (viewBox 40×50).
 * Colours come from CSS: the head uses currentColor, eyes and mouth use --hi,
 * and ornaments use the card colour --c.
 */
const HI = { fill: 'var(--hi)' };
const C = { fill: 'var(--c)' };
const HEAD = <rect x="5" y="8" width="30" height="40" rx="6" fill="currentColor" />;

const FACES: Record<CardType, ReactElement> = {
  // Owl: sees a card again.
  repeat: (
    <>
      <path d="M5 14 L5 2 L15 9 Z M35 14 L35 2 L25 9 Z" style={C} />
      {HEAD}
      <circle cx="13.5" cy="21" r="6.5" style={HI} />
      <circle cx="26.5" cy="21" r="6.5" style={HI} />
      <circle cx="13.5" cy="21" r="3" fill="currentColor" />
      <circle cx="26.5" cy="21" r="3" fill="currentColor" />
      <path d="M16.5 29 L23.5 29 L20 36 Z" style={C} />
      <path d="M11 41 h18" style={{ stroke: 'var(--hi)' }} strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  // Shark warrior: destroys.
  shatter: (
    <>
      <path d="M20 0 L26 9 L14 9 Z" style={C} />
      {HEAD}
      <path d="M9 17 L18 21 L9 24 Z M31 17 L22 21 L31 24 Z" style={HI} />
      <rect x="9" y="30" width="22" height="11" rx="2" style={HI} />
      <path
        d="M9 30 L12.5 35 L16 30 L19.5 35 L23 30 L26.5 35 L30 30 L31 30 L31 31 L9 31 Z M9 41 L12.5 37 L16 41 L19.5 37 L23 41 L26.5 37 L30 41 Z"
        fill="currentColor"
      />
    </>
  ),
  // Crab: grabs from the opponent's hand.
  discard: (
    <>
      <circle cx="4" cy="22" r="4" style={C} />
      <circle cx="36" cy="22" r="4" style={C} />
      {HEAD}
      <ellipse cx="13.5" cy="19" rx="5" ry="3" style={HI} />
      <ellipse cx="26.5" cy="19" rx="5" ry="3" style={HI} />
      <ellipse cx="20" cy="34" rx="7" ry="7.5" style={HI} />
      <ellipse cx="20" cy="35" rx="3.5" ry="4" fill="currentColor" />
      <path d="M9 12 h22" style={{ stroke: 'var(--c)' }} strokeWidth="2.5" />
    </>
  ),
  // Turtle: brings a card back.
  return: (
    <>
      <path d="M8 9 L14 2 L26 2 L32 9 Z" style={C} />
      {HEAD}
      <path d="M9 21 Q13.5 26 18 21 M22 21 Q26.5 26 31 21" fill="none" style={{ stroke: 'var(--hi)' }} strokeWidth="2.8" strokeLinecap="round" />
      <path d="M12 33 Q20 41 28 33" fill="none" style={{ stroke: 'var(--hi)' }} strokeWidth="3" strokeLinecap="round" />
      <circle cx="20" cy="15" r="2" style={HI} />
    </>
  ),
  // Wave guardian: holds back the tide.
  cancel: (
    <>
      <path d="M5 10 Q10 1 15 8 Q20 1 25 8 Q30 1 35 10 Z" style={C} />
      {HEAD}
      <rect x="9" y="18" width="9" height="5" rx="1" style={HI} />
      <rect x="22" y="18" width="9" height="5" rx="1" style={HI} />
      <rect x="10" y="31" width="20" height="6" rx="1.5" style={HI} />
      <path d="M20 29 V39" fill="none" stroke="currentColor" strokeWidth="3" />
    </>
  ),
};

export function TotemFace({ type, className }: { type: CardType; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 50" aria-hidden focusable="false">
      {FACES[type]}
    </svg>
  );
}
