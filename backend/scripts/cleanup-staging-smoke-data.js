#!/usr/bin/env node
const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;
const dryRun = process.env.SMOKE_CLEANUP_DRY_RUN !== 'false';
const confirmed = process.env.CONFIRM_STAGING_SMOKE_CLEANUP === 'true';
const minAgeHours = Number(process.env.SMOKE_CLEANUP_MIN_AGE_HOURS || 0);

if (!databaseUrl) {
  console.error('DATABASE_URL is required. Example: DATABASE_URL=postgresql://... npm run smoke:cleanup');
  process.exit(1);
}

if (!Number.isFinite(minAgeHours) || minAgeHours < 0) {
  console.error('SMOKE_CLEANUP_MIN_AGE_HOURS must be a non-negative number.');
  process.exit(1);
}

if (!dryRun && !confirmed) {
  console.error('Refusing to delete smoke data without CONFIRM_STAGING_SMOKE_CLEANUP=true.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

const userEmailPatterns = ['staging-smoke+%@example.com', 'staging-smoke-import+%@example.com'];
const smokeAnonymousIds = ['staging-smoke-anon'];

async function smokeSummary(client) {
  const userSummary = await client.query(
    `SELECT
       COUNT(*)::int AS count,
       COALESCE(ARRAY_AGG(email ORDER BY created_at DESC) FILTER (WHERE email IS NOT NULL), '{}') AS emails
     FROM users
     WHERE (email LIKE $1 OR email LIKE $2)
       AND created_at <= NOW() - ($3::text || ' hours')::interval`,
    [...userEmailPatterns, minAgeHours],
  );
  const eventSummary = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM product_events
     WHERE anonymous_user_id = ANY($1::text[])
       AND occurred_at <= NOW() - ($2::text || ' hours')::interval`,
    [smokeAnonymousIds, minAgeHours],
  );
  return {
    users: userSummary.rows[0],
    productEvents: eventSummary.rows[0],
  };
}

async function deleteSmokeData(client) {
  const deletedEvents = await client.query(
    `DELETE FROM product_events
     WHERE anonymous_user_id = ANY($1::text[])
       AND occurred_at <= NOW() - ($2::text || ' hours')::interval
     RETURNING id`,
    [smokeAnonymousIds, minAgeHours],
  );
  const deletedUsers = await client.query(
    `DELETE FROM users
     WHERE id IN (
       SELECT id
       FROM users
       WHERE (email LIKE $1 OR email LIKE $2)
         AND created_at <= NOW() - ($3::text || ' hours')::interval
     )
     RETURNING id, email`,
    [...userEmailPatterns, minAgeHours],
  );
  return {
    users: deletedUsers.rows,
    productEventCount: deletedEvents.rowCount,
  };
}

async function main() {
  const client = await pool.connect();
  try {
    const before = await smokeSummary(client);
    if (dryRun) {
      console.log(JSON.stringify({
        ok: true,
        checked: 'staging-smoke-cleanup',
        dryRun,
        minAgeHours,
        candidateUserCount: Number(before.users.count || 0),
        candidateProductEventCount: Number(before.productEvents.count || 0),
        sampleEmails: (before.users.emails || []).slice(0, 10),
      }, null, 2));
      return;
    }

    await client.query('BEGIN');
    const deleted = await deleteSmokeData(client);
    await client.query('COMMIT');

    console.log(JSON.stringify({
      ok: true,
      checked: 'staging-smoke-cleanup',
      dryRun,
      minAgeHours,
      deletedUserCount: deleted.users.length,
      deletedProductEventCount: deleted.productEventCount,
      deletedEmails: deleted.users.map((row) => row.email),
    }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => pool.end());
