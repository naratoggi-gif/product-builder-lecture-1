#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { setTimeout: sleep } = require('timers/promises');

async function connectWithRetry(client) {
  let lastError;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      await client.connect();
      return;
    } catch (error) {
      lastError = error;
      process.stdout.write(`Waiting for database (${attempt}/20): ${error.message}\n`);
      await sleep(1000);
    }
  }
  throw lastError;
}

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set.');
  }

  const files = [
    { name: '0001_init', path: path.resolve(__dirname, '../db/migrations/0001_init/migration.sql') },
    { name: '0002_auth_and_rewards', path: path.resolve(__dirname, '../db/migrations/0002_auth_and_rewards.sql') },
    { name: '0003_skills', path: path.resolve(__dirname, '../db/migrations/0003_skills.sql') },
    { name: '0004_battle_stages', path: path.resolve(__dirname, '../db/migrations/0004_battle_stages.sql') },
    { name: '0005_stepquest_core', path: path.resolve(__dirname, '../db/migrations/0005_stepquest_core.sql') },
    { name: '0006_stepquest_costume_active', path: path.resolve(__dirname, '../db/migrations/0006_stepquest_costume_active.sql') },
    { name: '0007_stepquest_guest_migrations', path: path.resolve(__dirname, '../db/migrations/0007_stepquest_guest_migrations.sql') },
    { name: '0008_user_settings_and_events', path: path.resolve(__dirname, '../db/migrations/0008_user_settings_and_events.sql') },
    { name: 'seed', path: path.resolve(__dirname, '../db/seed.sql') },
  ];

  const client = new Client({
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  await connectWithRetry(client);
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS codex_migrations (
        name VARCHAR(120) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const file of files) {
      const alreadyApplied = await client.query(
        'SELECT name FROM codex_migrations WHERE name = $1',
        [file.name],
      );

      if (alreadyApplied.rowCount) {
        process.stdout.write(`Skipping: ${file.name}\n`);
        continue;
      }

      const sql = fs.readFileSync(file.path, 'utf8').replace(/^\uFEFF/, '');
      process.stdout.write(`Applying: ${file.name}\n`);
      try {
        await client.query(sql);
      } catch (error) {
        error.message = `While applying ${file.name}: ${error.message}`;
        throw error;
      }
      await client.query('INSERT INTO codex_migrations (name) VALUES ($1)', [file.name]);
    }

    process.stdout.write('DB init completed.\n');
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  const message = String(err?.stack || err?.message || err).replace(/\r?\n/g, '%0A');
  console.error(`::error title=DB init failed::${message}`);
  console.error('DB init failed:', err.message);
  process.exit(1);
});


