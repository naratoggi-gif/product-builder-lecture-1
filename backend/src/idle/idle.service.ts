import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../shared/database.service';
import { SkillEffectsService } from '../skills/skill-effects.service';

@Injectable()
export class IdleService {
  private readonly offlineCapMinutes = 12 * 60;

  constructor(
    private readonly db: DatabaseService,
    private readonly skillEffects: SkillEffectsService,
  ) {}

  async getStatus(userId: number) {
    const player = await this.db.query<{
      atk: number;
      hp: number;
      current_stage_id: number;
      current_stage_name: string;
      current_zone_name: string;
      current_monster_name: string;
      current_monster_hp: number;
      current_required_atk: number;
      current_base_gold_per_kill: number;
    }>(
      `SELECT
         pp.atk,
         pp.hp,
         pbs.current_stage_id,
         bs.name AS current_stage_name,
         bs.zone_name AS current_zone_name,
         bs.monster_name AS current_monster_name,
         bs.monster_hp AS current_monster_hp,
         bs.required_atk AS current_required_atk,
         bs.base_gold_per_kill AS current_base_gold_per_kill
       FROM player_profiles pp
       JOIN player_battle_states pbs ON pbs.user_id = pp.user_id
       JOIN battle_stages bs ON bs.id = pbs.current_stage_id
       WHERE pp.user_id = $1`,
      [userId],
    );

    if (!player.rowCount) throw new NotFoundException('Battle state not found.');

    const bonuses = await this.skillEffects.getBonuses(userId);
    const row = player.rows[0];
    const effectiveAtk = (Number(row.atk) || 0) + Math.floor(bonuses.atkBonus);

    const stages = await this.db.query<{
      id: number;
      zone_name: string;
      name: string;
      monster_name: string;
      monster_hp: number;
      required_atk: number;
      base_gold_per_kill: number;
      flavor_text: string;
    }>(
      `SELECT id, zone_name, name, monster_name, monster_hp, required_atk, base_gold_per_kill, flavor_text
       FROM battle_stages
       WHERE active = TRUE
       ORDER BY id`,
    );

    return {
      effectiveAtk,
      projected: this.projectStage(row.current_monster_hp, row.current_base_gold_per_kill, effectiveAtk, bonuses.idleGoldRateBonus),
      currentStage: {
        id: row.current_stage_id,
        zoneName: row.current_zone_name,
        name: row.current_stage_name,
        monsterName: row.current_monster_name,
        monsterHp: row.current_monster_hp,
        requiredAtk: row.current_required_atk,
      },
      stages: stages.rows.map((stage) => ({
        id: stage.id,
        zoneName: stage.zone_name,
        name: stage.name,
        monsterName: stage.monster_name,
        monsterHp: stage.monster_hp,
        requiredAtk: stage.required_atk,
        baseGoldPerKill: stage.base_gold_per_kill,
        flavorText: stage.flavor_text,
        unlocked: effectiveAtk >= stage.required_atk,
        selected: stage.id === row.current_stage_id,
        projection: this.projectStage(stage.monster_hp, stage.base_gold_per_kill, effectiveAtk, bonuses.idleGoldRateBonus),
      })),
    };
  }

  async selectStage(userId: number, stageId: number) {
    return this.db.withTransaction(async (client) => {
      const profile = await client.query<{ atk: number }>('SELECT atk FROM player_profiles WHERE user_id = $1 FOR UPDATE', [userId]);
      const battle = await client.query<{ id: number; required_atk: number }>(
        'SELECT id, required_atk FROM battle_stages WHERE id = $1 AND active = TRUE',
        [stageId],
      );
      if (!profile.rowCount) throw new NotFoundException('Player profile not found.');
      if (!battle.rowCount) throw new NotFoundException('Stage not found.');

      const bonuses = await this.skillEffects.getBonuses(userId, client);
      const effectiveAtk = (Number(profile.rows[0].atk) || 0) + Math.floor(bonuses.atkBonus);
      if (effectiveAtk < battle.rows[0].required_atk) {
        throw new BadRequestException('Stage requirement not satisfied.');
      }

      await client.query(
        `INSERT INTO player_battle_states (user_id, current_stage_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id)
         DO UPDATE SET current_stage_id = EXCLUDED.current_stage_id, updated_at = NOW()`,
        [userId, stageId],
      );

      return { stageId, selected: true };
    });
  }

  async claim(userId: number) {
    return this.db.withTransaction(async (client) => {
      const profile = await client.query<{
        atk: number;
        last_idle_claim_at: string | null;
        created_at: string;
      }>(
        `SELECT atk, last_idle_claim_at, created_at
         FROM player_profiles
         WHERE user_id = $1
         FOR UPDATE`,
        [userId],
      );

      if (!profile.rowCount) {
        throw new NotFoundException('Player profile not found.');
      }

      const currency = await client.query<{ idle_gold: number }>(
        'SELECT idle_gold FROM currencies WHERE user_id = $1 FOR UPDATE',
        [userId],
      );
      if (!currency.rowCount) {
        throw new NotFoundException('Currency not found.');
      }

      const battle = await client.query<{
        current_stage_id: number;
        monster_hp: number;
        base_gold_per_kill: number;
        name: string;
        monster_name: string;
      }>(
        `SELECT pbs.current_stage_id, bs.monster_hp, bs.base_gold_per_kill, bs.name, bs.monster_name
         FROM player_battle_states pbs
         JOIN battle_stages bs ON bs.id = pbs.current_stage_id
         WHERE pbs.user_id = $1
         FOR UPDATE`,
        [userId],
      );
      if (!battle.rowCount) {
        throw new NotFoundException('Battle stage not found.');
      }

      const bonuses = await this.skillEffects.getBonuses(userId, client);
      const now = new Date();
      const last = new Date(profile.rows[0].last_idle_claim_at ?? profile.rows[0].created_at);
      const rawMinutes = Math.max(0, Math.floor((now.getTime() - last.getTime()) / 60000));
      const minutes = Math.min(rawMinutes, this.offlineCapMinutes);

      const baseAtk = Number(profile.rows[0].atk) || 10;
      const effectiveAtk = baseAtk + Math.floor(bonuses.atkBonus);
      const projection = this.projectStage(
        battle.rows[0].monster_hp,
        battle.rows[0].base_gold_per_kill,
        effectiveAtk,
        bonuses.idleGoldRateBonus,
      );
      const grantedIdleGold = minutes * projection.goldPerMinute;
      const estimatedKills = Math.floor(minutes * projection.killsPerMinute);

      await client.query(
        `UPDATE currencies
         SET idle_gold = idle_gold + $2, updated_at = NOW()
         WHERE user_id = $1`,
        [userId, grantedIdleGold],
      );

      await client.query(
        `UPDATE player_profiles
         SET last_idle_claim_at = NOW(), last_login_at = NOW(), updated_at = NOW()
         WHERE user_id = $1`,
        [userId],
      );

      await client.query(
        `INSERT INTO idle_sessions (user_id, stage_id, started_at, ended_at, minutes, gold_earned)
         VALUES ($1, $2, $3, NOW(), $4, $5)`,
        [userId, battle.rows[0].current_stage_id, last.toISOString(), minutes, grantedIdleGold],
      );

      const after = await client.query<{ idle_gold: number }>(
        'SELECT idle_gold FROM currencies WHERE user_id = $1',
        [userId],
      );

      return {
        minutes,
        stageId: battle.rows[0].current_stage_id,
        stageName: battle.rows[0].name,
        monsterName: battle.rows[0].monster_name,
        effectiveAtk,
        killsPerMinute: projection.killsPerMinute,
        goldPerMinute: projection.goldPerMinute,
        estimatedKills,
        grantedIdleGold,
        newIdleGoldBalance: after.rows[0].idle_gold,
      };
    });
  }

  private projectStage(monsterHp: number, baseGoldPerKill: number, effectiveAtk: number, idleGoldRateBonus: number) {
    const damagePerSecond = Math.max(1, effectiveAtk * 0.45);
    const killTimeSeconds = Math.max(3, monsterHp / damagePerSecond);
    const killsPerMinute = Math.max(1, Math.floor(60 / killTimeSeconds));
    const goldPerMinute = Math.max(1, Math.floor(killsPerMinute * baseGoldPerKill * (1 + idleGoldRateBonus)));

    return {
      killTimeSeconds: Math.round(killTimeSeconds * 10) / 10,
      killsPerMinute,
      goldPerMinute,
    };
  }
}
