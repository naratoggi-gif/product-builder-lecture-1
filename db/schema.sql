-- STEPQUEST MVP schema (PostgreSQL)
-- Legacy table names are retained until the domain migration is split out.

BEGIN;

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(320) NOT NULL UNIQUE,
  nickname VARCHAR(40) NOT NULL,
  password_hash VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE player_profiles (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  job VARCHAR(20) NOT NULL CHECK (job IN ('SWORDSMAN', 'MAGE')),
  level INT NOT NULL DEFAULT 1 CHECK (level >= 1),
  exp INT NOT NULL DEFAULT 0 CHECK (exp >= 0),
  atk INT NOT NULL DEFAULT 10 CHECK (atk >= 0),
  hp INT NOT NULL DEFAULT 100 CHECK (hp >= 0),
  last_login_at TIMESTAMPTZ,
  last_idle_claim_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE currencies (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  idle_gold BIGINT NOT NULL DEFAULT 0 CHECK (idle_gold >= 0),
  goal_coin BIGINT NOT NULL DEFAULT 0 CHECK (goal_coin >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE daily_goal_coin_earnings (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_key DATE NOT NULL,
  earned_goal_coin INT NOT NULL DEFAULT 0 CHECK (earned_goal_coin >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, date_key)
);
CREATE INDEX idx_daily_goal_coin_earnings_user_date ON daily_goal_coin_earnings(user_id, date_key DESC);
CREATE TABLE vision_goals (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(140) NOT NULL,
  description TEXT,
  target_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'DONE', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_vision_goals_user_status ON vision_goals(user_id, status);

CREATE TABLE weekly_missions (
  id BIGSERIAL PRIMARY KEY,
  vision_goal_id BIGINT NOT NULL REFERENCES vision_goals(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(140) NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  target_count INT NOT NULL CHECK (target_count > 0),
  completed_count INT NOT NULL DEFAULT 0 CHECK (completed_count >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'DONE', 'EXPIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT weekly_date_valid CHECK (week_end_date >= week_start_date)
);
CREATE INDEX idx_weekly_missions_user_status ON weekly_missions(user_id, status);
CREATE INDEX idx_weekly_missions_vision ON weekly_missions(vision_goal_id);

CREATE TABLE micro_actions (
  id BIGSERIAL PRIMARY KEY,
  weekly_mission_id BIGINT NOT NULL REFERENCES weekly_missions(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(140) NOT NULL,
  estimated_seconds INT NOT NULL CHECK (estimated_seconds > 0),
  difficulty INT NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  scheduled_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'DONE', 'SKIPPED', 'FAILED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_micro_actions_user_status ON micro_actions(user_id, status);
CREATE INDEX idx_micro_actions_weekly ON micro_actions(weekly_mission_id);
CREATE INDEX idx_micro_actions_scheduled ON micro_actions(user_id, scheduled_at);

CREATE TABLE micro_action_logs (
  id BIGSERIAL PRIMARY KEY,
  micro_action_id BIGINT NOT NULL REFERENCES micro_actions(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  result VARCHAR(20) NOT NULL CHECK (result IN ('DONE', 'FAILED', 'SKIPPED')),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  memo TEXT
);
CREATE INDEX idx_micro_action_logs_user_time ON micro_action_logs(user_id, executed_at DESC);
CREATE INDEX idx_micro_action_logs_action ON micro_action_logs(micro_action_id);

CREATE TABLE consistency_states (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak_days INT NOT NULL DEFAULT 0 CHECK (current_streak_days >= 0),
  best_streak_days INT NOT NULL DEFAULT 0 CHECK (best_streak_days >= 0),
  execution_rate_14d NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (execution_rate_14d BETWEEN 0 AND 1),
  consistency_score INT NOT NULL DEFAULT 0 CHECK (consistency_score BETWEEN 0 AND 100),
  streak_recover_tokens INT NOT NULL DEFAULT 0 CHECK (streak_recover_tokens >= 0),
  last_streak_updated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE goal_prediction_snapshots (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_type VARCHAR(20) NOT NULL CHECK (goal_type IN ('WEEKLY', 'MICRO')),
  target_id BIGINT NOT NULL,
  score INT NOT NULL CHECK (score BETWEEN 0 AND 100),
  duration_min INT NOT NULL CHECK (duration_min >= 0),
  difficulty INT NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  historical_success_rate NUMERIC(5,4) NOT NULL CHECK (historical_success_rate BETWEEN 0 AND 1),
  timeslot_success_rate NUMERIC(5,4) NOT NULL CHECK (timeslot_success_rate BETWEEN 0 AND 1),
  fatigue_level INT NOT NULL CHECK (fatigue_level BETWEEN 0 AND 5),
  suggested_downscale_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_prediction_user_created ON goal_prediction_snapshots(user_id, created_at DESC);

CREATE TABLE costumes (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  price_goal_coin INT NOT NULL CHECK (price_goal_coin >= 0),
  sprite_set_id VARCHAR(80) NOT NULL,
  skillset_id VARCHAR(80) NOT NULL,
  rarity VARCHAR(20) NOT NULL CHECK (rarity IN ('COMMON', 'RARE', 'EPIC', 'LEGENDARY')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE costume_requirements (
  id BIGSERIAL PRIMARY KEY,
  costume_id BIGINT NOT NULL REFERENCES costumes(id) ON DELETE CASCADE,
  requirement_type VARCHAR(40) NOT NULL CHECK (
    requirement_type IN ('STREAK_DAYS', 'ROUTINE_COUNT', 'WEEKLY_CLEAR_COUNT', 'VISION_CLEAR_COUNT')
  ),
  operator VARCHAR(10) NOT NULL CHECK (operator IN ('GTE', 'EQ')),
  target_value INT NOT NULL CHECK (target_value >= 0)
);
CREATE INDEX idx_costume_requirements_costume ON costume_requirements(costume_id);

CREATE TABLE user_costumes (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  costume_id BIGINT NOT NULL REFERENCES costumes(id) ON DELETE CASCADE,
  owned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_equipped BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (user_id, costume_id)
);
CREATE UNIQUE INDEX ux_user_one_equipped_costume ON user_costumes(user_id) WHERE is_equipped = TRUE;

CREATE TABLE battle_stages (
  id BIGSERIAL PRIMARY KEY,
  zone_name VARCHAR(80) NOT NULL,
  name VARCHAR(80) NOT NULL,
  monster_name VARCHAR(80) NOT NULL,
  monster_hp INT NOT NULL CHECK (monster_hp > 0),
  required_atk INT NOT NULL DEFAULT 0 CHECK (required_atk >= 0),
  base_gold_per_kill INT NOT NULL CHECK (base_gold_per_kill > 0),
  flavor_text TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE player_battle_states (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_stage_id BIGINT NOT NULL REFERENCES battle_stages(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE skills (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  job VARCHAR(20) CHECK (job IN ('SWORDSMAN', 'MAGE')),
  stat_type VARCHAR(30) NOT NULL CHECK (stat_type IN ('ATK', 'HP', 'IDLE_GOLD_RATE', 'GOAL_COIN_RATE')),
  effect_base NUMERIC(10,4) NOT NULL DEFAULT 0,
  effect_per_level NUMERIC(10,4) NOT NULL DEFAULT 0,
  max_level INT NOT NULL DEFAULT 5 CHECK (max_level > 0),
  unlock_idle_gold INT NOT NULL DEFAULT 0 CHECK (unlock_idle_gold >= 0),
  upgrade_idle_gold INT NOT NULL DEFAULT 0 CHECK (upgrade_idle_gold >= 0),
  required_level INT NOT NULL DEFAULT 1 CHECK (required_level >= 1),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_skills_job ON skills(job, active);

CREATE TABLE user_skills (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id BIGINT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  level INT NOT NULL DEFAULT 1 CHECK (level > 0),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, skill_id)
);
CREATE INDEX idx_user_skills_user ON user_skills(user_id);
CREATE TABLE idle_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage_id BIGINT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  minutes INT NOT NULL CHECK (minutes >= 0),
  gold_earned BIGINT NOT NULL CHECK (gold_earned >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT idle_session_time_valid CHECK (ended_at >= started_at)
);
CREATE INDEX idx_idle_sessions_user_ended ON idle_sessions(user_id, ended_at DESC);

COMMIT;



