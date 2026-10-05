import { z } from 'zod';

import { IdSchema } from './primitives';

/** The games on the elder's phone. */
export const GameIdSchema = z.enum(['memory', 'sequence', 'tictactoe']);
export type GameId = z.infer<typeof GameIdSchema>;

/** How hard the phone plays Jogo da Velha. */
export const TicTacToeLevelSchema = z.enum(['easy', 'normal']);
export type TicTacToeLevel = z.infer<typeof TicTacToeLevelSchema>;

/** How a Jogo da Velha ended, from the elder's side. */
export const TicTacToeOutcomeSchema = z.enum(['win', 'draw', 'loss']);
export type TicTacToeOutcome = z.infer<typeof TicTacToeOutcomeSchema>;

/** Longest a single game may report (2 h); anything above is a clock left running, not play. */
const DurationSecSchema = z.number().int().min(1).max(7_200);

const memoryFields = {
  game: z.literal('memory'),
  /** Pairs on the board (the difficulty). */
  pairs: z.number().int().min(2).max(12),
  /** Times two cards were turned over, the matching ones included. */
  moves: z.number().int().min(1).max(999),
  durationSec: DurationSecSchema,
};

const sequenceFields = {
  game: z.literal('sequence'),
  /** Longest sequence of colours repeated without a mistake (0 when not even the first one). */
  longest: z.number().int().min(0).max(99),
  durationSec: DurationSecSchema,
};

const ticTacToeFields = {
  game: z.literal('tictactoe'),
  level: TicTacToeLevelSchema,
  outcome: TicTacToeOutcomeSchema,
  durationSec: DurationSecSchema,
};

/** The fields each game sends besides `game` and `durationSec`. */
const GAME_FIELDS = {
  memory: ['pairs', 'moves'],
  sequence: ['longest'],
  tictactoe: ['level', 'outcome'],
} as const satisfies Record<GameId, readonly string[]>;
const ALL_FIELDS = Object.values(GAME_FIELDS).flat();

const enoughMoves = (result: { game: GameId; pairs?: number | undefined; moves?: number | undefined }) =>
  result.game !== 'memory' || (result.moves ?? 0) >= (result.pairs ?? 0);
const enoughMovesMessage = { message: 'Cada par precisa de ao menos uma jogada.', path: ['moves'] };

/** What a finished game stores in the timeline (`gamePlayed` event). */
export const GamePlayedPayloadSchema = z
  .discriminatedUnion('game', [z.object(memoryFields), z.object(sequenceFields), z.object(ticTacToeFields)])
  .refine(enoughMoves, enoughMovesMessage);
export type GamePlayedPayload = z.infer<typeof GamePlayedPayloadSchema>;

/**
 * POST /elders/:elderId/games — sent by the elder's phone when a game ends. Flat and strict (unknown
 * keys are refused like every other body); it comes out as the payload stored in the timeline.
 */
export const GameResultBodySchema = z
  .strictObject({
    game: GameIdSchema,
    pairs: memoryFields.pairs.optional(),
    moves: memoryFields.moves.optional(),
    longest: sequenceFields.longest.optional(),
    level: ticTacToeFields.level.optional(),
    outcome: ticTacToeFields.outcome.optional(),
    durationSec: DurationSecSchema,
  })
  .superRefine((body, ctx) => {
    const own: readonly string[] = GAME_FIELDS[body.game];
    for (const field of ALL_FIELDS) {
      const present = body[field] !== undefined;
      if (own.includes(field) && !present) ctx.addIssue({ code: 'custom', message: 'Campo obrigatório.', path: [field] });
      if (!own.includes(field) && present) ctx.addIssue({ code: 'custom', message: 'Campo de outro jogo.', path: [field] });
    }
    if (!enoughMoves(body)) ctx.addIssue({ code: 'custom', ...enoughMovesMessage });
  })
  .transform((body): GamePlayedPayload => {
    const { durationSec } = body;
    switch (body.game) {
      case 'memory':
        return { game: 'memory', pairs: body.pairs as number, moves: body.moves as number, durationSec };
      case 'sequence':
        return { game: 'sequence', longest: body.longest as number, durationSec };
      case 'tictactoe':
        return { game: 'tictactoe', level: body.level as TicTacToeLevel, outcome: body.outcome as TicTacToeOutcome, durationSec };
    }
  });
export type GameResultBody = z.input<typeof GameResultBodySchema>;

export const GameResultResponseSchema = z.object({ eventId: IdSchema });
export type GameResultResponse = z.infer<typeof GameResultResponseSchema>;

/** Share of turns that found a pair, as a whole percentage: 100 means no card was turned in vain. */
export function memoryAccuracyPct(result: { pairs: number; moves: number }): number {
  return Math.round((result.pairs / Math.max(result.moves, result.pairs)) * 100);
}
