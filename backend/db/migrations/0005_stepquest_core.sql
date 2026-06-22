-- migration: STEPQUEST product domain tables

CREATE TABLE IF NOT EXISTS stepquest_goals (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(140) NOT NULL,
  normalized_title VARCHAR(140),
  category VARCHAR(40) NOT NULL CHECK (
    category IN ('study', 'work', 'writing', 'cleaning', 'exercise', 'wake', 'sleep', 'life_admin', 'relationship')
  ),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (
    status IN ('draft', 'active', 'paused', 'completed', 'archived')
  ),
  burden_level INT NOT NULL CHECK (burden_level BETWEEN 1 AND 4),
  target_at TIMESTAMPTZ,
  recurrence_rule TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_stepquest_goals_user_status
  ON stepquest_goals(user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS stepquest_chains (
  id BIGSERIAL PRIMARY KEY,
  goal_id BIGINT NOT NULL REFERENCES stepquest_goals(id) ON DELETE CASCADE,
  revision INT NOT NULL DEFAULT 1 CHECK (revision > 0),
  source VARCHAR(20) NOT NULL CHECK (source IN ('template', 'ai', 'manual', 'costume')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stepquest_chains_goal_status
  ON stepquest_chains(goal_id, status, revision DESC);

CREATE TABLE IF NOT EXISTS stepquest_micro_steps (
  id BIGSERIAL PRIMARY KEY,
  chain_id BIGINT NOT NULL REFERENCES stepquest_chains(id) ON DELETE CASCADE,
  title VARCHAR(160) NOT NULL,
  success_criterion VARCHAR(180) NOT NULL,
  phase VARCHAR(20) NOT NULL CHECK (phase IN ('orient', 'prepare', 'open', 'start', 'continue', 'close')),
  order_index INT NOT NULL CHECK (order_index >= 0),
  estimated_seconds INT NOT NULL CHECK (estimated_seconds > 0),
  grade VARCHAR(1) NOT NULL CHECK (grade IN ('F', 'E', 'D', 'C', 'B', 'A', 'S')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'active', 'completed', 'deferred', 'skipped', 'replaced')
  ),
  xp_reward INT NOT NULL DEFAULT 1 CHECK (xp_reward >= 0),
  facility_reward INT NOT NULL DEFAULT 1 CHECK (facility_reward >= 0),
  activated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stepquest_micro_steps_chain_order
  ON stepquest_micro_steps(chain_id, order_index);
CREATE INDEX IF NOT EXISTS idx_stepquest_micro_steps_status
  ON stepquest_micro_steps(status, activated_at DESC);

CREATE TABLE IF NOT EXISTS stepquest_step_attempts (
  id BIGSERIAL PRIMARY KEY,
  step_id BIGINT NOT NULL REFERENCES stepquest_micro_steps(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL CHECK (action IN ('complete', 'shrink', 'defer', 'skip', 'undo')),
  reason VARCHAR(40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stepquest_step_attempts_user_time
  ON stepquest_step_attempts(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS stepquest_reward_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('step', 'return', 'achievement')),
  source_id BIGINT NOT NULL,
  reward_type VARCHAR(30) NOT NULL CHECK (
    reward_type IN ('xp', 'facility_xp', 'return_mark', 'costume_fragment')
  ),
  amount INT NOT NULL CHECK (amount >= 0),
  idempotency_key VARCHAR(160) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_stepquest_rewards_user_time
  ON stepquest_reward_transactions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS stepquest_village_facilities (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  facility_key VARCHAR(40) NOT NULL CHECK (
    facility_key IN ('knowledge_tower', 'guild_office', 'training_ground', 'workshop', 'archive', 'inn', 'kitchen', 'garden')
  ),
  level INT NOT NULL DEFAULT 1 CHECK (level >= 1),
  xp INT NOT NULL DEFAULT 0 CHECK (xp >= 0),
  material INT NOT NULL DEFAULT 0 CHECK (material >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, facility_key)
);

CREATE TABLE IF NOT EXISTS stepquest_user_states (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  level INT NOT NULL DEFAULT 1 CHECK (level >= 1),
  xp INT NOT NULL DEFAULT 0 CHECK (xp >= 0),
  material INT NOT NULL DEFAULT 0 CHECK (material >= 0),
  return_marks INT NOT NULL DEFAULT 0 CHECK (return_marks >= 0),
  equipped_costume_id VARCHAR(80) NOT NULL DEFAULT 'starter_mage',
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stepquest_return_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id BIGINT REFERENCES stepquest_goals(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  recovery_step_id BIGINT REFERENCES stepquest_micro_steps(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_stepquest_return_sessions_user_time
  ON stepquest_return_sessions(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS stepquest_reminders (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  step_id BIGINT REFERENCES stepquest_micro_steps(id) ON DELETE SET NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  minutes INT NOT NULL CHECK (minutes BETWEEN 1 AND 1440),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
