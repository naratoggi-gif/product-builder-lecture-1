-- migration: auth password + daily goal coin earnings

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(120);

UPDATE users
SET password_hash = COALESCE(password_hash, '$2a$10$P4ugQ2GZ1nyfJQwWi4K3xubHR4QjJ5J8mYfwH7P0cfhy7qLMJw6By')
WHERE password_hash IS NULL;

ALTER TABLE users
  ALTER COLUMN password_hash SET NOT NULL;

CREATE TABLE IF NOT EXISTS daily_goal_coin_earnings (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_key DATE NOT NULL,
  earned_goal_coin INT NOT NULL DEFAULT 0 CHECK (earned_goal_coin >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, date_key)
);

CREATE INDEX IF NOT EXISTS idx_daily_goal_coin_earnings_user_date
  ON daily_goal_coin_earnings (user_id, date_key DESC);
