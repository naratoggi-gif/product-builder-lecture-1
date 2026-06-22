import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../shared/database.service';
import { SkillEffectsService } from './skill-effects.service';

@Injectable()
export class SkillsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly effects: SkillEffectsService,
  ) {}

  async listShop(userId: number) {
    const player = await this.db.query<{ job: string; idle_gold: number }>(
      `SELECT pp.job, c.idle_gold
       FROM player_profiles pp
       JOIN currencies c ON c.user_id = pp.user_id
       WHERE pp.user_id = $1`,
      [userId],
    );

    if (!player.rowCount) {
      throw new NotFoundException('Player not found.');
    }

    const { job, idle_gold: idleGold } = player.rows[0];
    const bonuses = await this.effects.getBonuses(userId);

    const skills = await this.db.query<{
      id: number;
      code: string;
      name: string;
      description: string;
      job: string | null;
      stat_type: 'ATK' | 'HP' | 'IDLE_GOLD_RATE' | 'GOAL_COIN_RATE';
      effect_base: string;
      effect_per_level: string;
      max_level: number;
      unlock_idle_gold: number;
      upgrade_idle_gold: number;
      required_level: number;
      current_level: number | null;
    }>(
      `SELECT
         s.id,
         s.code,
         s.name,
         s.description,
         s.job,
         s.stat_type,
         s.effect_base::text,
         s.effect_per_level::text,
         s.max_level,
         s.unlock_idle_gold,
         s.upgrade_idle_gold,
         s.required_level,
         us.level AS current_level
       FROM skills s
       LEFT JOIN user_skills us ON us.skill_id = s.id AND us.user_id = $1
       WHERE s.active = TRUE AND (s.job = $2 OR s.job IS NULL)
       ORDER BY s.required_level, s.id`,
      [userId, job],
    );

    return {
      currency: {
        idleGold,
      },
      appliedBonuses: bonuses,
      skills: skills.rows.map((skill) => {
        const currentLevel = skill.current_level ?? 0;
        const effectBase = Number(skill.effect_base) || 0;
        const effectPerLevel = Number(skill.effect_per_level) || 0;
        const currentEffect = currentLevel > 0 ? effectBase + effectPerLevel * (currentLevel - 1) : 0;
        const nextEffect = currentLevel >= skill.max_level ? currentEffect : effectBase + effectPerLevel * currentLevel;
        const nextCost = currentLevel === 0 ? skill.unlock_idle_gold : skill.upgrade_idle_gold * currentLevel;

        return {
          id: skill.id,
          code: skill.code,
          name: skill.name,
          description: skill.description,
          job: skill.job,
          statType: skill.stat_type,
          currentLevel,
          maxLevel: skill.max_level,
          unlockIdleGold: skill.unlock_idle_gold,
          upgradeIdleGold: skill.upgrade_idle_gold,
          nextCost,
          currentEffect,
          nextEffect,
          requiredLevel: skill.required_level,
          unlocked: currentLevel > 0,
          maxed: currentLevel >= skill.max_level,
          affordable: idleGold >= nextCost,
        };
      }),
    };
  }

  async unlock(userId: number, skillId: number) {
    return this.db.withTransaction(async (client) => {
      const skill = await client.query<{
        id: number;
        job: string | null;
        required_level: number;
        unlock_idle_gold: number;
      }>(
        `SELECT s.id, s.job, s.required_level, s.unlock_idle_gold
         FROM skills s
         WHERE s.id = $1 AND s.active = TRUE`,
        [skillId],
      );

      if (!skill.rowCount) throw new NotFoundException('Skill not found.');

      const player = await client.query<{ job: string; level: number }>(
        'SELECT job, level FROM player_profiles WHERE user_id = $1 FOR UPDATE',
        [userId],
      );
      const currency = await client.query<{ idle_gold: number }>(
        'SELECT idle_gold FROM currencies WHERE user_id = $1 FOR UPDATE',
        [userId],
      );
      const owned = await client.query('SELECT level FROM user_skills WHERE user_id = $1 AND skill_id = $2', [userId, skillId]);

      if (!player.rowCount || !currency.rowCount) throw new NotFoundException('Player state not found.');
      if (owned.rowCount) throw new BadRequestException('Skill already unlocked.');

      const skillRow = skill.rows[0];
      if (skillRow.job && skillRow.job !== player.rows[0].job) {
        throw new BadRequestException('Job requirement not satisfied.');
      }
      if (player.rows[0].level < skillRow.required_level) {
        throw new BadRequestException('Player level requirement not satisfied.');
      }
      if (currency.rows[0].idle_gold < skillRow.unlock_idle_gold) {
        throw new BadRequestException('Not enough idle gold.');
      }

      await client.query(
        'UPDATE currencies SET idle_gold = idle_gold - $2, updated_at = NOW() WHERE user_id = $1',
        [userId, skillRow.unlock_idle_gold],
      );
      await client.query(
        'INSERT INTO user_skills (user_id, skill_id, level) VALUES ($1, $2, 1)',
        [userId, skillId],
      );

      return { skillId, unlocked: true, newLevel: 1 };
    });
  }

  async upgrade(userId: number, skillId: number) {
    return this.db.withTransaction(async (client) => {
      const skill = await client.query<{
        max_level: number;
        upgrade_idle_gold: number;
      }>('SELECT max_level, upgrade_idle_gold FROM skills WHERE id = $1 AND active = TRUE', [skillId]);
      const owned = await client.query<{ level: number }>(
        'SELECT level FROM user_skills WHERE user_id = $1 AND skill_id = $2 FOR UPDATE',
        [userId, skillId],
      );
      const currency = await client.query<{ idle_gold: number }>(
        'SELECT idle_gold FROM currencies WHERE user_id = $1 FOR UPDATE',
        [userId],
      );

      if (!skill.rowCount) throw new NotFoundException('Skill not found.');
      if (!owned.rowCount) throw new BadRequestException('Skill is not unlocked.');
      if (!currency.rowCount) throw new NotFoundException('Currency not found.');

      const currentLevel = owned.rows[0].level;
      if (currentLevel >= skill.rows[0].max_level) {
        throw new BadRequestException('Skill is already max level.');
      }

      const cost = skill.rows[0].upgrade_idle_gold * currentLevel;
      if (currency.rows[0].idle_gold < cost) {
        throw new BadRequestException('Not enough idle gold.');
      }

      const updated = await client.query<{ level: number }>(
        `UPDATE user_skills
         SET level = level + 1, updated_at = NOW()
         WHERE user_id = $1 AND skill_id = $2
         RETURNING level`,
        [userId, skillId],
      );
      await client.query(
        'UPDATE currencies SET idle_gold = idle_gold - $2, updated_at = NOW() WHERE user_id = $1',
        [userId, cost],
      );

      return { skillId, upgraded: true, newLevel: updated.rows[0].level, spentIdleGold: cost };
    });
  }
}
