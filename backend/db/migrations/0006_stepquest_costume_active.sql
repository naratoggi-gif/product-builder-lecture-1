ALTER TABLE stepquest_step_attempts
  DROP CONSTRAINT IF EXISTS stepquest_step_attempts_action_check;

ALTER TABLE stepquest_step_attempts
  ADD CONSTRAINT stepquest_step_attempts_action_check
  CHECK (action IN ('complete', 'shrink', 'defer', 'skip', 'undo', 'costume_active'));
