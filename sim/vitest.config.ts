// Opt-in balance simulations (not part of `npm test`). Run with `npm run sim` (or `npm run sim -- sim/<file>`).
export default { test: { environment: 'node', include: ['sim/**/*.sim.ts'], silent: false } };
