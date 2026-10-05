/**
 * Jogo da Memória: pairs of familiar pictures face down; two are turned per move. Pure state, so the
 * rules are tested without a screen. The screen hides a mismatched pair after a pause (`hideMismatch`).
 */

export interface MemorySymbol {
  emoji: string;
  /** Read by the screen reader instead of the picture. */
  name: string;
}

/** Everyday things, easy to recognise and to name. */
export const MEMORY_SYMBOLS: readonly MemorySymbol[] = [
  { emoji: '🍎', name: 'maçã' },
  { emoji: '🌻', name: 'girassol' },
  { emoji: '🐶', name: 'cachorro' },
  { emoji: '🐱', name: 'gato' },
  { emoji: '🏠', name: 'casa' },
  { emoji: '☀️', name: 'sol' },
  { emoji: '🎈', name: 'balão' },
  { emoji: '🐟', name: 'peixe' },
  { emoji: '⭐', name: 'estrela' },
  { emoji: '🌙', name: 'lua' },
  { emoji: '🚗', name: 'carro' },
  { emoji: '☕', name: 'café' },
];

export type MemoryLevel = 'easy' | 'medium' | 'hard';

export const MEMORY_LEVELS: Record<MemoryLevel, { label: string; pairs: number; columns: number }> = {
  easy: { label: 'FÁCIL', pairs: 3, columns: 3 },
  medium: { label: 'MÉDIO', pairs: 6, columns: 3 },
  hard: { label: 'DIFÍCIL', pairs: 8, columns: 4 },
};

export interface MemoryCard {
  id: number;
  /** Index into MEMORY_SYMBOLS; the two cards of a pair share it. */
  symbol: number;
  matched: boolean;
}

export interface MemoryState {
  cards: MemoryCard[];
  /** Cards turned up and not yet matched: none, one, or a mismatched pair waiting to be hidden. */
  faceUp: number[];
  moves: number;
}

/** Fisher–Yates; `random` is injectable for tests. */
function shuffle<T>(items: T[], random: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export function newMemoryGame(pairs: number, random: () => number = Math.random): MemoryState {
  const symbols = shuffle(MEMORY_SYMBOLS.map((_, index) => index), random).slice(0, pairs);
  const cards = shuffle([...symbols, ...symbols], random).map((symbol, id) => ({ id, symbol, matched: false }));
  return { cards, faceUp: [], moves: 0 };
}

/** True while a mismatched pair is showing: taps wait until it is hidden. */
export const isShowingMismatch = (state: MemoryState) => state.faceUp.length === 2;

/** Turns a card. Ignored for matched cards, the card already up, or while a mismatch is showing. */
export function flipCard(state: MemoryState, index: number): MemoryState {
  const card = state.cards[index];
  if (!card || card.matched || state.faceUp.includes(index) || isShowingMismatch(state)) return state;
  if (state.faceUp.length === 0) return { ...state, faceUp: [index] };

  const first = state.faceUp[0] as number;
  const moves = state.moves + 1;
  if (state.cards[first]?.symbol !== card.symbol) return { ...state, faceUp: [first, index], moves };
  return {
    cards: state.cards.map((c, i) => (i === first || i === index ? { ...c, matched: true } : c)),
    faceUp: [],
    moves,
  };
}

export function hideMismatch(state: MemoryState): MemoryState {
  return isShowingMismatch(state) ? { ...state, faceUp: [] } : state;
}

export const matchedPairs = (state: MemoryState) => state.cards.filter((c) => c.matched).length / 2;
export const isMemoryFinished = (state: MemoryState) => state.cards.every((c) => c.matched);
