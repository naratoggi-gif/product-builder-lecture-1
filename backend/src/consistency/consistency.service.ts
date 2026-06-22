import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../shared/database.service';

@Injectable()
export class ConsistencyService {
  constructor(private readonly db: DatabaseService) {}

  async getState(userId: number) {
    const state = await this.db.query<{
      userId: number;
      currentStreakDays: number;
      bestStreakDays: number;
      executionRate14d: number;
      consistencyScore: number;
      streakRecoverTokens: number;
      updatedAt: string;
    }>(
      `SELECT
         user_id AS "userId",
         current_streak_days AS "currentStreakDays",
         best_streak_days AS "bestStreakDays",
         execution_rate_14d::float8 AS "executionRate14d",
         consistency_score AS "consistencyScore",
         streak_recover_tokens AS "streakRecoverTokens",
         updated_at AS "updatedAt"
       FROM consistency_states
       WHERE user_id = $1`,
      [userId],
    );

    if (!state.rowCount) throw new NotFoundException('Consistency state not found.');
    return state.rows[0];
  }

  async recover(userId: number) {
    return this.db.withTransaction(async (client) => {
      const state = await client.query<{
        current_streak_days: number;
        best_streak_days: number;
        execution_rate_14d: number;
        streak_recover_tokens: number;
      }>(
        `SELECT current_streak_days, best_streak_days, execution_rate_14d, streak_recover_tokens
         FROM consistency_states
         WHERE user_id = $1
         FOR UPDATE`,
        [userId],
      );

      if (!state.rowCount) throw new NotFoundException('Consistency state not found.');

      const current = state.rows[0];
      if (current.streak_recover_tokens <= 0) {
        throw new BadRequestException('No recover token available.');
      }

      const streak = current.current_streak_days + 1;
      const best = Math.max(current.best_streak_days, streak);
      const streakFactor = Math.min(streak / 14, 1);
      const score = Math.round(Number(current.execution_rate_14d) * 70 + streakFactor * 30);

      const updated = await client.query<{
        userId: number;
        currentStreakDays: number;
        bestStreakDays: number;
        executionRate14d: number;
        consistencyScore: number;
        streakRecoverTokens: number;
        updatedAt: string;
      }>(
        `UPDATE consistency_states
         SET
           streak_recover_tokens = streak_recover_tokens - 1,
           current_streak_days = $2,
           best_streak_days = $3,
           consistency_score = $4,
           last_streak_updated_at = NOW(),
           updated_at = NOW()
         WHERE user_id = $1
         RETURNING
           user_id AS "userId",
           current_streak_days AS "currentStreakDays",
           best_streak_days AS "bestStreakDays",
           execution_rate_14d::float8 AS "executionRate14d",
           consistency_score AS "consistencyScore",
           streak_recover_tokens AS "streakRecoverTokens",
           updated_at AS "updatedAt"`,
        [userId, streak, best, score],
      );

      return updated.rows[0];
    });
  }
}
