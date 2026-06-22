import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../shared/database.service';
import { calculateStepReward, difficultyForSeconds, gradeForSeconds, shrinkStep } from '../stepquest/stepquest.domain';

interface MicroActionRow {
  id: number;
  userId: number;
  weeklyMissionId: number;
  title: string;
  estimatedSeconds: number;
  difficulty: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

@Injectable()
export class ActionsService {
  private readonly dailyGoalCoinCap = 120;

  constructor(private readonly db: DatabaseService) {}

  async getNextMicro(userId: number) {
    const next = await this.db.query<MicroActionRow>(
      `SELECT
         id,
         user_id AS "userId",
         weekly_mission_id AS "weeklyMissionId",
         title,
         estimated_seconds AS "estimatedSeconds",
         difficulty,
         status,
         created_at AS "createdAt",
         completed_at AS "completedAt"
       FROM micro_actions
       WHERE user_id = $1 AND status = 'OPEN'
       ORDER BY id ASC
       LIMIT 1`,
      [userId],
    );

    if (!next.rowCount) {
      throw new NotFoundException('No open micro action found.');
    }

    return next.rows[0];
  }

  async completeMicro(userId: number, microId: number) {
    return this.db.withTransaction(async (client) => {
      const microResult = await client.query<{
        id: number;
        weekly_mission_id: number;
        title: string;
        estimated_seconds: number;
        status: string;
      }>(
        `SELECT id, weekly_mission_id, title, estimated_seconds, status
         FROM micro_actions
         WHERE id = $1 AND user_id = $2
         FOR UPDATE`,
        [microId, userId],
      );

      if (!microResult.rowCount || microResult.rows[0].status !== 'OPEN') {
        throw new NotFoundException('Open micro action not found.');
      }

      const micro = microResult.rows[0];

      await client.query(
        `UPDATE micro_actions
         SET status = 'DONE', completed_at = NOW()
         WHERE id = $1`,
        [micro.id],
      );

      await client.query(
        `INSERT INTO micro_action_logs (micro_action_id, user_id, result, executed_at)
         VALUES ($1, $2, 'DONE', NOW())`,
        [micro.id, userId],
      );

      const weeklyUpdate = await client.query<{
        id: number;
        vision_goal_id: number;
        target_count: number;
        completed_count: number;
        status: string;
      }>(
        `UPDATE weekly_missions
         SET
           completed_count = completed_count + 1,
           status = CASE WHEN completed_count + 1 >= target_count THEN 'DONE' ELSE status END,
           completed_at = CASE WHEN completed_count + 1 >= target_count THEN NOW() ELSE completed_at END
         WHERE id = $1 AND user_id = $2
         RETURNING id, vision_goal_id, target_count, completed_count, status`,
        [micro.weekly_mission_id, userId],
      );

      if (weeklyUpdate.rowCount && weeklyUpdate.rows[0].status === 'DONE') {
        const visionId = weeklyUpdate.rows[0].vision_goal_id;
        await client.query(
          `UPDATE vision_goals vg
           SET status = 'DONE', completed_at = NOW()
           WHERE vg.id = $1
             AND vg.user_id = $2
             AND vg.status = 'OPEN'
             AND NOT EXISTS (
               SELECT 1 FROM weekly_missions wm
               WHERE wm.vision_goal_id = vg.id AND wm.status <> 'DONE'
             )`,
          [visionId, userId],
        );
      }

      await client.query(
        `INSERT INTO daily_goal_coin_earnings (user_id, date_key, earned_goal_coin)
         VALUES ($1, CURRENT_DATE, 0)
         ON CONFLICT (user_id, date_key) DO NOTHING`,
        [userId],
      );

      const daily = await client.query<{ earned_goal_coin: number }>(
        `SELECT earned_goal_coin
         FROM daily_goal_coin_earnings
         WHERE user_id = $1 AND date_key = CURRENT_DATE
         FOR UPDATE`,
        [userId],
      );

      const reward = calculateStepReward({
        grade: gradeForSeconds(micro.estimated_seconds),
        sessionCombo: 1,
      });
      const dailyEarnedBefore = daily.rows[0]?.earned_goal_coin ?? 0;
      const grant = dailyEarnedBefore >= this.dailyGoalCoinCap
        ? 0
        : Math.min(reward.xp + 1, this.dailyGoalCoinCap - dailyEarnedBefore);
      const dailyEarnedAfter = dailyEarnedBefore + grant;

      await client.query(
        `UPDATE daily_goal_coin_earnings
         SET earned_goal_coin = $2, updated_at = NOW()
         WHERE user_id = $1 AND date_key = CURRENT_DATE`,
        [userId, dailyEarnedAfter],
      );

      await client.query(
        `UPDATE currencies
         SET goal_coin = goal_coin + $2, updated_at = NOW()
         WHERE user_id = $1`,
        [userId, grant],
      );

      const consistency = await this.updateConsistency(client, userId);

      return {
        microActionId: micro.id,
        grantedGoalCoin: grant,
        dailyGoalCoinEarned: dailyEarnedAfter,
        currentStreakDays: consistency.currentStreakDays,
        consistencyScore: consistency.consistencyScore,
        message: '\uC9C4\uD589\uD55C \uAC83\uC740 \uC0AC\uB77C\uC9C0\uC9C0 \uC54A\uB294\uB2E4.',
      };
    });
  }

  async shrinkMicro(userId: number, microId: number, reason = 'too_big') {
    return this.db.withTransaction(async (client) => {
      const micro = await client.query<{
        id: number;
        weekly_mission_id: number;
        title: string;
        estimated_seconds: number;
        status: string;
      }>(
        `SELECT id, weekly_mission_id, title, estimated_seconds, status
         FROM micro_actions
         WHERE id = $1 AND user_id = $2
         FOR UPDATE`,
        [microId, userId],
      );

      if (!micro.rowCount || micro.rows[0].status !== 'OPEN') {
        throw new NotFoundException('Open micro action not found.');
      }

      const picked = micro.rows[0];
      const replacements = shrinkStep(picked.title, picked.estimated_seconds);

      await client.query(`UPDATE micro_actions SET status = 'SKIPPED' WHERE id = $1`, [picked.id]);
      await client.query(
        `INSERT INTO micro_action_logs (micro_action_id, user_id, result, executed_at, memo)
         VALUES ($1, $2, 'SKIPPED', NOW(), $3)`,
        [picked.id, userId, `replaced:${reason}`],
      );

      const created: MicroActionRow[] = [];
      for (const step of replacements) {
        const inserted = await client.query<MicroActionRow>(
          `INSERT INTO micro_actions (weekly_mission_id, user_id, title, estimated_seconds, difficulty)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING
             id,
             user_id AS "userId",
             weekly_mission_id AS "weeklyMissionId",
             title,
             estimated_seconds AS "estimatedSeconds",
             difficulty,
             status,
             created_at AS "createdAt",
             completed_at AS "completedAt"`,
          [picked.weekly_mission_id, userId, step.title, step.estimatedSeconds, difficultyForSeconds(step.estimatedSeconds)],
        );
        created.push(inserted.rows[0]);
      }

      await client.query(
        `UPDATE weekly_missions
         SET target_count = target_count + $3
         WHERE id = $1 AND user_id = $2`,
        [picked.weekly_mission_id, userId, Math.max(created.length - 1, 0)],
      );

      return {
        microActionId: picked.id,
        replacementSteps: created,
        firstStep: created[0],
        reason,
        message: '\uC774 \uB2E8\uACC4\uAC00 \uCEF8\uB2E4. \uB354 \uC791\uAC8C \uBC14\uAFC2\uB2E4.',
      };
    });
  }

  async skipMicro(userId: number, microId: number) {
    return this.db.withTransaction(async (client) => {
      const micro = await client.query<{ id: number; status: string }>(
        `SELECT id, status
         FROM micro_actions
         WHERE id = $1 AND user_id = $2
         FOR UPDATE`,
        [microId, userId],
      );

      if (!micro.rowCount || micro.rows[0].status !== 'OPEN') {
        throw new NotFoundException('Open micro action not found.');
      }

      await client.query(`UPDATE micro_actions SET status = 'SKIPPED' WHERE id = $1`, [microId]);
      await client.query(
        `INSERT INTO micro_action_logs (micro_action_id, user_id, result, executed_at, memo)
         VALUES ($1, $2, 'SKIPPED', NOW(), 'not_now')`,
        [microId, userId],
      );

      return {
        microActionId: microId,
        message: '\uC5EC\uAE30\uC11C \uBA48\uCDB0\uB3C4 \uC9C4\uD589\uD55C \uAC83\uC740 \uC0AC\uB77C\uC9C0\uC9C0 \uC54A\uB294\uB2E4.',
      };
    });
  }

  private async updateConsistency(client: { query: DatabaseService['query'] }, userId: number) {
    const rateCounts = await client.query<{ planned_count: number; done_count: number }>(
      `SELECT
         (SELECT COUNT(*)::int FROM micro_actions WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '14 days') AS planned_count,
         (SELECT COUNT(*)::int FROM micro_action_logs WHERE user_id = $1 AND result = 'DONE' AND executed_at >= NOW() - INTERVAL '14 days') AS done_count`,
      [userId],
    );

    const planned = rateCounts.rows[0].planned_count;
    const done = rateCounts.rows[0].done_count;
    const executionRate14d = planned <= 0 ? 0 : done / planned;

    const doneDates = await client.query<{ done_date: string }>(
      `SELECT DISTINCT (executed_at AT TIME ZONE 'UTC')::date::text AS done_date
       FROM micro_action_logs
       WHERE user_id = $1 AND result = 'DONE'
       ORDER BY done_date DESC
       LIMIT 30`,
      [userId],
    );

    const dateSet = new Set(doneDates.rows.map((r) => r.done_date));
    let streak = 0;
    const cursor = new Date();
    for (let i = 0; i < 30; i += 1) {
      const key = cursor.toISOString().slice(0, 10);
      if (dateSet.has(key)) {
        streak += 1;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      } else {
        break;
      }
    }

    const streakFactor = Math.min(streak / 14, 1);
    const consistencyScore = Math.round(executionRate14d * 70 + streakFactor * 30);

    const consistency = await client.query<{
      current_streak_days: number;
      consistency_score: number;
    }>(
      `UPDATE consistency_states
       SET
         current_streak_days = $2,
         best_streak_days = GREATEST(best_streak_days, $2),
         execution_rate_14d = $3,
         consistency_score = $4,
         last_streak_updated_at = NOW(),
         updated_at = NOW()
       WHERE user_id = $1
       RETURNING current_streak_days, consistency_score`,
      [userId, streak, executionRate14d, consistencyScore],
    );

    return {
      currentStreakDays: consistency.rows[0]?.current_streak_days ?? streak,
      consistencyScore: consistency.rows[0]?.consistency_score ?? consistencyScore,
    };
  }
}
