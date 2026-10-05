import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  flipCard,
  hideMismatch,
  isMemoryFinished,
  matchedPairs,
  MEMORY_LEVELS,
  newMemoryGame,
  type MemoryState,
} from '@/elder/games/memory';
import { createResultSender, elapsedSeconds } from '@/elder/games/results';
import { finishShowing, newSequenceGame, nextRound, pressPad, replay } from '@/elder/games/sequence';
import { chooseMove, newTicTacToeGame, playElder, playPhone, winningLine } from '@/elder/games/ticTacToe';
import { ApiError } from '@/lib/api/client';

/** A deterministic "random" that walks through the given values. */
const sequenceOf = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length] as number;
};

/** Indices of the two cards showing `symbol`. */
const pairOf = (state: MemoryState, symbol: number) =>
  state.cards.flatMap((card, index) => (card.symbol === symbol ? [index] : []));

describe('memory game', () => {
  it('deals each level as pairs of different pictures', () => {
    for (const { pairs } of Object.values(MEMORY_LEVELS)) {
      const game = newMemoryGame(pairs);
      expect(game.cards).toHaveLength(pairs * 2);
      const symbols = new Set(game.cards.map((c) => c.symbol));
      expect(symbols.size).toBe(pairs);
      for (const symbol of symbols) expect(pairOf(game, symbol)).toHaveLength(2);
    }
  });

  it('keeps a matching pair face up and counts the move', () => {
    let game = newMemoryGame(3);
    const [a, b] = pairOf(game, game.cards[0]!.symbol) as [number, number];
    game = flipCard(game, a);
    expect(game.faceUp).toEqual([a]);
    expect(game.moves).toBe(0);
    game = flipCard(game, b);
    expect(game.faceUp).toEqual([]);
    expect(game.moves).toBe(1);
    expect(matchedPairs(game)).toBe(1);
  });

  it('shows a mismatch until it is hidden, ignoring taps meanwhile', () => {
    let game = newMemoryGame(3);
    const first = 0;
    const other = game.cards.findIndex((c) => c.symbol !== game.cards[first]!.symbol);
    game = flipCard(flipCard(game, first), other);
    expect(game.faceUp).toEqual([first, other]);
    expect(game.moves).toBe(1);
    const third = game.cards.findIndex((_, i) => i !== first && i !== other);
    expect(flipCard(game, third)).toBe(game);
    game = hideMismatch(game);
    expect(game.faceUp).toEqual([]);
    expect(matchedPairs(game)).toBe(0);
  });

  it('ignores the card already up and matched cards, and finishes when all pairs are found', () => {
    let game = newMemoryGame(2);
    expect(flipCard(flipCard(game, 0), 0).faceUp).toEqual([0]);
    for (const symbol of new Set(game.cards.map((c) => c.symbol))) {
      const [a, b] = pairOf(game, symbol) as [number, number];
      game = flipCard(flipCard(game, a), b);
    }
    expect(isMemoryFinished(game)).toBe(true);
    expect(game.moves).toBe(2);
    expect(flipCard(game, 0)).toBe(game);
  });
});

describe('sequence game', () => {
  it('adds one colour per cleared round and remembers the longest', () => {
    let game = newSequenceGame(sequenceOf(0.1, 0.6));
    expect(game.sequence).toEqual([0]);
    expect(pressPad(game, 0)).toBe(game); // still showing
    game = finishShowing(game);
    game = pressPad(game, 0);
    expect(game).toMatchObject({ phase: 'cleared', longest: 1 });
    game = nextRound(game, sequenceOf(0.6));
    expect(game).toMatchObject({ sequence: [0, 2], phase: 'showing', progress: 0 });
    game = pressPad(pressPad(finishShowing(game), 0), 2);
    expect(game).toMatchObject({ phase: 'cleared', longest: 2 });
  });

  it('replays the sequence after the first mistake and ends at the second', () => {
    let game = finishShowing(newSequenceGame(sequenceOf(0.9)));
    game = pressPad(game, 0);
    expect(game).toMatchObject({ phase: 'retry', chancesLeft: 0 });
    game = finishShowing(replay(game));
    expect(game).toMatchObject({ phase: 'input', sequence: [3] });
    game = pressPad(game, 1);
    expect(game).toMatchObject({ phase: 'over', longest: 0 });
  });
});

describe('game results', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('elapsedSeconds stays within what the API accepts', () => {
    expect(elapsedSeconds(0, 400)).toBe(1);
    expect(elapsedSeconds(0, 95_400)).toBe(95);
    expect(elapsedSeconds(0, 5 * 3_600_000)).toBe(7_200);
  });

  it('retries a result on network trouble, but not one the API refused', async () => {
    const result = { game: 'sequence', longest: 3, durationSec: 40 } as const;
    const send = vi.fn().mockRejectedValueOnce(new ApiError('NETWORK', 'offline')).mockResolvedValue(undefined);
    createResultSender({ send, delaysMs: [1_000] }).record('elder-1', result);
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith('elder-1', result);

    const refused = vi.fn().mockRejectedValue(new ApiError('VALIDATION_ERROR', 'no', 400));
    createResultSender({ send: refused, delaysMs: [1_000] }).record('elder-1', result);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(refused).toHaveBeenCalledTimes(1);
  });
});

describe('jogo da velha', () => {
  const X = 'X' as const;
  const O = 'O' as const;
  const _ = null;

  it('alternates turns and ignores taps on taken squares or out of turn', () => {
    let game = newTicTacToeGame();
    game = playElder(game, 4);
    expect(game.board[4]).toBe('X');
    expect(game.turn).toBe('phone');
    expect(playElder(game, 0)).toBe(game);
    game = playPhone(game, 'easy', sequenceOf(0));
    expect(game.turn).toBe('elder');
    expect(game.board.filter((c) => c === 'O')).toHaveLength(1);
    const taken = game.board.findIndex((c) => c === 'O');
    expect(playElder(game, taken)).toBe(game);
  });

  it('ends with the winning line when the elder gets three in a row', () => {
    const game = playElder({ board: [X, X, _, O, O, _, _, _, _], turn: 'elder', outcome: null, line: null }, 2);
    expect(game).toMatchObject({ outcome: 'win', line: [0, 1, 2] });
    expect(playPhone(game, 'normal')).toBe(game);
  });

  it('calls a full board with no line a draw', () => {
    const game = playElder({ board: [X, O, X, X, O, O, O, X, _], turn: 'elder', outcome: null, line: null }, 8);
    expect(game).toMatchObject({ outcome: 'draw', line: null });
  });

  it('the phone takes a win on both levels, and blocks only on normal', () => {
    const canWin = [O, O, _, X, X, _, X, _, _];
    expect(chooseMove(canWin, 'easy', sequenceOf(0))).toBe(2);
    expect(chooseMove(canWin, 'normal')).toBe(2);
    const mustBlock = [X, X, _, _, O, _, _, _, _];
    expect(chooseMove(mustBlock, 'normal')).toBe(2);
    expect(chooseMove(mustBlock, 'easy', sequenceOf(0.99))).toBe(8);
    expect(winningLine(playPhone({ board: [O, O, _, X, X, _, X, _, _], turn: 'phone', outcome: null, line: null }, 'easy').board)).toMatchObject({ mark: 'O' });
  });

  it('on normal takes the centre first, then a corner', () => {
    expect(chooseMove([X, _, _, _, _, _, _, _, _], 'normal')).toBe(4);
    expect([2, 6, 8]).toContain(chooseMove([X, _, _, _, O, _, _, _, _], 'normal'));
  });
});
