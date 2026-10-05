import { describe, expect, it } from 'vitest';

import {
  cellKey,
  cellsOf,
  eraseLetter,
  giveHint,
  isCrosswordFinished,
  layoutCrossword,
  MAX_GRID,
  newCrosswordGame,
  openCells,
  placeTile,
  stepWord,
  tapCell,
  type CrosswordState,
} from '@/elder/games/crossword';
import { CROSSWORD_PUZZLES } from '@/elder/games/crosswordPuzzles';

const noShuffle = () => 0.999;

/** Places the selected word's letters in the right order from its tiles. */
function solveSelected(state: CrosswordState): CrosswordState {
  let current = state;
  const word = current.layout.words[current.selected]!;
  const selected = current.selected;
  for (const key of openCells(current)) {
    const letter = word.answer[cellsOf(word).indexOf(key)]!;
    current = placeTile(current, current.bank.indexOf(letter), noShuffle);
    if (current.selected !== selected) break;
  }
  return current;
}

describe('crossword puzzles', () => {
  it.each(CROSSWORD_PUZZLES.map((p) => [p.theme, p] as const))('%s lays out as a real crossword that fits a phone', (_theme, puzzle) => {
    const layout = layoutCrossword(puzzle.words);
    expect(layout.words).toHaveLength(puzzle.words.length);
    expect(layout.rows).toBeLessThanOrEqual(MAX_GRID);
    expect(layout.cols).toBeLessThanOrEqual(MAX_GRID);
    const grid = new Map<string, string>();
    for (const word of layout.words) {
      expect(word.answer).toMatch(/^[A-Z]+$/);
      cellsOf(word).forEach((key, i) => {
        const letter = word.answer[i]!;
        if (grid.has(key)) expect(grid.get(key)).toBe(letter);
        grid.set(key, letter);
      });
    }
    // Every word crosses at least one other.
    for (const word of layout.words) {
      const others = layout.words.filter((w) => w !== word).flatMap(cellsOf);
      expect(cellsOf(word).some((key) => others.includes(key))).toBe(true);
    }
  });
});

describe('crossword game', () => {
  const puzzle = CROSSWORD_PUZZLES[0]!;

  it('deals exactly the selected word’s letters as tiles', () => {
    const game = newCrosswordGame(puzzle, noShuffle);
    const word = game.layout.words[game.selected]!;
    expect([...game.bank].sort()).toEqual([...word.answer].sort());
  });

  it('a right word locks, helps the crossing words, and moves on', () => {
    let game = newCrosswordGame(puzzle, noShuffle);
    const first = game.selected;
    game = solveSelected(game);
    expect(game.solved).toEqual([first]);
    expect(game.feedback).toBe('right');
    expect(game.selected).not.toBe(first);
    const crossing = game.layout.words.findIndex(
      (w, i) => i !== first && cellsOf(w).some((key) => cellsOf(game.layout.words[first]!).includes(key)),
    );
    game = stepWord(game, 1, noShuffle);
    while (game.selected !== crossing) game = stepWord(game, 1, noShuffle);
    const word = game.layout.words[crossing]!;
    expect(game.bank.length).toBeLessThan(word.answer.length);
  });

  it('a wrong word goes back to the tiles', () => {
    let game = newCrosswordGame(puzzle, () => 0);
    const word = game.layout.words[game.selected]!;
    // Place the tiles in reverse alphabetical order: wrong unless the word is a palindrome of them.
    const order = [...game.bank].sort().reverse();
    for (const letter of order) game = placeTile(game, game.bank.indexOf(letter), () => 0);
    if ([...order].join('') !== word.answer) {
      expect(game.feedback).toBe('wrong');
      expect(openCells(game)).toHaveLength(word.answer.length);
      expect(game.bank).toHaveLength(word.answer.length);
    }
  });

  it('erase gives the last letter back', () => {
    let game = newCrosswordGame(puzzle, noShuffle);
    game = placeTile(game, 0, noShuffle);
    const letter = Object.values(game.letters)[0];
    game = eraseLetter(game);
    expect(Object.keys(game.letters)).toHaveLength(0);
    expect(game.bank).toContain(letter);
  });

  it('a hint fills the next letter right, even after a wrong one', () => {
    let game = newCrosswordGame(puzzle, noShuffle);
    const word = game.layout.words[game.selected]!;
    const wrongTile = game.bank.findIndex((letter) => letter !== word.answer[0]);
    game = placeTile(game, wrongTile, noShuffle);
    game = giveHint(game, noShuffle);
    expect(game.hints).toBe(1);
    expect(game.letters[cellsOf(word)[0]!]).toBe(word.answer[0]);
    expect(Object.keys(game.letters)).toHaveLength(1);
  });

  it('hints alone finish the puzzle', () => {
    let game = newCrosswordGame(puzzle, noShuffle);
    for (let i = 0; i < 100 && !isCrosswordFinished(game); i++) game = giveHint(game, noShuffle);
    expect(isCrosswordFinished(game)).toBe(true);
    expect(game.hints).toBeGreaterThan(0);
  });

  it('tapping a crossing square switches between its two words', () => {
    const game = newCrosswordGame(puzzle, noShuffle);
    const [a, b] = game.layout.words;
    const shared = cellsOf(a!).find((key) => game.layout.words.slice(1).some((w) => cellsOf(w).includes(key)));
    expect(shared).toBeDefined();
    const once = tapCell(game, shared!, noShuffle);
    const twice = tapCell(once, shared!, noShuffle);
    expect(once.selected).not.toBe(twice.selected);
    expect(tapCell(game, cellKey(99, 99))).toBe(game);
    void b;
  });
});
