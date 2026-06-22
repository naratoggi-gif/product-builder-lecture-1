import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, SqlExecutor } from '../shared/database.service';
import { RequirementType } from '../shared/domain.types';

interface CostumeRequirement {
  requirementType: RequirementType;
  targetValue: number;
  operator: 'GTE' | 'EQ';
}

@Injectable()
export class CostumesService {
  constructor(private readonly db: DatabaseService) {}

  async listShop(userId: number) {
    const currency = await this.db.query<{ goal_coin: number }>('SELECT goal_coin FROM currencies WHERE user_id = $1', [userId]);
    const consistency = await this.db.query<{ current_streak_days: number }>(
      'SELECT current_streak_days FROM consistency_states WHERE user_id = $1',
      [userId],
    );

    if (!currency.rowCount || !consistency.rowCount) {
      throw new NotFoundException('User state not found.');
    }

    const costumeRows = await this.db.query<{
      costume_id: number;
      name: string;
      rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
      price_goal_coin: number;
      requirement_type: RequirementType | null;
      target_value: number | null;
      operator: 'GTE' | 'EQ' | null;
    }>(
      `SELECT
         c.id AS costume_id,
         c.name,
         c.rarity,
         c.price_goal_coin,
         cr.requirement_type,
         cr.target_value,
         cr.operator
       FROM costumes c
       LEFT JOIN costume_requirements cr ON cr.costume_id = c.id
       WHERE c.active = TRUE
       ORDER BY c.id`,
      [],
    );

    const values = await this.getRequirementValues(userId);

    const grouped = new Map<number, { costumeId: number; name: string; rarity: string; priceGoalCoin: number; requirements: CostumeRequirement[] }>();

    for (const row of costumeRows.rows) {
      if (!grouped.has(row.costume_id)) {
        grouped.set(row.costume_id, {
          costumeId: row.costume_id,
          name: row.name,
          rarity: row.rarity,
          priceGoalCoin: row.price_goal_coin,
          requirements: [],
        });
      }
      if (row.requirement_type && row.target_value !== null && row.operator) {
        grouped.get(row.costume_id)?.requirements.push({
          requirementType: row.requirement_type,
          targetValue: row.target_value,
          operator: row.operator,
        });
      }
    }

    const goalCoin = currency.rows[0].goal_coin;

    return Array.from(grouped.values()).map((costume) => {
      const requirements = costume.requirements.map((req) => {
        const currentValue = values[req.requirementType] ?? 0;
        const satisfied = req.operator === 'GTE' ? currentValue >= req.targetValue : currentValue === req.targetValue;
        return {
          requirementType: req.requirementType,
          targetValue: req.targetValue,
          currentValue,
          satisfied,
        };
      });

      return {
        costumeId: costume.costumeId,
        name: costume.name,
        rarity: costume.rarity,
        priceGoalCoin: costume.priceGoalCoin,
        affordable: goalCoin >= costume.priceGoalCoin,
        requirements,
      };
    });
  }

  async buy(userId: number, costumeId: number) {
    return this.db.withTransaction(async (client) => {
      const costume = await client.query<{
        id: number;
        price_goal_coin: number;
      }>('SELECT id, price_goal_coin FROM costumes WHERE id = $1 AND active = TRUE', [costumeId]);

      if (!costume.rowCount) throw new NotFoundException('Costume not found.');

      const owned = await client.query<{ user_id: number }>(
        'SELECT user_id FROM user_costumes WHERE user_id = $1 AND costume_id = $2',
        [userId, costumeId],
      );
      if (owned.rowCount) throw new BadRequestException('Already owned costume.');

      const currency = await client.query<{ goal_coin: number }>(
        'SELECT goal_coin FROM currencies WHERE user_id = $1 FOR UPDATE',
        [userId],
      );
      if (!currency.rowCount) throw new NotFoundException('Currency not found.');

      const price = costume.rows[0].price_goal_coin;
      if (currency.rows[0].goal_coin < price) {
        throw new BadRequestException('Not enough goal coin.');
      }

      const reqRows = await client.query<{
        requirement_type: RequirementType;
        target_value: number;
        operator: 'GTE' | 'EQ';
      }>(
        `SELECT requirement_type, target_value, operator
         FROM costume_requirements
         WHERE costume_id = $1`,
        [costumeId],
      );

      const values = await this.getRequirementValues(userId, client);
      for (const req of reqRows.rows) {
        const currentValue = values[req.requirement_type] ?? 0;
        const ok = req.operator === 'GTE' ? currentValue >= req.target_value : currentValue === req.target_value;
        if (!ok) {
          throw new BadRequestException(`Requirement not satisfied: ${req.requirement_type}`);
        }
      }

      const updatedCurrency = await client.query<{ goal_coin: number }>(
        `UPDATE currencies
         SET goal_coin = goal_coin - $2, updated_at = NOW()
         WHERE user_id = $1
         RETURNING goal_coin`,
        [userId, price],
      );

      await client.query(
        `INSERT INTO user_costumes (user_id, costume_id, is_equipped)
         VALUES ($1, $2, FALSE)`,
        [userId, costumeId],
      );

      return {
        costumeId,
        owned: true,
        remainingGoalCoin: updatedCurrency.rows[0].goal_coin,
      };
    });
  }

  async equip(userId: number, costumeId: number) {
    return this.db.withTransaction(async (client) => {
      const owned = await client.query<{ user_id: number }>(
        'SELECT user_id FROM user_costumes WHERE user_id = $1 AND costume_id = $2',
        [userId, costumeId],
      );
      if (!owned.rowCount) throw new BadRequestException('Costume is not owned.');

      const costume = await client.query<{ skillset_id: string }>('SELECT skillset_id FROM costumes WHERE id = $1', [costumeId]);
      if (!costume.rowCount) throw new NotFoundException('Costume not found.');

      await client.query('UPDATE user_costumes SET is_equipped = FALSE WHERE user_id = $1', [userId]);
      await client.query('UPDATE user_costumes SET is_equipped = TRUE WHERE user_id = $1 AND costume_id = $2', [userId, costumeId]);

      return {
        costumeId,
        equipped: true,
        activeSkillsetId: costume.rows[0].skillset_id,
      };
    });
  }

  private async getRequirementValues(userId: number, executor: SqlExecutor = this.db): Promise<Record<RequirementType, number>> {
    const counts = await executor.query<{
      streak_days: number;
      routine_count: number;
      weekly_clear_count: number;
      vision_clear_count: number;
    }>(
      `SELECT
         (SELECT current_streak_days FROM consistency_states WHERE user_id = $1) AS streak_days,
         (SELECT COUNT(*)::int FROM micro_actions WHERE user_id = $1 AND status = 'DONE') AS routine_count,
         (SELECT COUNT(*)::int FROM weekly_missions WHERE user_id = $1 AND status = 'DONE') AS weekly_clear_count,
         (SELECT COUNT(*)::int FROM vision_goals WHERE user_id = $1 AND status = 'DONE') AS vision_clear_count`,
      [userId],
    );

    const row = counts.rows[0] ?? { streak_days: 0, routine_count: 0, weekly_clear_count: 0, vision_clear_count: 0 };

    return {
      STREAK_DAYS: Number(row.streak_days) || 0,
      ROUTINE_COUNT: Number(row.routine_count) || 0,
      WEEKLY_CLEAR_COUNT: Number(row.weekly_clear_count) || 0,
      VISION_CLEAR_COUNT: Number(row.vision_clear_count) || 0,
    };
  }
}
