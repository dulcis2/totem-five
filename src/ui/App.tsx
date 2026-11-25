import { useEffect, useRef, useState } from 'react';
import { CARD_DEFS } from '../engine/cards';
import { playableCards } from '../engine/engine';
import type { GameState, LogEntry } from '../engine/types';
import { CardView } from './CardView';
import { ArrangeModal, CounterModal, HowToPlay, Modal, PickCardModal, RulesModal } from './Modals';
import { useGame } from './useGame';
import { PileView, Progress, TableZone } from './Zones';

const STORE_URL = import.meta.env.VITE_STORE_URL as string | undefined;
const SEEN_KEY = 'five-totems:seen-help';

function firstVisit(): boolean {
  try {
    if (localStorage.getItem(SEEN_KEY)) return false;
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* ignore */
  }
  return true;
}

function phaseLabel(g: GameState): string {
  if (g.winner) return 'Game over';
  const p = g.pending;
  if (!p) return '';
  if (p.kind === 'play') return 'Play a card';
  if (p.kind === 'counter') return 'Reaction window';
  return `Resolving ${CARD_DEFS[p.effect].name}`;
}

function GameLog({ entries }: { entries: LogEntry[] }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [entries.length]);
  return (
    <ol className="log" ref={ref}>
      {entries.map((e) => (
        <li key={e.id} className={`log__item log__item--${e.kind} ${e.player ? `log__item--${e.player}` : ''}`}>
          {e.text}
        </li>
      ))}
    </ol>
  );
}

export function App() {
  const { game, dispatch, error, clearError, newGame, rules, setRules } = useGame();
  const [selected, setSelected] = useState<string | null>(null);
  const [inspect, setInspect] = useState<'human' | 'ai' | null>(null);
  const [showHelp, setShowHelp] = useState(firstVisit);
  const [showRules, setShowRules] = useState(false);
  const [dismissedResult, setDismissedResult] = useState(false);

  useEffect(() => {
    setSelected(null);
  }, [game]);
  useEffect(() => {
    setDismissedResult(false);
  }, [game.seed]);

  const human = game.players.human;
  const ai = game.players.ai;
  const p = game.pending;
  const myPlay = !game.winner && p?.player === 'human' && p.kind === 'play';
  const myEffect = !game.winner && p?.player === 'human' && p.kind === 'effect' ? p : null;
  const select = myEffect?.choice.type === 'selectCard' ? myEffect.choice : null;
  const arrange = myEffect?.choice.type === 'arrangeDeck' ? myEffect.choice : null;
  const myCounter = !game.winner && p?.player === 'human' && p.kind === 'counter' && game.stack;
  const aiThinking = !game.winner && p?.player === 'ai';
  const playable = myPlay ? playableCards(game, 'human').map((c) => c.id) : [];
  const selectIds = select ? select.cards.map((c) => c.id) : [];
  const pick = (id: string) => dispatch({ type: 'select', cardId: id });

  const onHandClick = (id: string) => {
    if (!myPlay || !playable.includes(id)) return;
    if (selected === id) dispatch({ type: 'play', cardId: id });
    else setSelected(id);
  };

  // Center slot: the card currently on the stack, or the last played card this round.
  const shown = game.stack
    ? { card: game.stack.card, player: game.stack.owner, label: game.stack.owner === 'human' ? 'You play' : 'AI plays' }
    : game.lastPlayed && game.turn - game.lastPlayed.turn <= 1
      ? { card: game.lastPlayed.card, player: game.lastPlayed.player, label: game.lastPlayed.player === 'human' ? 'You played' : 'AI played' }
      : null;

  let prompt: string;
  if (game.winner === 'human') prompt = `You win with ${game.winReason}!`;
  else if (game.winner === 'ai') prompt = `The AI wins with ${game.winReason}.`;
  else if (game.winner === 'draw') prompt = `Draw — ${game.winReason}.`;
  else if (myPlay) prompt = selected ? `Play ${CARD_DEFS[human.hand.find((c) => c.id === selected)!.type].name}? Click it again or press “Play”.` : 'Your turn — choose a card from your hand to play.';
  else if (select) prompt = select.prompt;
  else if (arrange) prompt = arrange.prompt;
  else if (myCounter) prompt = 'Decide whether to counter.';
  else if (aiThinking) prompt = 'AI is thinking…';
  else prompt = '';

  const lastId = game.lastPlayed?.card.id ?? null;

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">
          <span className="brand__bars" aria-hidden>
            {(['repeat', 'shatter', 'discard', 'return', 'cancel'] as const).map((t) => (
              <i key={t} style={{ background: CARD_DEFS[t].color }} />
            ))}
          </span>
          Five Totems
        </h1>
        <div className="topbar__actions">
          <button type="button" className="btn btn--ghost" onClick={() => setShowHelp(true)}>
            How to play
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setShowRules(true)}>
            Rule variants
          </button>
          <button type="button" className="btn btn--primary" onClick={() => newGame()}>
            New game
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="board">
          {/* AI side */}
          <div className={`side side--ai ${game.current === 'ai' && !game.winner ? 'is-active' : ''}`}>
            <div className="side__row">
              <div className="side__who">
                <span className="who-badge who-badge--ai">AI</span>
                <Progress cards={ai.table} rules={rules} />
              </div>
              <div className="ai-hand" aria-label={`AI hand: ${ai.hand.length} cards`}>
                {ai.hand.map((c, i) => (
                  <CardView key={c.id} faceDown size="sm" className="ai-hand__card" style={{ ['--i' as string]: i }} />
                ))}
                <span className="ai-hand__count">{ai.hand.length} in hand</span>
              </div>
              <PileView cards={ai.discard} label="AI discard" onOpen={() => setInspect('ai')} />
            </div>
            <TableZone
              label="AI table"
              cards={ai.table}
              selectableIds={select?.zone === 'opponentTable' ? selectIds : undefined}
              onSelect={pick}
              highlightId={lastId}
            />
          </div>

          {/* Center */}
          <div className="center">
            <div className="deck" title="Shared deck">
              {game.deck.length > 0 ? <CardView faceDown size="sm" /> : <div className="card card--sm card--empty">empty</div>}
              <span className="deck__count">
                Deck <b>{game.deck.length}</b>
              </span>
            </div>
            <div className={`status ${game.winner ? 'status--over' : ''}`}>
              <div className="status__meta">
                <span>Turn {game.turn}</span>
                <span className={`turn-chip turn-chip--${game.current}`}>{game.winner ? 'Finished' : game.current === 'human' ? 'Your turn' : "AI's turn"}</span>
                <span className="muted">{phaseLabel(game)}</span>
              </div>
              <div className={`status__prompt ${myPlay || myEffect ? 'is-yours' : ''}`}>
                {aiThinking && <span className="dots" aria-hidden />}
                {prompt}
              </div>
              {myPlay && selected && (
                <div className="btn-row btn-row--tight">
                  <button type="button" className="btn btn--primary" onClick={() => dispatch({ type: 'play', cardId: selected })}>
                    Play
                  </button>
                  <button type="button" className="btn" onClick={() => setSelected(null)}>
                    Cancel
                  </button>
                </div>
              )}
              {select && (select.zone === 'ownDiscard' || select.zone === 'opponentHand') && (
                <div className="muted small">Choose in the open window.</div>
              )}
              {game.winner && (
                <div className="btn-row btn-row--tight">
                  <button type="button" className="btn btn--primary" onClick={() => newGame()}>
                    Play again
                  </button>
                </div>
              )}
              {error && (
                <div className="error" role="alert">
                  {error}{' '}
                  <button type="button" className="link" onClick={clearError}>
                    dismiss
                  </button>
                </div>
              )}
            </div>
            <div className="played">
              {shown ? (
                <>
                  <CardView key={shown.card.id} type={shown.card.type} cardId={shown.card.id} size="sm" className="played__card" />
                  <span className={`played__label played__label--${shown.player}`}>{shown.label}</span>
                </>
              ) : (
                <div className="card card--sm card--empty">—</div>
              )}
            </div>
          </div>

          {/* Human side */}
          <div className={`side side--human ${game.current === 'human' && !game.winner ? 'is-active' : ''}`}>
            <TableZone
              label="Your table"
              cards={human.table}
              selectableIds={select?.zone === 'ownTable' ? selectIds : undefined}
              onSelect={pick}
              highlightId={lastId}
            />
            <div className="side__row">
              <div className="side__who">
                <span className="who-badge who-badge--human">You</span>
                <Progress cards={human.table} rules={rules} />
              </div>
              <PileView cards={human.discard} label="Your discard" onOpen={() => setInspect('human')} />
            </div>
            <div className="hand" aria-label="Your hand">
              {human.hand.length === 0 && <div className="zone-empty">Your hand is empty</div>}
              {human.hand.map((c) => (
                <CardView
                  key={c.id}
                  type={c.type}
                  cardId={c.id}
                  size="md"
                  className="hand__card"
                  selectable={playable.includes(c.id)}
                  selected={selected === c.id}
                  dim={myPlay && !playable.includes(c.id)}
                  onClick={() => onHandClick(c.id)}
                />
              ))}
            </div>
          </div>
        </section>

        <aside className="sidebar">
          <h2>Game log</h2>
          <GameLog entries={game.log} />
          <p className="sidebar__foot muted small">
            {game.firstPlayer === 'human' ? 'You' : 'AI'} went first
          </p>
        </aside>
      </main>

      {/* Decision windows */}
      {select?.zone === 'opponentHand' && (
        <PickCardModal title="Discard — the AI's hand" hint="Choose one card to discard." cards={select.cards} onPick={pick} />
      )}
      {select?.zone === 'ownDiscard' && (
        <PickCardModal title="Return — your discard pile" hint="Choose one card to take back into your hand." cards={select.cards} onPick={pick} />
      )}
      {arrange && (
        <ArrangeModal
          key={arrange.cards.map((c) => c.id).join()}
          cards={arrange.cards}
          allowBottom={arrange.allowBottom}
          allowReorder={arrange.allowReorder}
          onConfirm={(top, bottom) => dispatch({ type: 'arrange', top, bottom })}
        />
      )}
      {myCounter && game.stack && (
        <CounterModal
          card={game.stack.card.type}
          isCounterCounter={game.stack.owner === 'human'}
          cost={rules.counterCost}
          onDecide={(use) => dispatch({ type: 'counter', use })}
        />
      )}

      {inspect && !myEffect && !myCounter && (
        <PickCardModal
          title={inspect === 'human' ? 'Your discard pile' : "AI's discard pile"}
          cards={game.players[inspect].discard}
          onClose={() => setInspect(null)}
        />
      )}
      {showHelp && <HowToPlay onClose={() => setShowHelp(false)} />}
      {showRules && (
        <RulesModal
          rules={rules}
          onClose={() => setShowRules(false)}
          onApply={(r) => {
            setRules(r);
            setShowRules(false);
          }}
        />
      )}
      {game.winner && !dismissedResult && (
        <Modal title={game.winner === 'human' ? 'Victory!' : game.winner === 'ai' ? 'Defeat' : 'Draw'} onClose={() => setDismissedResult(true)}>
          <div className="result">
            <p className="result__big">
              {game.winner === 'human' ? `You win with ${game.winReason}!` : game.winner === 'ai' ? `The AI wins with ${game.winReason}.` : `Draw — ${game.winReason}.`}
            </p>
            <TableZone label="Winning table" cards={game.winner === 'draw' ? [] : game.players[game.winner].table} />
            <div className="btn-row">
              <button type="button" className="btn btn--primary" onClick={() => newGame()}>
                Play again
              </button>
              <button type="button" className="btn" onClick={() => setDismissedResult(true)}>
                View board
              </button>
              {STORE_URL && (
                <a className="btn btn--accent" href={STORE_URL} target="_blank" rel="noreferrer">
                  Get the physical game
                </a>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
