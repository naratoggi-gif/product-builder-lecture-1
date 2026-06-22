BEGIN;

CREATE TABLE IF NOT EXISTS battle_stages (
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

CREATE TABLE IF NOT EXISTS player_battle_states (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_stage_id BIGINT NOT NULL REFERENCES battle_stages(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO battle_stages (id, zone_name, name, monster_name, monster_hp, required_atk, base_gold_per_kill, flavor_text, active)
VALUES
  (1, '훈련 평원', '초원 입구', '슬라임', 18, 0, 4, '가장 기본적인 사냥 구역이다.', TRUE),
  (2, '훈련 평원', '바람 언덕', '뿔토끼', 32, 18, 7, '민첩한 토끼를 상대하며 공격 템포를 익힌다.', TRUE),
  (3, '황혼 숲', '숲 가장자리', '그림자 늑대', 55, 35, 11, '연속 전투를 감당할 체력과 화력이 필요하다.', TRUE),
  (4, '황혼 숲', '폐허 제단', '망령 기사', 88, 55, 16, '기초 성장 루프를 끝낸 유저가 진입하는 구간이다.', TRUE)
ON CONFLICT (id) DO UPDATE
SET
  zone_name = EXCLUDED.zone_name,
  name = EXCLUDED.name,
  monster_name = EXCLUDED.monster_name,
  monster_hp = EXCLUDED.monster_hp,
  required_atk = EXCLUDED.required_atk,
  base_gold_per_kill = EXCLUDED.base_gold_per_kill,
  flavor_text = EXCLUDED.flavor_text,
  active = EXCLUDED.active;

INSERT INTO player_battle_states (user_id, current_stage_id)
SELECT id, 1
FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM player_battle_states pbs WHERE pbs.user_id = users.id
);

COMMIT;
