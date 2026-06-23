#!/usr/bin/env node
const { Pool } = require('pg');

const windowDays = Number(process.env.REPORT_DAYS || process.argv[2] || 7);
const databaseUrl = process.env.DATABASE_URL;
const reportEnvironment = process.env.REPORT_ENV || process.env.NODE_ENV || 'production';
const reportTimezone = process.env.REPORT_TIMEZONE || 'Asia/Seoul';

if (!databaseUrl) {
  console.error('DATABASE_URL is required. Example: DATABASE_URL=postgresql://... npm run analytics:report');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

function ratio(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((Number(numerator || 0) / Number(denominator || 0)) * 1000) / 10;
}

function eventWindowWhere() {
  return `occurred_at >= NOW() - $1::interval AND environment = $2`;
}

async function main() {
  const since = `${windowDays} days`;
  const reportParams = [since, reportEnvironment];

  const eventCounts = await pool.query(
    `SELECT event_name AS "eventName", COUNT(*)::int AS count
     FROM product_events
     WHERE ${eventWindowWhere()}
     GROUP BY event_name
     ORDER BY count DESC, event_name ASC`,
    reportParams,
  );

  const totals = await pool.query(
    `SELECT
       COUNT(DISTINCT anonymous_user_id)::int AS "anonymousUsers",
       COUNT(DISTINCT session_id)::int AS sessions,
       COUNT(*)::int AS events
     FROM product_events
     WHERE ${eventWindowWhere()}`,
    reportParams,
  );

  const funnel = await pool.query(
    `WITH session_flags AS (
       SELECT
         session_id,
         BOOL_OR(event_name = 'app_opened') AS opened,
         BOOL_OR(event_name = 'goal_created') AS goal_created,
         BOOL_OR(event_name = 'first_step_shown') AS first_step_shown,
         BOOL_OR(event_name = 'step_completed') AS step_completed,
         BOOL_OR(event_name = 'step_undone') AS step_undone,
         BOOL_OR(event_name = 'step_shrunk') AS step_shrunk,
         BOOL_OR(event_name = 'step_skipped') AS step_skipped,
         BOOL_OR(event_name = 'session_deferred') AS session_deferred,
         BOOL_OR(event_name = 'return_offered') AS return_offered,
         BOOL_OR(event_name = 'return_started') AS return_started,
         BOOL_OR(event_name = 'return_completed') AS return_completed,
         BOOL_OR(event_name = 'goal_cleared') AS goal_cleared,
         BOOL_OR(event_name = 'guest_import_completed') AS guest_import_completed
       FROM product_events
       WHERE ${eventWindowWhere()}
       GROUP BY session_id
     )
     SELECT
       COUNT(*)::int AS sessions,
       COUNT(*) FILTER (WHERE opened)::int AS opened,
       COUNT(*) FILTER (WHERE goal_created)::int AS "goalCreated",
       COUNT(*) FILTER (WHERE first_step_shown)::int AS "firstStepShown",
       COUNT(*) FILTER (WHERE step_completed)::int AS "stepCompleted",
       COUNT(*) FILTER (WHERE step_undone)::int AS "stepUndone",
       COUNT(*) FILTER (WHERE step_shrunk)::int AS "stepShrunk",
       COUNT(*) FILTER (WHERE step_shrunk AND step_completed)::int AS "shrunkAndCompleted",
       COUNT(*) FILTER (WHERE step_skipped)::int AS "stepSkipped",
       COUNT(*) FILTER (WHERE session_deferred)::int AS "sessionDeferred",
       COUNT(*) FILTER (WHERE return_offered)::int AS "returnOffered",
       COUNT(*) FILTER (WHERE return_offered AND return_started)::int AS "returnStarted",
       COUNT(*) FILTER (WHERE return_started AND return_completed)::int AS "returnCompleted",
       COUNT(*) FILTER (WHERE goal_cleared)::int AS "goalCleared",
       COUNT(*) FILTER (WHERE guest_import_completed)::int AS "guestImportCompleted"
     FROM session_flags`,
    reportParams,
  );

  const categories = await pool.query(
    `SELECT category, COUNT(*)::int AS count
     FROM product_events
     WHERE ${eventWindowWhere()}
       AND category IS NOT NULL
     GROUP BY category
     ORDER BY count DESC, category ASC`,
    reportParams,
  );

  const retention = await pool.query(
    `WITH user_days AS (
       SELECT
         COALESCE(account_user_id::text, anonymous_user_id) AS user_key,
         (occurred_at AT TIME ZONE $3)::date AS event_day
       FROM product_events
       WHERE ${eventWindowWhere()}
     ),
     cohorts AS (
       SELECT user_key, MIN(event_day) AS first_day
       FROM user_days
       GROUP BY user_key
     )
     SELECT
       COUNT(*)::int AS cohort,
       COUNT(*) FILTER (
         WHERE EXISTS (
           SELECT 1
           FROM user_days d1
           WHERE d1.user_key = cohorts.user_key
             AND d1.event_day = cohorts.first_day + 1
         )
       )::int AS "d1Returned",
       COUNT(*) FILTER (
         WHERE EXISTS (
           SELECT 1
           FROM user_days d7
           WHERE d7.user_key = cohorts.user_key
             AND d7.event_day = cohorts.first_day + 7
       )
     )::int AS "d7Returned"
     FROM cohorts`,
    [...reportParams, reportTimezone],
  );

  const f = funnel.rows[0] || {};
  const r = retention.rows[0] || {};
  const report = {
    ok: true,
    checked: 'product-events',
    windowDays,
    environment: reportEnvironment,
    timezone: reportTimezone,
    totals: totals.rows[0] || { anonymousUsers: 0, sessions: 0, events: 0 },
    funnel: {
      sessions: Number(f.sessions || 0),
      opened: Number(f.opened || 0),
      goalCreated: Number(f.goalCreated || 0),
      firstStepShown: Number(f.firstStepShown || 0),
      stepCompleted: Number(f.stepCompleted || 0),
      stepUndone: Number(f.stepUndone || 0),
      stepShrunk: Number(f.stepShrunk || 0),
      shrunkAndCompleted: Number(f.shrunkAndCompleted || 0),
      stepSkipped: Number(f.stepSkipped || 0),
      sessionDeferred: Number(f.sessionDeferred || 0),
      returnOffered: Number(f.returnOffered || 0),
      returnStarted: Number(f.returnStarted || 0),
      returnCompleted: Number(f.returnCompleted || 0),
      goalCleared: Number(f.goalCleared || 0),
      guestImportCompleted: Number(f.guestImportCompleted || 0),
      goalToFirstCompletionPct: ratio(f.stepCompleted, f.goalCreated),
      firstStepShownToCompletionPct: ratio(f.stepCompleted, f.firstStepShown),
      completionUndoPct: ratio(f.stepUndone, f.stepCompleted),
      shrinkToCompletionPct: ratio(f.shrunkAndCompleted, f.stepShrunk),
      skipAfterShownPct: ratio(f.stepSkipped, f.firstStepShown),
      deferAfterShownPct: ratio(f.sessionDeferred, f.firstStepShown),
      returnOfferToStartPct: ratio(f.returnStarted, f.returnOffered),
      returnStartToCompletePct: ratio(f.returnCompleted, f.returnStarted),
      goalClearPct: ratio(f.goalCleared, f.goalCreated),
    },
    retention: {
      cohort: Number(r.cohort || 0),
      d1Returned: Number(r.d1Returned || 0),
      d7Returned: Number(r.d7Returned || 0),
      d1RetentionPct: ratio(r.d1Returned, r.cohort),
      d7RetentionPct: ratio(r.d7Returned, r.cohort),
    },
    events: eventCounts.rows,
    categories: categories.rows,
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => pool.end());
