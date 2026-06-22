CREATE TABLE IF NOT EXISTS user_settings (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Seoul',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_events (
  id BIGSERIAL PRIMARY KEY,
  event_name VARCHAR(80) NOT NULL,
  anonymous_user_id VARCHAR(120) NOT NULL,
  account_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  session_id VARCHAR(120) NOT NULL,
  goal_id VARCHAR(80),
  step_id VARCHAR(80),
  category VARCHAR(40),
  estimated_seconds INT,
  app_version VARCHAR(40) NOT NULL,
  environment VARCHAR(40) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_events_name_time
  ON product_events(event_name, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_events_account_time
  ON product_events(account_user_id, occurred_at DESC);
