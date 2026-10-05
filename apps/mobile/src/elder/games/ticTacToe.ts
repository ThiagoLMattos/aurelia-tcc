import type { TicTacToeLevel, TicTacToeOutcome } from '@aurelia/shared';

/**
 * Jogo da Velha against the phone. The elder is always X and always starts. On "Fácil" the phone only
 * takes a win it can see; on "Normal" it also blocks and likes the centre, but it is beatable (it does
 * not see forks). Pure state, so the rules are tested without a screen.
 */

export type Mark = 'X' | 'O';
export type Cell = Mark | null;

export const ELDER: Mark = 'X';
export const PHONE: Mark = 'O';

export const TIC_TAC_TOE_LEVELS: Record<TicTacToeLevel, { label: string; hint: string }> = {
  easy: { label: 'FÁCIL', hint: 'O celular joga sem pressa.' },
  normal: { label: 'NORMAL', hint: 'O celular tenta bloquear você.' },
};

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

export interface TicTacToeState {
  board: Cell[];
  turn: 'elder' | 'phone';
  /** Set when the game is over, from the elder's side. */
  outcome: TicTacToeOutcome | null;
  /** The three winning squares, to highlight them. */
  line: readonly number[] | null;
}

export function newTicTacToeGame(): TicTacToeState {
  return { board: Array<Cell>(9).fill(null), turn: 'elder', outcome: null, line: null };
}

export function winningLine(board: readonly Cell[]): { mark: Mark; line: readonly number[] } | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    const mark = board[a];
    if (mark && mark === board[b] && mark === board[c]) return { mark, line };
  }
  return null;
}

const emptyCells = (board: readonly Cell[]) => board.flatMap((cell, index) => (cell === null ? [index] : []));

/** Ends the game when someone has three in a row or the board is full; otherwise passes the turn. */
function settle(state: TicTacToeState, board: Cell[], mover: 'elder' | 'phone'): TicTacToeState {
  const won = winningLine(board);
  if (won) return { board, turn: mover, outcome: won.mark === ELDER ? 'win' : 'loss', line: won.line };
  if (emptyCells(board).length === 0) return { board, turn: mover, outcome: 'draw', line: null };
  return { ...state, board, turn: mover === 'elder' ? 'phone' : 'elder' };
}

/** The elder marks a square. Ignored when it is not their turn, the game is over, or the square is taken. */
export function playElder(state: TicTacToeState, index: number): TicTacToeState {
  if (state.outcome || state.turn !== 'elder' || state.board[index] !== null || index < 0 || index > 8) return state;
  const board = state.board.slice();
  board[index] = ELDER;
  return settle(state, board, 'elder');
}

/** A square that completes a line of `mark`, if there is one. */
function completing(board: readonly Cell[], mark: Mark): number | null {
  for (const line of LINES) {
    const marks = line.map((i) => board[i]);
    if (marks.filter((m) => m === mark).length === 2) {
      const empty = line.find((i) => board[i] === null);
      if (empty !== undefined) return empty;
    }
  }
  return null;
}

export function chooseMove(board: readonly Cell[], level: TicTacToeLevel, random: () => number = Math.random): number {
  const empty = emptyCells(board);
  const pick = (cells: number[]) => cells[Math.floor(random() * cells.length)] as number;
  const win = completing(board, PHONE);
  if (win !== null) return win;
  if (level === 'easy') return pick(empty);
  const block = completing(board, ELDER);
  if (block !== null) return block;
  if (board[4] === null) return 4;
  const corners = [0, 2, 6, 8].filter((i) => board[i] === null);
  return pick(corners.length > 0 ? corners : empty);
}

/** The phone's move. Ignored unless it is the phone's turn. */
export function playPhone(state: TicTacToeState, level: TicTacToeLevel, random: () => number = Math.random): TicTacToeState {
  if (state.outcome || state.turn !== 'phone') return state;
  const board = state.board.slice();
  board[chooseMove(board, level, random)] = PHONE;
  return settle(state, board, 'phone');
}
