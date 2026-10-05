import { GameResultResponseSchema } from '@aurelia/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { bearer, buildApp, createScenario, expectApiError, fixedClock } from './helpers';

const now = fixedClock();
const app = buildApp({ now });

describe('POST /elders/:elderId/games', () => {
  it('stores a finished game in the timeline and the weekly report', async () => {
    const { elderId, elderToken, caregiver } = await createScenario();
    const path = `/api/v1/elders/${elderId}/games`;

    const memory = await request(app).post(path).set(bearer(elderToken)).send({ game: 'memory', pairs: 6, moves: 8, durationSec: 150 });
    expect(memory.status).toBe(201);
    const { eventId } = GameResultResponseSchema.parse(memory.body);
    const sequence = await request(app).post(path).set(bearer(elderToken)).send({ game: 'sequence', longest: 4, durationSec: 90 });
    expect(sequence.status).toBe(201);
    const ticTacToe = await request(app)
      .post(path)
      .set(bearer(elderToken))
      .send({ game: 'tictactoe', level: 'normal', outcome: 'win', durationSec: 40 });
    expect(ticTacToe.status).toBe(201);
    const crossword = await request(app)
      .post(path)
      .set(bearer(elderToken))
      .send({ game: 'crossword', theme: 'Frutas', words: 3, totalWords: 5, hints: 1, durationSec: 200 });
    expect(crossword.status).toBe(201);

    const timeline = await request(app).get(`/api/v1/elders/${elderId}/events?types=gamePlayed`).set(bearer(caregiver.token));
    expect(timeline.body.items).toHaveLength(4);
    expect(timeline.body.items.find((e: { id: string }) => e.id === eventId)).toMatchObject({
      type: 'gamePlayed',
      at: now().toISOString(),
      payload: { game: 'memory', pairs: 6, moves: 8, durationSec: 150 },
    });

    const report = await request(app).get(`/api/v1/elders/${elderId}/reports/weekly`).set(bearer(caregiver.token));
    expect(report.body.games).toEqual({
      sessions: 4,
      minutes: 8,
      memory: { played: 1, bestAccuracyPct: 75, mostPairs: 6 },
      sequence: { played: 1, best: 4 },
      ticTacToe: { played: 1, wins: 1, draws: 0 },
      crossword: { played: 1, completed: 0, words: 3, hints: 1 },
    });
  });

  it('is elder-only and refuses results that do not fit the game', async () => {
    const { elderId, elderToken, caregiver, otherElderToken } = await createScenario();
    const path = `/api/v1/elders/${elderId}/games`;
    const valid = { game: 'sequence', longest: 2, durationSec: 30 };
    expectApiError(await request(app).post(path).set(bearer(caregiver.token)).send(valid), 403, 'FORBIDDEN');
    expectApiError(await request(app).post(path).set(bearer(otherElderToken)).send(valid), 403, 'FORBIDDEN');
    expectApiError(await request(app).post(path).send(valid), 401, 'UNAUTHENTICATED');
    expectApiError(await request(app).post(path).set(bearer(elderToken)).send({ game: 'memory', pairs: 6, durationSec: 30 }), 400, 'VALIDATION_ERROR');
    expectApiError(await request(app).post(path).set(bearer(elderToken)).send({ ...valid, extra: 1 }), 400, 'VALIDATION_ERROR');
  });
});
