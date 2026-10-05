/**
 * Memória Sequencial (like the old Genius toy): the phone lights up a sequence of colours, the elder
 * repeats it, and each round adds one colour. The first mistake only replays the same sequence; the
 * second ends the game. Pure state; the screen drives the timing.
 */

export const SEQUENCE_PADS = [
  { key: 'green', label: 'VERDE', color: '#2D7A3A', lit: '#7FD68D' },
  { key: 'red', label: 'VERMELHO', color: '#A32D2D', lit: '#F08A8A' },
  { key: 'yellow', label: 'AMARELO', color: '#B07A00', lit: '#FFD45C' },
  { key: 'blue', label: 'AZUL', color: '#185FA5', lit: '#7DB8F0' },
] as const;

/** The contract's ceiling; nobody is expected to get near it. */
export const MAX_SEQUENCE = 99;

/**
 * - `showing`: the phone is playing the sequence (taps ignored).
 * - `input`: the elder repeats it.
 * - `cleared`: the round was right; the screen pauses, then calls `nextRound`.
 * - `retry`: first mistake; the screen pauses, then calls `replay`.
 * - `over`: second mistake (or the ceiling); `longest` is the result.
 */
export type SequencePhase = 'showing' | 'input' | 'cleared' | 'retry' | 'over';

export interface SequenceState {
  sequence: number[];
  phase: SequencePhase;
  /** How many of the sequence the elder has repeated this round. */
  progress: number;
  /** Longest sequence repeated without a mistake. */
  longest: number;
  chancesLeft: number;
}

const randomPad = (random: () => number) => Math.floor(random() * SEQUENCE_PADS.length);

export function newSequenceGame(random: () => number = Math.random): SequenceState {
  return { sequence: [randomPad(random)], phase: 'showing', progress: 0, longest: 0, chancesLeft: 1 };
}

/** The phone finished playing the sequence: the elder's turn. */
export function finishShowing(state: SequenceState): SequenceState {
  return state.phase === 'showing' ? { ...state, phase: 'input', progress: 0 } : state;
}

export function pressPad(state: SequenceState, pad: number): SequenceState {
  if (state.phase !== 'input') return state;
  if (state.sequence[state.progress] !== pad) {
    return state.chancesLeft > 0
      ? { ...state, phase: 'retry', chancesLeft: state.chancesLeft - 1 }
      : { ...state, phase: 'over' };
  }
  const progress = state.progress + 1;
  if (progress < state.sequence.length) return { ...state, progress };
  const longest = Math.max(state.longest, state.sequence.length);
  return { ...state, progress, longest, phase: state.sequence.length >= MAX_SEQUENCE ? 'over' : 'cleared' };
}

/** After a cleared round: one colour more. */
export function nextRound(state: SequenceState, random: () => number = Math.random): SequenceState {
  if (state.phase !== 'cleared') return state;
  return { ...state, sequence: [...state.sequence, randomPad(random)], phase: 'showing', progress: 0 };
}

/** After the first mistake: the same sequence again. */
export function replay(state: SequenceState): SequenceState {
  return state.phase === 'retry' ? { ...state, phase: 'showing', progress: 0 } : state;
}
