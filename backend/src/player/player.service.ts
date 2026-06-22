import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../shared/database.service';
import { SkillEffectsService } from '../skills/skill-effects.service';

@Injectable()
export class PlayerService {
  constructor(
    private readonly db: DatabaseService,
    private readonly skillEffects: SkillEffectsService,
  ) {}

  async getMe(userId: number) {
    const result = await this.db.query<{
      userId: number;
      email: string;
      nickname: string;
      job: string;
      level: number;
      exp: number;
      atk: number;
      hp: number;
      idleGold: number;
      goalCoin: number;
      equippedCostumeId: number | null;
      equippedCostumeName: string | null;
      equippedSkillsetId: string | null;
    }>(
      `SELECT
         u.id AS "userId",
         u.email,
         u.nickname,
         pp.job,
         pp.level,
         pp.exp,
         pp.atk,
         pp.hp,
         c.idle_gold AS "idleGold",
         c.goal_coin AS "goalCoin",
         uc.costume_id AS "equippedCostumeId",
         co.name AS "equippedCostumeName",
         co.skillset_id AS "equippedSkillsetId"
       FROM users u
       JOIN player_profiles pp ON pp.user_id = u.id
       JOIN currencies c ON c.user_id = u.id
       LEFT JOIN user_costumes uc ON uc.user_id = u.id AND uc.is_equipped = TRUE
       LEFT JOIN costumes co ON co.id = uc.costume_id
       WHERE u.id = $1`,
      [userId],
    );

    if (!result.rowCount) {
      throw new NotFoundException('Player not found.');
    }

    const row = result.rows[0];
    const bonuses = await this.skillEffects.getBonuses(userId);

    return {
      ...row,
      baseAtk: row.atk,
      baseHp: row.hp,
      atk: row.atk + Math.floor(bonuses.atkBonus),
      hp: row.hp + Math.floor(bonuses.hpBonus),
      skillBonuses: bonuses,
    };
  }

  async getCurrency(userId: number) {
    const result = await this.db.query<{ idleGold: number; goalCoin: number }>(
      `SELECT idle_gold AS "idleGold", goal_coin AS "goalCoin"
       FROM currencies
       WHERE user_id = $1`,
      [userId],
    );

    if (!result.rowCount) {
      throw new NotFoundException('Currency not found.');
    }

    return result.rows[0];
  }
}
