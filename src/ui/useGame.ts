import { useCallback, useEffect, useRef, useState } from 'react';
import { decide } from '../ai/ai';
import { applyAction, createGame } from '../engine/engine';
import { DEFAULT_RULES, type Rules } from '../engine/rules';
import type { Action, GameState } from '../engine/types';
import { toView } from '../engine/view';

const RULES_KEY = 'five-totems:rules';

export function loadRules(): Rules {
  try {
    const raw = localStorage.getItem(RULES_KEY);
    if (raw) return { ...DEFAULT_RULES, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable */
  }
  return { ...DEFAULT_RULES };
}

function saveRules(r: Rules) {
  try {
    localStorage.setItem(RULES_KEY, JSON.stringify(r));
  } catch {
    /* ignore */
  }
}

/**
 * AI counter decisions are applied instantly. If the UI paused for them, the delay
 * would reveal to the human that the AI holds two Cancel cards.
 */
function settleInstantAi(s: GameState): GameState {
  let g = s;
  while (!g.winner && g.pending?.player === 'ai' && g.pending.kind === 'counter') {
    g = applyAction(g, 'ai', decide(toView(g, 'ai')));
  }
  return g;
}

export function useGame() {
  const [rules, setRulesState] = useState<Rules>(loadRules);
  const [game, setGame] = useState<GameState>(() => createGame({ rules }));
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const dispatch = useCallback(
    (action: Action) => {
      try {
        setGame(settleInstantAi(applyAction(game, 'human', action)));
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [game],
  );

  const newGame = useCallback((r: Rules = rules) => {
    window.clearTimeout(timer.current);
    setGame(createGame({ rules: r }));
    setError(null);
  }, [rules]);

  const setRules = useCallback((r: Rules) => {
    setRulesState(r);
    saveRules(r);
    newGame(r);
  }, [newGame]);

  // Drive the AI with a short delay so the human can follow what happens.
  useEffect(() => {
    if (game.winner || game.pending?.player !== 'ai') return;
    const delay = game.pending.kind === 'play' ? 1100 : 900;
    timer.current = window.setTimeout(() => {
      try {
        setGame(settleInstantAi(applyAction(game, 'ai', decide(toView(game, 'ai')))));
      } catch (e) {
        console.error('AI error', e);
        setError(`AI error: ${(e as Error).message}`);
      }
    }, delay);
    return () => window.clearTimeout(timer.current);
  }, [game]);

  return { game, dispatch, error, clearError: () => setError(null), newGame, rules, setRules };
}
