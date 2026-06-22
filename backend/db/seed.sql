-- idempotent sample data for costumes
INSERT INTO costumes (id, name, price_goal_coin, sprite_set_id, skillset_id, rarity, active)
VALUES
  (101, 'Iron Vanguard', 100, 'sprite_iron_vanguard', 'skillset_iron_vanguard', 'RARE', TRUE),
  (102, 'Abyss Scholar', 220, 'sprite_abyss_scholar', 'skillset_abyss_scholar', 'EPIC', TRUE)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  price_goal_coin = EXCLUDED.price_goal_coin,
  sprite_set_id = EXCLUDED.sprite_set_id,
  skillset_id = EXCLUDED.skillset_id,
  rarity = EXCLUDED.rarity,
  active = EXCLUDED.active;

INSERT INTO costume_requirements (costume_id, requirement_type, operator, target_value)
SELECT 101, 'STREAK_DAYS', 'GTE', 3
WHERE NOT EXISTS (
  SELECT 1 FROM costume_requirements WHERE costume_id = 101 AND requirement_type = 'STREAK_DAYS'
);

INSERT INTO costume_requirements (costume_id, requirement_type, operator, target_value)
SELECT 102, 'STREAK_DAYS', 'GTE', 7
WHERE NOT EXISTS (
  SELECT 1 FROM costume_requirements WHERE costume_id = 102 AND requirement_type = 'STREAK_DAYS'
);
