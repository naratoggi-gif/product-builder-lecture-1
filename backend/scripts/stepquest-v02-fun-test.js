#!/usr/bin/env node
const assert = require('node:assert/strict');
const Fun = require('../public/assets/js/stepquest-v02-fun.js');

assert.deepEqual(
  Fun.deriveTimer({ plannedMinutes: 5, expiresAt: '2026-07-12T00:05:00.000Z' }, '2026-07-12T00:04:00.000Z'),
  { phase: 'running', remainingMs: 60_000, plannedMinutes: 5 },
);
assert.equal(Fun.deriveTimer({ startedAt: '2026-07-11T00:00:00.000Z' }, '2026-07-12T00:00:00.000Z').phase, 'legacy_ready');
assert.equal(Fun.deriveTimer({ plannedMinutes: 5 }, '2026-07-12T00:00:00.000Z').phase, 'legacy_ready');
assert.equal(Fun.deriveTimer({ plannedMinutes: 15, expiresAt: '2026-07-12T00:05:00.000Z' }, '2026-07-12T00:00:00.000Z').phase, 'legacy_ready');
assert.equal(Fun.deriveTimer({ plannedMinutes: '5', expiresAt: '2026-07-12T00:05:00.000Z' }, '2026-07-12T00:00:00.000Z').phase, 'legacy_ready');
assert.throws(() => Fun.deriveTimer({ plannedMinutes: 5, expiresAt: '2026-07-12T00:05:00.000Z' }, 'not-a-clock'), /CLOCK_TIME_INVALID/);
assert.equal(Fun.hash32('hello'), 0x4f9f2cab);
assert.equal(Fun.routeForMinutes(5).key, 'camp_edge');
assert.equal(Fun.routeForMinutes(10).key, 'old_forest');
assert.equal(Fun.routeForMinutes(25).key, 'deep_ruins');

const encounter = Fun.selectEncounter({ rewardLineage: 'lineage-1', category: 'writing', boss: false });
assert.deepEqual(encounter, Fun.selectEncounter({ rewardLineage: 'lineage-1', category: 'writing', boss: false }));
assert.equal(Fun.deriveEncounterHp({ status: 'active', rewardLineage: 'lineage-1' }, []), 2);
assert.equal(Fun.deriveEncounterHp({ status: 'active', rewardLineage: 'lineage-1' }, [{ currency: 'stepCoin', stage: 'progress', rewardLineage: 'lineage-1' }]), 1);
assert.equal(Fun.deriveEncounterHp({ status: 'completed', rewardLineage: 'lineage-1' }, []), 0);

const reportEvent = {
  idempotencyKey: 'report-1', expeditionId: 'expedition-1', outcome: 'completed',
  result: { rewardLineage: 'lineage-1', category: 'writing', reportVersion: 1, goalMilestone: false, goldGranted: 1 },
};
const report = Fun.buildBattleReport({ event: reportEvent, expedition: { plannedMinutes: 10 } });
assert.equal(report.goldGranted, 1);
assert.equal(report.defeatCount, 1);
assert.deepEqual(report, Fun.buildBattleReport({ event: reportEvent, expedition: { plannedMinutes: 10 } }));
assert.equal(Fun.buildCodex([reportEvent]).entries.find((entry) => entry.id === report.monsterId).count, 1);
assert.equal(Fun.buildCodex([reportEvent, reportEvent]).entries.find((entry) => entry.id === report.monsterId).count, 1);

const firstDialogue = Fun.selectDialogue({ context: 'ready', entityId: 'expedition-1', localDate: '2026-07-12', subject: '잉크 슬라임' });
assert.equal(firstDialogue, Fun.selectDialogue({ context: 'ready', entityId: 'expedition-1', localDate: '2026-07-12', subject: '잉크 슬라임' }));
assert.notEqual(firstDialogue, Fun.selectDialogue({ context: 'ready', entityId: 'expedition-1', localDate: '2026-07-12', subject: '잉크 슬라임', previousText: firstDialogue }));
assert.match(Fun.buildNextDesire({ camp: { level: 1, nextCost: 3 }, wallet: { gold: 3 }, activeStep: null, encounter: null, codex: { entries: [] } }).text, /지금 확장/);
assert.match(Fun.buildNextDesire({
  camp: { level: 1, nextCost: 3 }, wallet: { gold: 0 }, activeStep: { title: '첫 문장 쓰기' }, encounter,
  codex: { entries: [{ id: encounter.id, discovered: false }] },
}).text, /첫 문장 쓰기.*\?\?\?/);

console.log(JSON.stringify({ ok: true, checked: 'stepquest-v02-fun' }, null, 2));
