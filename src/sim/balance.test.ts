/**
 * Balance report. Skipped by `npm test`; run with `npm run sim`.
 * Edit VARIANTS to compare other rule sets.
 */
import { describe, it } from 'vitest';
import type { Rules } from '../engine/rules';
import { formatRow, simulate } from './balance';

declare const process: { env: Record<string, string | undefined>; stdout: { write(s: string): void } };

const GAMES = Number(process.env.SIM_GAMES ?? 400);

const VARIANTS: [string, Partial<Rules>][] = [
  ['baseline', {}],
  ['4 copies', { winCopies: 4 }],
  ['face-up row 3', { marketSize: 3 }],
  ['face-up row 5', { marketSize: 5 }],
  ['4 copies + row 3', { winCopies: 4, marketSize: 3 }],
  ['bonus@3 draw', { setBonus: 'draw', setBonusAt: 3 }],
  ['bonus@3 reactivate', { setBonus: 'reactivate', setBonusAt: 3 }],
  ['bonus@3 choice', { setBonus: 'choice', setBonusAt: 3 }],
  ['bonus@4 choice', { setBonus: 'choice', setBonusAt: 4 }],
  ['bonus@3 choice + 4 copies', { setBonus: 'choice', setBonusAt: 3, winCopies: 4 }],
  ['bonus@3 choice + row 3', { setBonus: 'choice', setBonusAt: 3, marketSize: 3 }],
];

describe.skipIf(!process.env.SIM)('balance simulation', () => {
  it(`AI vs AI, ${GAMES} games per variant`, () => {
    for (const [name, rules] of VARIANTS) {
      const r = simulate(rules, GAMES);
      // The same "first to N of a color" statistic with the bonus off, as a control.
      const control = rules.setBonus && rules.setBonus !== 'off' ? simulate({ ...rules, setBonus: 'off' }, GAMES) : null;
      process.stdout.write(
        formatRow(name, r) + (control ? ` | control first-to-set wins ${Math.round(control.firstToSetWins * 100)}%` : '') + '\n',
      );
    }
  }, 3_600_000);
});
