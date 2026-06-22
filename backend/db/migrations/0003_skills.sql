BEGIN;

CREATE TABLE IF NOT EXISTS skills (
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

CREATE TABLE IF NOT EXISTS user_skills (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id BIGINT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  level INT NOT NULL DEFAULT 1 CHECK (level > 0),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_skills_job ON skills(job, active);
CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_skills(user_id);

INSERT INTO skills (code, name, description, job, stat_type, effect_base, effect_per_level, max_level, unlock_idle_gold, upgrade_idle_gold, required_level)
VALUES
  ('sword_stance', '검사의 자세', '기본 자세를 다듬어 공격력을 올립니다.', 'SWORDSMAN', 'ATK', 3, 2, 5, 120, 90, 1),
  ('iron_guard', '철벽 방어', '체력을 높여 장기전에 강해집니다.', 'SWORDSMAN', 'HP', 20, 15, 5, 140, 100, 1),
  ('mana_focus', '마나 집중', '마력 흐름을 안정시켜 방치 수익을 끌어올립니다.', 'MAGE', 'IDLE_GOLD_RATE', 0.08, 0.05, 5, 130, 95, 1),
  ('arcane_shell', '비전 보호막', '생존력을 높이는 보호막 계열 스킬입니다.', 'MAGE', 'HP', 18, 14, 5, 145, 105, 1),
  ('field_discipline', '루틴 단련', '직업과 무관하게 방치 보상 효율을 높입니다.', NULL, 'IDLE_GOLD_RATE', 0.05, 0.03, 5, 160, 110, 1),
  ('goal_habit', '습관 각인', '목표 행동으로 얻는 보상을 강화하기 위한 기반 패시브입니다.', NULL, 'GOAL_COIN_RATE', 0.04, 0.02, 5, 180, 130, 1)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  job = EXCLUDED.job,
  stat_type = EXCLUDED.stat_type,
  effect_base = EXCLUDED.effect_base,
  effect_per_level = EXCLUDED.effect_per_level,
  max_level = EXCLUDED.max_level,
  unlock_idle_gold = EXCLUDED.unlock_idle_gold,
  upgrade_idle_gold = EXCLUDED.upgrade_idle_gold,
  required_level = EXCLUDED.required_level,
  active = TRUE;

COMMIT;
