/**
 * Card back art: a small totem pole of all five animals on a flat wood-brown card,
 * in the same carved style as the card faces. viewBox 0 0 100 140.
 *
 * Top to bottom: owl (Repeat), bear (Shatter), raven (Discard), turtle (Return),
 * frog (Cancel), crowned with wings and standing on a base.
 */
export const CARD_BACK_BG = '#3a2517';
const FRAME = '#5c3d27';
const WOOD = '#8a6440';

const X0 = 33;
const W = 34;
const H = 16;
const GAP = 1;
const TOP = 31;
const EYE_L = 43;
const EYE_R = 57;

type Block = (y: number) => string;

const owl: Block = (y) => {
  const ink = '#2a2105', bg = '#e9b824', cy = y + 6.5;
  return [EYE_L, EYE_R].map((x) => `<circle cx="${x}" cy="${cy}" r="3.7" fill="${ink}"/><circle cx="${x}" cy="${cy}" r="1.7" fill="${bg}"/>`).join('') +
    `<path d="M48.3 ${y + 10.5} H51.7 L50 ${y + 14} Z" fill="${ink}"/>`;
};

const bear: Block = (y) => {
  const ink = '#ffffff', bg = '#c8372d', cy = y + 6;
  return [EYE_L, EYE_R].map((x) => `<rect x="${x - 2.8}" y="${cy - 2.4}" width="5.6" height="4.8" rx=".6" fill="${ink}"/><rect x="${x - 1.2}" y="${cy - 1.1}" width="2.4" height="2.2" fill="${bg}"/>`).join('') +
    `<path d="M42 ${y + 11.5} H58 V${y + 14} H42 Z" fill="${ink}"/>` +
    [0, 1, 2, 3].map((i) => `<path d="M${42 + i * 4} ${y + 11.5} h4 l-2 2.1 z" fill="${bg}"/>`).join('');
};

const raven: Block = (y) => {
  const ink = '#f3efe6', dark = '#2b2b2b', cy = y + 6;
  return [EYE_L, EYE_R].map((x) => `<path d="M${x} ${cy - 3.6} L${x + 3.6} ${cy} L${x} ${cy + 3.6} L${x - 3.6} ${cy} Z" fill="${ink}"/><path d="M${x} ${cy - 1.3} L${x + 1.3} ${cy} L${x} ${cy + 1.3} L${x - 1.3} ${cy} Z" fill="${dark}"/>`).join('') +
    `<path d="M46.5 ${y + 8.5} H53.5 L50 ${y + 15.5} Z" fill="${ink}"/>`;
};

const turtle: Block = (y) => {
  const ink = '#ffffff', bg = '#2e8b57', cy = y + 6.5;
  return [EYE_L, EYE_R].map((x) => `<circle cx="${x}" cy="${cy}" r="2.8" fill="${ink}"/><circle cx="${x}" cy="${cy + 1}" r="1.2" fill="#1d5c39"/><rect x="${x - 3.4}" y="${cy - 3.4}" width="6.8" height="3.2" fill="${bg}"/><path d="M${x - 3.2} ${cy - .2} H${x + 3.2}" stroke="${ink}" stroke-width="1.1" stroke-linecap="round"/>`).join('') +
    `<path d="M44 ${y + 11.6} Q50 ${y + 15} 56 ${y + 11.6}" fill="none" stroke="${ink}" stroke-width="1.2" stroke-linecap="round"/>`;
};

const frog: Block = (y) => {
  const ink = '#ffffff', bg = '#2a6fdb', cy = y + 6;
  return [EYE_L, EYE_R].map((x) => `<circle cx="${x}" cy="${cy}" r="3.8" fill="${ink}"/><circle cx="${x}" cy="${cy}" r="2.3" fill="${bg}"/><rect x="${x - 1.9}" y="${cy - .6}" width="3.8" height="1.2" rx=".6" fill="${ink}"/>`).join('') +
    `<path d="M39 ${y + 11.5} Q50 ${y + 16.5} 61 ${y + 11.5}" fill="none" stroke="${ink}" stroke-width="1.4" stroke-linecap="round"/>`;
};

const BLOCKS: [string, Block][] = [
  ['#e9b824', owl],
  ['#c8372d', bear],
  ['#4a4a4a', raven],
  ['#2e8b57', turtle],
  ['#2a6fdb', frog],
];

const wing = `M${X0} ${TOP} L${X0} ${TOP - 9} L${X0 - 16} ${TOP - 17} L${X0 - 13} ${TOP - 11.5} L${X0 - 19} ${TOP - 10} L${X0 - 11} ${TOP - 6} L${X0 - 16} ${TOP - 3} L${X0 - 7} ${TOP - 1.5} Z`;

const blocksSvg = BLOCKS.map(([fill, draw], i) => {
  const y = TOP + i * (H + GAP);
  return `<rect x="${X0}" y="${y}" width="${W}" height="${H}" rx="1.5" fill="${fill}"/>` + draw(y);
}).join('');

const baseY = TOP + BLOCKS.length * (H + GAP);

/** Inner SVG markup for the card back (viewBox 0 0 100 140). */
export const CARD_BACK_SVG =
  `<rect x="5" y="5" width="90" height="130" rx="5" fill="none" stroke="${FRAME}" stroke-width="1.5"/>` +
  `<path d="${wing}" fill="${WOOD}"/><path d="${wing}" transform="translate(100 0) scale(-1 1)" fill="${WOOD}"/>` +
  blocksSvg +
  `<rect x="${X0 - 5}" y="${baseY}" width="${W + 10}" height="6" rx="1.5" fill="${WOOD}"/>`;
