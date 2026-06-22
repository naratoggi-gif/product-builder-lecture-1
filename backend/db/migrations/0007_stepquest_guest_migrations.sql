CREATE TABLE IF NOT EXISTS stepquest_guest_migrations (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  migration_id VARCHAR(160) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('imported', 'skipped')),
  imported_goal_count INT NOT NULL DEFAULT 0 CHECK (imported_goal_count >= 0),
  imported_step_count INT NOT NULL DEFAULT 0 CHECK (imported_step_count >= 0),
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, migration_id)
);

CREATE INDEX IF NOT EXISTS idx_stepquest_guest_migrations_user_time
  ON stepquest_guest_migrations(user_id, migrated_at DESC);
