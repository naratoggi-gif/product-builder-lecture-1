#!/usr/bin/env node
const { hash } = require('bcryptjs');
const { Pool } = require('pg');

if (process.env.NODE_ENV === 'production') {
  throw new Error('Super account seed is disabled in production.');
}

const email = process.env.SUPER_EMAIL || 'super@stepquest.local';
const password = process.env.SUPER_PASSWORD || 'stepquest-super-1234';
const nickname = process.env.SUPER_NICKNAME || '슈퍼 테스터';
const equippedStepQuestCostume = process.env.SUPER_STEPQUEST_COSTUME || 'one_punch_hero';

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const passwordHash = await hash(password, 10);
    const userResult = await client.query(
      `INSERT INTO users (email, nickname, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE
       SET nickname = EXCLUDED.nickname,
           password_hash = EXCLUDED.password_hash
       RETURNING id, email, nickname`,
      [email, nickname, passwordHash],
    );
    const user = userResult.rows[0];

    await client.query(
      `INSERT INTO player_profiles (user_id, job, level, exp, atk, hp, last_login_at, last_idle_claim_at)
       VALUES ($1, 'SWORDSMAN', 99, 999999, 9999, 99999, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET job = 'SWORDSMAN',
           level = 99,
           exp = 999999,
           atk = 9999,
           hp = 99999,
           last_login_at = NOW(),
           last_idle_claim_at = NOW(),
           updated_at = NOW()`,
      [user.id],
    );

    await client.query(
      `INSERT INTO currencies (user_id, idle_gold, goal_coin)
       VALUES ($1, 999999999, 999999999)
       ON CONFLICT (user_id) DO UPDATE
       SET idle_gold = EXCLUDED.idle_gold,
           goal_coin = EXCLUDED.goal_coin,
           updated_at = NOW()`,
      [user.id],
    );

    await client.query(
      `INSERT INTO consistency_states
         (user_id, current_streak_days, best_streak_days, execution_rate_14d, consistency_score, streak_recover_tokens, last_streak_updated_at)
       VALUES ($1, 365, 365, 1, 100, 99, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET current_streak_days = 365,
           best_streak_days = 365,
           execution_rate_14d = 1,
           consistency_score = 100,
           streak_recover_tokens = 99,
           last_streak_updated_at = NOW(),
           updated_at = NOW()`,
      [user.id],
    );

    await client.query(
      `INSERT INTO player_battle_states (user_id, current_stage_id)
       VALUES ($1, 1)
       ON CONFLICT (user_id) DO UPDATE
       SET current_stage_id = EXCLUDED.current_stage_id,
           updated_at = NOW()`,
      [user.id],
    );

    await client.query(
      `INSERT INTO stepquest_user_states
         (user_id, level, xp, material, return_marks, equipped_costume_id, last_active_at)
       VALUES ($1, 99, 999999, 999999, 99, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET level = 99,
           xp = 999999,
           material = 999999,
           return_marks = 99,
           equipped_costume_id = EXCLUDED.equipped_costume_id,
           last_active_at = NOW(),
           updated_at = NOW()`,
      [user.id, equippedStepQuestCostume],
    );

    await client.query(
      `INSERT INTO stepquest_village_facilities (user_id, facility_key, level, xp, material)
       SELECT $1, key, 20, 100, 100
       FROM unnest($2::text[]) AS key
       ON CONFLICT (user_id, facility_key) DO UPDATE
       SET level = 20,
           xp = 100,
           material = 100,
           updated_at = NOW()`,
      [user.id, ['knowledge_tower', 'guild_office', 'training_ground', 'workshop', 'archive', 'inn', 'kitchen', 'garden']],
    );

    await client.query(
      `INSERT INTO user_skills (user_id, skill_id, level)
       SELECT $1, id, max_level
       FROM skills
       WHERE active = TRUE
       ON CONFLICT (user_id, skill_id) DO UPDATE
       SET level = EXCLUDED.level,
           updated_at = NOW()`,
      [user.id],
    );

    await client.query(
      `UPDATE user_costumes
       SET is_equipped = FALSE
       WHERE user_id = $1`,
      [user.id],
    );

    await client.query(
      `INSERT INTO user_costumes (user_id, costume_id, is_equipped)
       SELECT $1, id, id = (SELECT MIN(id) FROM costumes WHERE active = TRUE)
       FROM costumes
       WHERE active = TRUE
       ON CONFLICT (user_id, costume_id) DO UPDATE
       SET is_equipped = EXCLUDED.is_equipped`,
      [user.id],
    );

    await client.query('COMMIT');

    console.log(JSON.stringify({
      ok: true,
      userId: user.id,
      email: user.email,
      nickname: user.nickname,
      password,
      equippedStepQuestCostume,
      note: 'Local development super account seeded. Do not reuse this password in production.',
    }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
