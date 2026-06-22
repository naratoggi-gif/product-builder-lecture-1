#!/usr/bin/env node
const { Pool } = require('pg');

const windowDays = Number(process.env.REPORT_DAYS || process.argv[2] || 7);
const databaseUrl = process.env.DATABASE_URL;

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

async function main() {
  const since = `${windowDays} days`;

  const eventCounts = await pool.query(
    `SELECT event_name AS "eventName", COUNT(*)::int AS count
     FROM product_events
     WHERE occurred_at >= NOW() - $1::interval
     GROUP BY event_name
     ORDER BY count DESC, event_name ASC`,
    [since],
  );

  const totals = await pool.query(
    `SELECT
       COUNT(DISTINCT anonymous_user_id)::int AS "anonymousUsers",
       COUNT(DISTINCT session_id)::int AS sessions,
       COUNT(*)::int AS events
     FROM product_events
     WHERE occurred_at >= NOW() - $1::interval`,
    [since],
  );

  const funnel = await pool.query(
    `WITH session_flags AS (
       SELECT
         session_id,
         BOOL_OR(event_name = 'app_opened') AS opened,
         BOOL_OR(event_name = 'goal_created') AS goal_created,
         BOOL_OR(event_name = 'first_step_shown') AS first_step_shown,
         BOOL_OR(event_name = 'step_completed') AS step_completed,
         BOOL_OR(event_name = 'step_shrunk') AS step_shrunk,
         BOOL_OR(event_name = 'return_offered') AS return_offered,
         BOOL_OR(event_name = 'return_started') AS return_started,
         BOOL_OR(event_name = 'guest_import_completed') AS guest_import_completed
       FROM product_events
       WHERE occurred_at >= NOW() - $1::interval
       GROUP BY session_id
     )
     SELECT
       COUNT(*)::int AS sessions,
       COUNT(*) FILTER (WHERE opened)::int AS opened,
       COUNT(*) FILTER (WHERE goal_created)::int AS "goalCreated",
       COUNT(*) FILTER (WHERE first_step_shown)::int AS "firstStepShown",
       COUNT(*) FILTER (WHERE step_completed)::int AS "stepCompleted",
       COUNT(*) FILTER (WHERE step_shrunk)::int AS "stepShrunk",
       COUNT(*) FILTER (WHERE step_shrunk AND step_completed)::int AS "shrunkAndCompleted",
       COUNT(*) FILTER (WHERE return_offered)::int AS "returnOffered",
       COUNT(*) FILTER (WHERE return_offered AND return_started)::int AS "returnStarted",
       COUNT(*) FILTER (WHERE guest_import_completed)::int AS "guestImportCompleted"
     FROM session_flags`,
    [since],
  );

  const categories = await pool.query(
    `SELECT category, COUNT(*)::int AS count
     FROM product_events
     WHERE occurred_at >= NOW() - $1::interval
       AND category IS NOT NULL
     GROUP BY category
     ORDER BY count DESC, category ASC`,
    [since],
  );

  const f = funnel.rows[0] || {};
  const report = {
    ok: true,
    checked: 'product-events',
    windowDays,
    totals: totals.rows[0] || { anonymousUsers: 0, sessions: 0, events: 0 },
    funnel: {
      sessions: Number(f.sessions || 0),
      opened: Number(f.opened || 0),
      goalCreated: Number(f.goalCreated || 0),
      firstStepShown: Number(f.firstStepShown || 0),
      stepCompleted: Number(f.stepCompleted || 0),
      stepShrunk: Number(f.stepShrunk || 0),
      shrunkAndCompleted: Number(f.shrunkAndCompleted || 0),
      returnOffered: Number(f.returnOffered || 0),
      returnStarted: Number(f.returnStarted || 0),
      guestImportCompleted: Number(f.guestImportCompleted || 0),
      goalToFirstCompletionPct: ratio(f.stepCompleted, f.goalCreated),
      shrinkToCompletionPct: ratio(f.shrunkAndCompleted, f.stepShrunk),
      returnOfferToStartPct: ratio(f.returnStarted, f.returnOffered),
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
