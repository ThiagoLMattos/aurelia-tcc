import type { CrosswordPuzzle, CrosswordWord } from './crosswordPuzzles';

/**
 * Palavras Cruzadas without a keyboard: the elder picks a word (by its clue or by tapping the grid)
 * and fills it by tapping letter tiles, which hold exactly the letters still missing. A full word is
 * checked at once: right, it stays (and its letters help the words that cross it); wrong, the letters
 * go back to the tiles. "Dica" fills the next letter. Pure state, tested without a screen.
 */

export type Direction = 'across' | 'down';

export interface PlacedWord extends CrosswordWord {
  row: number;
  col: number;
  direction: Direction;
}

export interface CrosswordLayout {
  words: PlacedWord[];
  rows: number;
  cols: number;
}

/** "row,col", the key of one square. */
export const cellKey = (row: number, col: number) => `${row},${col}`;

export function cellsOf(word: Pick<PlacedWord, 'row' | 'col' | 'direction' | 'answer'>): string[] {
  return Array.from(word.answer, (_, i) =>
    word.direction === 'across' ? cellKey(word.row, word.col + i) : cellKey(word.row + i, word.col),
  );
}

/** Largest grid that still gives the elder big squares on a phone. */
export const MAX_GRID = 8;

/**
 * Places the words so each one crosses another, like a printed crossword: no two words touch side by
 * side, and a word never runs straight into another. It tries every order and spot (a puzzle has only a
 * handful of words) and keeps the most compact grid. Throws when the words cannot all be crossed.
 */
export function layoutCrossword(words: readonly CrosswordWord[]): CrosswordLayout {
  const sorted = [...words].sort((a, b) => b.answer.length - a.answer.length);
  const first = sorted[0];
  if (!first) return { words: [], rows: 0, cols: 0 };

  const grid = new Map<string, string>();
  const placed: PlacedWord[] = [];
  let best: { words: PlacedWord[]; score: number } | null = null;

  const size = () => {
    const keys = [...grid.keys()].map((key) => key.split(',').map(Number) as [number, number]);
    const rows = keys.map(([r]) => r);
    const cols = keys.map(([, c]) => c);
    return { rows: Math.max(...rows) - Math.min(...rows) + 1, cols: Math.max(...cols) - Math.min(...cols) + 1 };
  };
  const scoreOf = ({ rows, cols }: { rows: number; cols: number }) => Math.max(rows, cols) * 100 + rows * cols;

  const fits = (word: PlacedWord): boolean => {
    const [dr, dc] = word.direction === 'across' ? [0, 1] : [1, 0];
    const before = cellKey(word.row - dr, word.col - dc);
    const after = cellKey(word.row + dr * word.answer.length, word.col + dc * word.answer.length);
    if (grid.has(before) || grid.has(after)) return false;
    let crossings = 0;
    for (let i = 0; i < word.answer.length; i++) {
      const r = word.row + dr * i;
      const c = word.col + dc * i;
      const existing = grid.get(cellKey(r, c));
      if (existing !== undefined) {
        if (existing !== word.answer[i]) return false;
        // Two words on the same line would overlap, not cross.
        if (placed.some((p) => p.direction === word.direction && cellsOf(p).includes(cellKey(r, c)))) return false;
        crossings += 1;
        continue;
      }
      // A new letter must not sit right beside another word.
      if (grid.has(cellKey(r + dc, c + dr)) || grid.has(cellKey(r - dc, c - dr))) return false;
    }
    return crossings > 0;
  };

  const add = (word: PlacedWord): string[] => {
    const added = cellsOf(word).filter((key) => !grid.has(key));
    cellsOf(word).forEach((key, i) => grid.set(key, word.answer[i] as string));
    placed.push(word);
    return added;
  };
  const remove = (added: string[]) => {
    added.forEach((key) => grid.delete(key));
    placed.pop();
  };

  const search = (remaining: CrosswordWord[]) => {
    const current = size();
    if (Math.max(current.rows, current.cols) > MAX_GRID) return;
    if (best && scoreOf(current) >= best.score) return;
    if (remaining.length === 0) {
      best = { words: placed.slice(), score: scoreOf(current) };
      return;
    }
    remaining.forEach((candidate, index) => {
      const rest = remaining.filter((_, i) => i !== index);
      const tried = new Set<string>();
      for (const [key, letter] of [...grid]) {
        const [r, c] = key.split(',').map(Number) as [number, number];
        for (let i = 0; i < candidate.answer.length; i++) {
          if (candidate.answer[i] !== letter) continue;
          for (const direction of ['across', 'down'] as const) {
            const word: PlacedWord = {
              ...candidate,
              direction,
              row: direction === 'down' ? r - i : r,
              col: direction === 'across' ? c - i : c,
            };
            const id = `${direction}:${word.row}:${word.col}`;
            if (tried.has(id) || !fits(word)) continue;
            tried.add(id);
            const added = add(word);
            search(rest);
            remove(added);
          }
        }
      }
    });
  };

  add({ ...first, row: 0, col: 0, direction: 'across' });
  search(sorted.slice(1));
  const found = best as { words: PlacedWord[] } | null;
  if (!found) throw new Error(`Não foi possível montar a cruzadinha: ${words.map((w) => w.answer).join(', ')}`);

  const keys = found.words.flatMap((w) => cellsOf(w).map((key) => key.split(',').map(Number) as [number, number]));
  const minRow = Math.min(...keys.map(([r]) => r));
  const minCol = Math.min(...keys.map(([, c]) => c));
  const shifted = found.words.map((w) => ({ ...w, row: w.row - minRow, col: w.col - minCol }));
  // Reading order: top to bottom, then left to right, so the clues follow the grid.
  shifted.sort((a, b) => a.row - b.row || a.col - b.col);
  return {
    words: shifted,
    rows: Math.max(...keys.map(([r]) => r)) - minRow + 1,
    cols: Math.max(...keys.map(([, c]) => c)) - minCol + 1,
  };
}

export interface CrosswordState {
  layout: CrosswordLayout;
  /** Letters on the grid: solved words' letters, plus what the elder has put in the selected word. */
  letters: Record<string, string>;
  /** Squares that belong to a solved word; they cannot change any more. */
  locked: string[];
  solved: number[];
  selected: number;
  /** Tiles still to place in the selected word, in the order shown. */
  bank: string[];
  hints: number;
  /** Set right after a full word was checked, for the screen to say so; cleared by the next action. */
  feedback: 'right' | 'wrong' | null;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** The selected word's squares that are still empty, in order. */
export function openCells(state: CrosswordState, word = state.selected): string[] {
  const placed = state.layout.words[word];
  return placed ? cellsOf(placed).filter((key) => state.letters[key] === undefined) : [];
}

/** Clears what was typed into the selected word (not the locked letters) and deals its tiles again. */
function redeal(state: CrosswordState, selected: number, random: () => number): CrosswordState {
  const letters = { ...state.letters };
  const previous = state.layout.words[state.selected];
  if (previous && !state.solved.includes(state.selected)) {
    for (const key of cellsOf(previous)) if (!state.locked.includes(key)) delete letters[key];
  }
  const next = { ...state, letters, selected };
  const word = state.layout.words[selected];
  const missing = word ? cellsOf(word).flatMap((key, i) => (letters[key] === undefined ? [word.answer[i] as string] : [])) : [];
  return { ...next, bank: shuffle(missing, random) };
}

export function newCrosswordGame(puzzle: CrosswordPuzzle, random: () => number = Math.random): CrosswordState {
  const layout = layoutCrossword(puzzle.words);
  const empty: CrosswordState = { layout, letters: {}, locked: [], solved: [], selected: 0, bank: [], hints: 0, feedback: null };
  return redeal(empty, 0, random);
}

export const isCrosswordFinished = (state: CrosswordState) => state.solved.length === state.layout.words.length;

/** The next unsolved word after `from`, going round; null when all are solved. */
function nextUnsolved(state: CrosswordState, from: number): number | null {
  const total = state.layout.words.length;
  for (let step = 1; step <= total; step++) {
    const index = (from + step) % total;
    if (!state.solved.includes(index)) return index;
  }
  return null;
}

export function selectWord(state: CrosswordState, index: number, random: () => number = Math.random): CrosswordState {
  if (index === state.selected || !state.layout.words[index] || state.solved.includes(index)) return state;
  return { ...redeal(state, index, random), feedback: null };
}

/** Moves to the next (or previous) unsolved word. */
export function stepWord(state: CrosswordState, direction: 1 | -1, random: () => number = Math.random): CrosswordState {
  const total = state.layout.words.length;
  for (let step = 1; step < total; step++) {
    const index = (state.selected + direction * step + total * step) % total;
    if (!state.solved.includes(index)) return selectWord(state, index, random);
  }
  return state;
}

/** Tapping a square selects an unsolved word through it; tapping it again switches to the crossing word. */
export function tapCell(state: CrosswordState, key: string, random: () => number = Math.random): CrosswordState {
  const through = state.layout.words.flatMap((word, index) =>
    cellsOf(word).includes(key) && !state.solved.includes(index) ? [index] : [],
  );
  if (through.length === 0) return state;
  const current = through.indexOf(state.selected);
  const next = current === -1 ? through[0] : through[(current + 1) % through.length];
  return next === undefined ? state : selectWord(state, next, random);
}

/** A full word is checked: right locks it and moves on; wrong deals its letters back. */
function check(state: CrosswordState, random: () => number): CrosswordState {
  const word = state.layout.words[state.selected];
  if (!word || openCells(state).length > 0) return state;
  const cells = cellsOf(word);
  const right = cells.every((key, i) => state.letters[key] === word.answer[i]);
  if (!right) return { ...redeal(state, state.selected, random), feedback: 'wrong' };
  const solvedState: CrosswordState = {
    ...state,
    locked: [...new Set([...state.locked, ...cells])],
    solved: [...state.solved, state.selected],
    feedback: 'right',
  };
  const next = nextUnsolved(solvedState, state.selected);
  if (next === null) return { ...solvedState, bank: [] };
  return { ...redeal(solvedState, next, random), feedback: 'right' };
}

/** Puts the tile at `bankIndex` into the selected word's first empty square. */
export function placeTile(state: CrosswordState, bankIndex: number, random: () => number = Math.random): CrosswordState {
  const letter = state.bank[bankIndex];
  const target = openCells(state)[0];
  if (letter === undefined || target === undefined) return state;
  const next: CrosswordState = {
    ...state,
    letters: { ...state.letters, [target]: letter },
    bank: state.bank.filter((_, i) => i !== bankIndex),
    feedback: null,
  };
  return check(next, random);
}

/** Takes back the last letter the elder placed in the selected word. */
export function eraseLetter(state: CrosswordState): CrosswordState {
  const word = state.layout.words[state.selected];
  if (!word) return state;
  const typed = cellsOf(word).filter((key) => state.letters[key] !== undefined && !state.locked.includes(key));
  const last = typed.at(-1);
  if (last === undefined) return state;
  const letters = { ...state.letters };
  const letter = letters[last] as string;
  delete letters[last];
  return { ...state, letters, bank: [...state.bank, letter], feedback: null };
}

/**
 * Fills the selected word's next empty square with the right letter. A wrong letter already placed
 * earlier in the word is taken back first, so the hint always makes progress.
 */
export function giveHint(state: CrosswordState, random: () => number = Math.random): CrosswordState {
  const word = state.layout.words[state.selected];
  if (!word) return state;
  const cells = cellsOf(word);
  let current = state;
  const wrongAt = cells.findIndex((key, i) => !state.locked.includes(key) && state.letters[key] !== undefined && state.letters[key] !== word.answer[i]);
  if (wrongAt !== -1) {
    current = redeal(state, state.selected, random);
    for (let i = 0; i < wrongAt; i++) {
      const key = cells[i] as string;
      const letter = state.letters[key];
      if (letter !== undefined && current.letters[key] === undefined) {
        const tile = current.bank.indexOf(letter);
        current = { ...current, letters: { ...current.letters, [key]: letter }, bank: current.bank.filter((_, j) => j !== tile) };
      }
    }
  }
  const index = cells.findIndex((key) => current.letters[key] === undefined);
  if (index === -1) return state;
  const letter = word.answer[index] as string;
  const tile = current.bank.indexOf(letter);
  const next: CrosswordState = {
    ...current,
    letters: { ...current.letters, [cells[index] as string]: letter },
    bank: current.bank.filter((_, i) => i !== tile),
    hints: state.hints + 1,
    feedback: null,
  };
  return check(next, random);
}
