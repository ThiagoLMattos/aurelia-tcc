import { z } from 'zod';

import { IdSchema } from './primitives';

/** The memory games on the elder's phone. */
export const GameIdSchema = z.enum(['memory', 'sequence']);
export type GameId = z.infer<typeof GameIdSchema>;

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

const enoughMoves = (result: { game: GameId; pairs?: number | undefined; moves?: number | undefined }) =>
  result.game !== 'memory' || (result.moves ?? 0) >= (result.pairs ?? 0);
const enoughMovesMessage = { message: 'Cada par precisa de ao menos uma jogada.', path: ['moves'] };

/** What a finished game stores in the timeline (`gamePlayed` event). */
export const GamePlayedPayloadSchema = z
  .discriminatedUnion('game', [z.object(memoryFields), z.object(sequenceFields)])
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
    durationSec: DurationSecSchema,
  })
  .superRefine((body, ctx) => {
    const fields = body.game === 'memory' ? ['pairs', 'moves'] : ['longest'];
    const others = body.game === 'memory' ? ['longest'] : ['pairs', 'moves'];
    for (const field of fields) {
      if (body[field as keyof typeof body] === undefined) ctx.addIssue({ code: 'custom', message: 'Campo obrigatório.', path: [field] });
    }
    for (const field of others) {
      if (body[field as keyof typeof body] !== undefined) ctx.addIssue({ code: 'custom', message: 'Campo de outro jogo.', path: [field] });
    }
    if (!enoughMoves(body)) ctx.addIssue({ code: 'custom', ...enoughMovesMessage });
  })
  .transform((body): GamePlayedPayload =>
    body.game === 'memory'
      ? { game: 'memory', pairs: body.pairs as number, moves: body.moves as number, durationSec: body.durationSec }
      : { game: 'sequence', longest: body.longest as number, durationSec: body.durationSec },
  );
export type GameResultBody = z.input<typeof GameResultBodySchema>;

export const GameResultResponseSchema = z.object({ eventId: IdSchema });
export type GameResultResponse = z.infer<typeof GameResultResponseSchema>;

/** Share of turns that found a pair, as a whole percentage: 100 means no card was turned in vain. */
export function memoryAccuracyPct(result: { pairs: number; moves: number }): number {
  return Math.round((result.pairs / Math.max(result.moves, result.pairs)) * 100);
}
