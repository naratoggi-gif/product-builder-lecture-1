import { Injectable } from '@nestjs/common';
import { DatabaseService, SqlExecutor } from '../shared/database.service';

export interface SkillBonuses {
  atkBonus: number;
  hpBonus: number;
  idleGoldRateBonus: number;
  goalCoinRateBonus: number;
}

@Injectable()
export class SkillEffectsService {
  constructor(private readonly db: DatabaseService) {}

  async getBonuses(userId: number, executor: SqlExecutor = this.db): Promise<SkillBonuses> {
    const result = await executor.query<{
      stat_type: 'ATK' | 'HP' | 'IDLE_GOLD_RATE' | 'GOAL_COIN_RATE';
      total_value: string;
    }>(
      `SELECT
         s.stat_type,
         COALESCE(SUM(s.effect_base + (GREATEST(us.level - 1, 0) * s.effect_per_level)), 0)::text AS total_value
       FROM user_skills us
       JOIN skills s ON s.id = us.skill_id
       WHERE us.user_id = $1 AND s.active = TRUE
       GROUP BY s.stat_type`,
      [userId],
    );

    const bonuses: SkillBonuses = {
      atkBonus: 0,
      hpBonus: 0,
      idleGoldRateBonus: 0,
      goalCoinRateBonus: 0,
    };

    for (const row of result.rows) {
      const value = Number(row.total_value) || 0;
      if (row.stat_type === 'ATK') bonuses.atkBonus += value;
      if (row.stat_type === 'HP') bonuses.hpBonus += value;
      if (row.stat_type === 'IDLE_GOLD_RATE') bonuses.idleGoldRateBonus += value;
      if (row.stat_type === 'GOAL_COIN_RATE') bonuses.goalCoinRateBonus += value;
    }

    return bonuses;
  }
}
