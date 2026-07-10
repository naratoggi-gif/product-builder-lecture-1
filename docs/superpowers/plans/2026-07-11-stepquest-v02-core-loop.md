# StepQuest v0.2 Core Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the local-first StepQuest flow that persists a real start, recovers an expedition after reload, records one of four outcomes, and resumes from an exact physical action.

**Architecture:** Add pure browser-domain, IndexedDB, backup, application-facade, and UI modules alongside the existing framework-less PWA. The v0.2 modules become the source of truth for the primary “Now” flow; the NestJS account system and legacy guest payload remain intact for import and rollback.

**Tech Stack:** Browser JavaScript (IIFE/CommonJS-compatible modules), IndexedDB, File System Access API when available, HTML/CSS, Node 20 `assert`, NestJS static hosting, Playwright.

## Global Constraints

- Keep Node.js `>=20 <23` and npm `>=10`; add no runtime dependency.
- Keep app version `0.1.1-alpha` during this slice; update cache entries without a broad version migration.
- IndexedDB database name is `stepquest`, schema version is `2`.
- The primary screen shows one current Step.
- `startStep` is a persisted domain event; the existing timer is not a substitute.
- No elapsed-time reward, failure penalty, inactivity loss, or streak mutation is allowed.
- Entry reward is 2 StepCoin per contiguous entry segment, never per entry Step.
- Actual-work start is 5 StepCoin per `rewardLineage`, meaningful progress is 7 per `rewardLineage`, and Goal completion is 6 per Goal.
- Gold is capped at 2 per Step: completed fills the cap, partial grants at most 1, interrupted and not-started grant 0.
- Partial and interrupted outcomes require a non-empty `nextPhysicalAction` Resume Anchor.
- Not-started records the reason and ends in exactly one of `manual_shrink` or `defer`.
- `manual_shrink` inherits phase, entry segment, and reward lineage; `defer` always has a zero-reward `undeferStep` path.
- The legacy `stepquest_guest_state` value is never deleted or overwritten after migration commits.
- User-visible copy is Korean, non-judgmental, keyboard accessible, and compatible with reduced motion.
- Preserve unrelated untracked workspace files and directories.

---

## File Map

- Create `backend/public/assets/js/stepquest-v02-domain.js`: pure state, reward-lineage, entry-segment, outcome, anchor, defer/undefer, and obstacle transitions.
- Create `backend/public/assets/js/stepquest-v02-storage.js`: IndexedDB schema, transactions, migration, rolling snapshots, and localStorage fallback.
- Create `backend/public/assets/js/stepquest-v02-backup.js`: JSON serialization, download, persistent-storage request, and external file writing.
- Create `backend/public/assets/js/stepquest-v02-app.js`: facade joining domain, repository, backup, and the existing goal template factory.
- Create `backend/public/assets/js/stepquest-v02-ui.js`: render and wire the primary v0.2 screen.
- Modify `backend/public/assets/js/app.js`: guard legacy writes and expose the side-effect-free guest goal factory.
- Modify `backend/public/goals.html`: load v0.2 assets and mount the v0.2 UI after the existing shell refreshes.
- Modify `backend/public/assets/css/app.css`: v0.2 current-action, expedition, report, anchor, obstacle, and storage states.
- Modify `backend/public/sw.js`: precache all new v0.2 assets.
- Create `backend/scripts/stepquest-v02-domain-test.js`: pure transition test runner.
- Create `backend/scripts/stepquest-v02-backup-test.js`: pure export and external-backup test runner.
- Create `backend/e2e/stepquest-v02.spec.ts`: IndexedDB, reload, four outcomes, Resume Anchor, defer/undefer, migration guard, and backup browser coverage.
- Modify `backend/e2e/stepquest-alpha.spec.ts`: retain production-super-mode coverage and remove assertions for UI behavior v0.2 replaces.
- Modify `backend/package.json`: add the new Node runners to `test:domain`.
- Modify `backend/scripts/stepquest-persistence-test.js`: assert v0.2 assets, guard, cache, and UI hooks exist.
- Modify `blueprint.md`: mark the implemented slice and verification status.

---

### Task 1: Pure v0.2 Domain Transitions

**Files:**
- Create: `backend/public/assets/js/stepquest-v02-domain.js`
- Create: `backend/scripts/stepquest-v02-domain-test.js`
- Modify: `backend/package.json`

**Interfaces:**
- Consumes: plain state and command objects only.
- Produces: `createInitialState`, `assignEntrySegments`, `importGoal`, `startStep`, `reportOutcome`, `saveResumeAnchor`, `resumeStep`, `undeferStep`, `routeObstacle`, and `exportableState` on `window.StepQuestV02Domain` and `module.exports`.

- [ ] **Step 1: Write the failing domain test runner**

Create a Node `assert` runner whose fixtures use deterministic clocks and IDs. The runner must contain these exact behavioral assertions:

```js
#!/usr/bin/env node
const assert = require('node:assert/strict');
const Domain = require('../public/assets/js/stepquest-v02-domain');

let sequence = 0;
const idFactory = (prefix) => `${prefix}-${++sequence}`;
const now = '2026-07-11T00:00:00.000Z';

function makeState(phases = ['orient', 'prepare', 'open', 'start']) {
  const state = Domain.createInitialState();
  state.goals.push({ id: 'goal-1', title: '기획서 쓰기', type: 'project', status: 'active', createdAt: now, updatedAt: now });
  state.steps = phases.map((phase, index) => ({
    id: `step-${index + 1}`,
    goalId: 'goal-1',
    title: `행동 ${index + 1}`,
    nextPhysicalAction: `행동 ${index + 1}`,
    phase,
    rewardLineage: `step-${index + 1}`,
    status: index === 0 ? 'active' : 'pending',
    orderIndex: index,
    createdAt: now,
    updatedAt: now,
  }));
  state.steps = Domain.assignEntrySegments(state.steps, () => 'entry-1');
  return state;
}

let segmentSequence = 0;
const separated = Domain.assignEntrySegments([
  { id: 'a', phase: 'orient' },
  { id: 'b', phase: 'start' },
  { id: 'c', phase: 'open' },
], (prefix) => `${prefix}-${++segmentSequence}`);
assert.notEqual(separated[0].entrySegmentId, separated[2].entrySegmentId, 'separate entry runs need separate IDs');

let state = makeState();
let transition = Domain.startStep(state, { stepId: 'step-1', idempotencyKey: 'start-1', now, idFactory });
assert.equal(transition.state.steps[0].status, 'started');
assert.equal(transition.state.expeditions.length, 1);
assert.equal(transition.state.wallet.stepCoin, 2);

let replay = Domain.startStep(transition.state, { stepId: 'step-1', idempotencyKey: 'start-1', now, idFactory });
assert.equal(replay.duplicate, true);
assert.equal(replay.state.wallet.stepCoin, 2);

transition = Domain.reportOutcome(transition.state, {
  expeditionId: transition.result.expeditionId,
  outcome: 'completed',
  idempotencyKey: 'report-1',
  now,
  idFactory,
});
transition = Domain.startStep(transition.state, { stepId: 'step-2', idempotencyKey: 'start-2', now, idFactory });
assert.equal(transition.state.wallet.stepCoin, 2, 'one entry segment pays once');

assert.throws(() => Domain.reportOutcome(makeState(), {
  expeditionId: 'missing',
  outcome: 'partial',
  idempotencyKey: 'bad-report',
  now,
  idFactory,
  anchor: { nextPhysicalAction: '' },
}), /EXPEDITION_NOT_ACTIVE/);

state = makeState(['start', 'close']);
transition = Domain.startStep(state, { stepId: 'step-1', idempotencyKey: 'work-start', now, idFactory });
assert.equal(transition.state.wallet.stepCoin, 5);
transition = Domain.reportOutcome(transition.state, {
  expeditionId: transition.result.expeditionId,
  outcome: 'partial',
  idempotencyKey: 'work-partial',
  now,
  idFactory,
  anchor: { lastCompletedAction: '첫 문장', nextPhysicalAction: '둘째 문장 첫 단어 쓰기' },
});
assert.equal(transition.state.wallet.stepCoin, 12);
assert.equal(transition.state.wallet.gold, 1);
assert.equal(transition.state.steps[0].status, 'interrupted');
assert.equal(transition.state.resumeAnchors[0].nextPhysicalAction, '둘째 문장 첫 단어 쓰기');

transition = Domain.resumeStep(transition.state, { stepId: 'step-1', idempotencyKey: 'resume-1', now });
assert.equal(transition.state.steps[0].status, 'active');
assert.equal(transition.state.resumeAnchors[0].consumedAt, now);

transition = Domain.routeObstacle(transition.state, {
  stepId: 'step-1',
  reason: 'too_big',
  route: 'manual_shrink',
  nextPhysicalAction: '문서 제목만 보기',
  idempotencyKey: 'obstacle-1',
  now,
  idFactory,
});
assert.equal(transition.state.steps.find((step) => step.id === 'step-1').status, 'replaced');
assert.equal(transition.state.steps.find((step) => step.status === 'active').title, '문서 제목만 보기');
assert.ok(transition.state.events.some((event) => event.type === 'obstacle_reported'));

const walletAfterFirstStart = transition.state.wallet.stepCoin;
transition = Domain.startStep(transition.state, { stepId: transition.state.steps.find((step) => step.status === 'active').id, idempotencyKey: 'replacement-start-1', now, idFactory });
transition = Domain.reportOutcome(transition.state, { expeditionId: transition.result.expeditionId, outcome: 'not_started', idempotencyKey: 'replacement-report-1', now, idFactory });
const firstReplacementId = transition.state.steps.find((step) => step.status === 'active').id;
transition = Domain.routeObstacle(transition.state, { stepId: firstReplacementId, reason: 'too_big', route: 'manual_shrink', nextPhysicalAction: '파일 이름만 보기', idempotencyKey: 'replacement-shrink-2', now, idFactory });
const secondReplacement = transition.state.steps.find((step) => step.status === 'active');
transition = Domain.startStep(transition.state, { stepId: secondReplacement.id, idempotencyKey: 'replacement-start-2', now, idFactory });
assert.equal(transition.state.wallet.stepCoin, walletAfterFirstStart, 'two shrink replacements cannot mint another start reward');

state = makeState(['start']);
transition = Domain.startStep(state, { stepId: 'step-1', idempotencyKey: 'not-started-start', now, idFactory });
transition = Domain.reportOutcome(transition.state, { expeditionId: transition.result.expeditionId, outcome: 'not_started', idempotencyKey: 'not-started-report', now, idFactory });
assert.equal(transition.state.steps[0].status, 'active');
assert.deepEqual(transition.state.wallet, { stepCoin: 5, gold: 0 });

state = makeState(['start']);
transition = Domain.startStep(state, { stepId: 'step-1', idempotencyKey: 'interrupted-start', now, idFactory });
assert.throws(() => Domain.reportOutcome(transition.state, { expeditionId: transition.result.expeditionId, outcome: 'interrupted', idempotencyKey: 'interrupted-report', now, idFactory, anchor: { nextPhysicalAction: '' } }), /NEXT_PHYSICAL_ACTION_REQUIRED/);

state = makeState(['start']);
transition = Domain.startStep(state, { stepId: 'step-1', idempotencyKey: 'completed-start', now, idFactory });
transition = Domain.reportOutcome(transition.state, { expeditionId: transition.result.expeditionId, outcome: 'completed', idempotencyKey: 'completed-report', now, idFactory });
assert.deepEqual(transition.state.wallet, { stepCoin: 18, gold: 2 });
assert.equal(transition.state.goals[0].status, 'completed');

state = makeState(['start']);
transition = Domain.routeObstacle(state, {
  stepId: 'step-1',
  reason: 'not_now',
  route: 'defer',
  idempotencyKey: 'obstacle-2',
  now,
  idFactory,
});
assert.equal(transition.state.steps[0].status, 'deferred');
assert.deepEqual(transition.state.wallet, { stepCoin: 0, gold: 0 });
transition = Domain.undeferStep(transition.state, { stepId: 'step-1', idempotencyKey: 'undefer-1', now });
assert.equal(transition.state.steps[0].status, 'active');
assert.deepEqual(transition.state.wallet, { stepCoin: 0, gold: 0 });

console.log(JSON.stringify({ ok: true, checked: 'stepquest-v02-domain' }, null, 2));
```

- [ ] **Step 2: Run the domain runner and confirm RED**

Run: `cd backend && node scripts/stepquest-v02-domain-test.js`

Expected: exit 1 with `Cannot find module '../public/assets/js/stepquest-v02-domain'`.

- [ ] **Step 3: Implement the pure domain module**

Use a browser/CommonJS wrapper and the exact public surface below:

```js
(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StepQuestV02Domain = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const ENTRY_PHASES = new Set(['orient', 'prepare', 'open']);
  const WORK_PHASES = new Set(['start', 'continue', 'close']);
  const OUTCOMES = new Set(['completed', 'partial', 'interrupted', 'not_started']);

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function error(code) { const value = new Error(code); value.code = code; return value; }
  function createInitialState() {
    return { schemaVersion: 2, goals: [], steps: [], expeditions: [], resumeAnchors: [], events: [], rewards: [], wallet: { stepCoin: 0, gold: 0 } };
  }
  function assignEntrySegments(steps, idFactory) {
    let current = null;
    return steps.map((step) => {
      if (!ENTRY_PHASES.has(step.phase)) { current = null; return { ...step, entrySegmentId: undefined }; }
      if (!current) current = idFactory('entry');
      return { ...step, entrySegmentId: current };
    });
  }
  function replay(state, key) {
    const event = state.events.find((item) => item.idempotencyKey === key);
    return event ? { state: clone(state), result: clone(event.result), duplicate: true } : null;
  }
  function grant(state, reward) {
    if (state.rewards.some((item) => item.idempotencyKey === reward.idempotencyKey)) return 0;
    state.rewards.push(reward);
    state.wallet[reward.currency] += reward.amount;
    return reward.amount;
  }
  function record(state, event) { state.events.push(event); return { state, result: event.result, duplicate: false }; }
```

Complete the wrapper with these transition rules, using no DOM or storage calls:

```js
  function startStep(source, command) {
    const repeated = replay(source, command.idempotencyKey); if (repeated) return repeated;
    const state = clone(source);
    const step = state.steps.find((item) => item.id === command.stepId && item.status === 'active');
    if (!step) throw error('STEP_NOT_ACTIVE');
    if (state.expeditions.some((item) => item.status === 'active')) throw error('EXPEDITION_ALREADY_ACTIVE');
    const expeditionId = command.idFactory('expedition');
    state.expeditions.push({ id: expeditionId, stepId: step.id, status: 'active', startedAt: command.now, goldCap: 2, goldGranted: 0 });
    step.status = 'started'; step.updatedAt = command.now;
    const entry = ENTRY_PHASES.has(step.phase);
    const rewardKey = entry ? `goal:${step.goalId}:entry:${step.entrySegmentId}` : `goal:${step.goalId}:lineage:${step.rewardLineage}:start`;
    const amount = grant(state, { idempotencyKey: rewardKey, currency: 'stepCoin', amount: entry ? 2 : 5, sourceGoalId: step.goalId, sourceStepId: step.id, rewardLineage: step.rewardLineage, stage: entry ? 'entry' : 'start', createdAt: command.now });
    return record(state, { idempotencyKey: command.idempotencyKey, type: 'step_started', stepId: step.id, expeditionId, createdAt: command.now, result: { stepId: step.id, expeditionId, stepCoinGranted: amount } });
  }

  function appendResumeAnchor(state, step, anchor, command) {
    const nextPhysicalAction = String(anchor?.nextPhysicalAction || '').trim();
    if (!nextPhysicalAction) throw error('NEXT_PHYSICAL_ACTION_REQUIRED');
    const recordValue = { id: command.idFactory('anchor'), stepId: step.id, lastCompletedAction: String(anchor.lastCompletedAction || '').trim() || undefined, nextPhysicalAction, location: String(anchor.location || '').trim() || undefined, requiredMaterial: String(anchor.requiredMaterial || '').trim() || undefined, note: String(anchor.note || '').trim() || undefined, createdAt: command.now };
    state.resumeAnchors.push(recordValue);
    return recordValue;
  }

  function reportOutcome(source, command) {
    const repeated = replay(source, command.idempotencyKey); if (repeated) return repeated;
    if (!OUTCOMES.has(command.outcome)) throw error('OUTCOME_INVALID');
    const state = clone(source);
    const expedition = state.expeditions.find((item) => item.id === command.expeditionId && item.status === 'active');
    if (!expedition) throw error('EXPEDITION_NOT_ACTIVE');
    const step = state.steps.find((item) => item.id === expedition.stepId && item.status === 'started');
    if (!step) throw error('STEP_NOT_STARTED');
    let anchor = null;
    if (command.outcome === 'partial' || command.outcome === 'interrupted') anchor = appendResumeAnchor(state, step, command.anchor, command);
    expedition.status = 'reported'; expedition.reportedAt = command.now; expedition.outcome = command.outcome;
    let stepCoinGranted = 0; let goldGranted = 0;
    if ((command.outcome === 'partial' || command.outcome === 'completed') && WORK_PHASES.has(step.phase)) {
      stepCoinGranted += grant(state, { idempotencyKey: `goal:${step.goalId}:lineage:${step.rewardLineage}:progress`, currency: 'stepCoin', amount: 7, sourceGoalId: step.goalId, sourceStepId: step.id, rewardLineage: step.rewardLineage, stage: 'progress', createdAt: command.now });
    }
    const priorGold = state.rewards.filter((item) => item.currency === 'gold' && item.sourceStepId === step.id).reduce((sum, item) => sum + item.amount, 0);
    const requestedGold = command.outcome === 'completed' ? 2 - priorGold : command.outcome === 'partial' && priorGold < 2 ? 1 : 0;
    if (requestedGold > 0) goldGranted = grant(state, { idempotencyKey: `step:${step.id}:gold:${priorGold}`, currency: 'gold', amount: requestedGold, sourceGoalId: step.goalId, sourceStepId: step.id, stage: command.outcome, createdAt: command.now });
    expedition.goldGranted = goldGranted;
    if (command.outcome === 'completed') {
      step.status = 'completed';
      const next = state.steps.filter((item) => item.goalId === step.goalId && item.status === 'pending').sort((a, b) => a.orderIndex - b.orderIndex)[0];
      if (next) next.status = 'active';
      else {
        const goal = state.goals.find((item) => item.id === step.goalId); if (goal) goal.status = 'completed';
        stepCoinGranted += grant(state, { idempotencyKey: `goal:${step.goalId}:milestone`, currency: 'stepCoin', amount: 6, sourceGoalId: step.goalId, sourceStepId: step.id, stage: 'milestone', createdAt: command.now });
      }
    } else if (command.outcome === 'not_started') step.status = 'active';
    else step.status = 'interrupted';
    step.updatedAt = command.now;
    return record(state, { idempotencyKey: command.idempotencyKey, type: 'expedition_reported', stepId: step.id, expeditionId: expedition.id, outcome: command.outcome, createdAt: command.now, result: { stepId: step.id, expeditionId: expedition.id, outcome: command.outcome, anchorId: anchor?.id || null, stepCoinGranted, goldGranted } });
  }
```

Complete the factory with these exact operations and exports:

```js
  function saveResumeAnchor(source, command) {
    const repeated = replay(source, command.idempotencyKey); if (repeated) return repeated;
    const state = clone(source);
    const step = state.steps.find((item) => item.id === command.stepId);
    if (!step) throw error('STEP_NOT_FOUND');
    const anchor = appendResumeAnchor(state, step, command.anchor, command);
    return record(state, { idempotencyKey: command.idempotencyKey, type: 'resume_anchor_saved', stepId: step.id, createdAt: command.now, result: { stepId: step.id, anchorId: anchor.id } });
  }

  function resumeStep(source, command) {
    const repeated = replay(source, command.idempotencyKey); if (repeated) return repeated;
    const state = clone(source);
    const step = state.steps.find((item) => item.id === command.stepId && item.status === 'interrupted');
    if (!step) throw error('STEP_NOT_INTERRUPTED');
    const anchor = state.resumeAnchors.filter((item) => item.stepId === step.id && !item.consumedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (!anchor) throw error('RESUME_ANCHOR_NOT_FOUND');
    anchor.consumedAt = command.now;
    step.status = 'active'; step.updatedAt = command.now;
    return record(state, { idempotencyKey: command.idempotencyKey, type: 'step_resumed', stepId: step.id, createdAt: command.now, result: { stepId: step.id, anchorId: anchor.id } });
  }

  function undeferStep(source, command) {
    const repeated = replay(source, command.idempotencyKey); if (repeated) return repeated;
    const state = clone(source);
    const step = state.steps.find((item) => item.id === command.stepId && item.status === 'deferred');
    if (!step) throw error('STEP_NOT_DEFERRED');
    if (state.steps.some((item) => item.status === 'active' || item.status === 'started') || state.expeditions.some((item) => item.status === 'active')) throw error('ANOTHER_STEP_ACTIVE');
    step.status = 'active'; step.updatedAt = command.now;
    return record(state, { idempotencyKey: command.idempotencyKey, type: 'step_undeferred', stepId: step.id, createdAt: command.now, result: { stepId: step.id } });
  }

  function routeObstacle(source, command) {
    const repeated = replay(source, command.idempotencyKey); if (repeated) return repeated;
    if (!['manual_shrink', 'defer'].includes(command.route)) throw error('OBSTACLE_ROUTE_INVALID');
    const state = clone(source);
    const step = state.steps.find((item) => item.id === command.stepId && item.status === 'active');
    if (!step) throw error('STEP_NOT_ACTIVE');
    state.events.push({ idempotencyKey: `${command.idempotencyKey}:reason`, type: 'obstacle_reported', stepId: step.id, reason: command.reason, createdAt: command.now, result: { stepId: step.id, reason: command.reason } });
    let replacementStepId = null;
    if (command.route === 'defer') {
      step.status = 'deferred'; step.updatedAt = command.now;
    } else {
      const title = String(command.nextPhysicalAction || '').trim();
      if (!title) throw error('NEXT_PHYSICAL_ACTION_REQUIRED');
      const index = step.orderIndex;
      state.steps.filter((item) => item.goalId === step.goalId && item.id !== step.id && item.orderIndex > index).forEach((item) => { item.orderIndex += 1; });
      step.status = 'replaced'; step.orderIndex = index + 1; step.updatedAt = command.now;
      replacementStepId = command.idFactory('step');
      state.steps.push({ id: replacementStepId, goalId: step.goalId, title, nextPhysicalAction: title, phase: step.phase, entrySegmentId: step.entrySegmentId, rewardLineage: step.rewardLineage, status: 'active', orderIndex: index, createdAt: command.now, updatedAt: command.now });
    }
    return record(state, { idempotencyKey: command.idempotencyKey, type: 'obstacle_routed', stepId: step.id, reason: command.reason, route: command.route, createdAt: command.now, result: { stepId: step.id, reason: command.reason, route: command.route, replacementStepId } });
  }

  function importGoal(source, command) {
    const repeated = replay(source, command.idempotencyKey); if (repeated) return repeated;
    const state = clone(source);
    const made = command.made;
    state.goals.filter((item) => item.status === 'active').forEach((item) => { item.status = 'paused'; item.updatedAt = command.now; });
    state.steps.filter((item) => item.status === 'active').forEach((item) => { item.status = 'deferred'; item.updatedAt = command.now; });
    const goalId = String(made.weekly.id);
    const goal = { id: goalId, title: made.weekly.title, type: 'project', status: 'active', doneDefinition: made.weekly.doneDefinition || undefined, createdAt: made.weekly.createdAt || command.now, updatedAt: command.now };
    const rawSteps = made.micro.map((item, index, all) => ({ id: String(item.id), goalId, title: item.title, nextPhysicalAction: item.title, phase: item.phase || (index === 0 ? 'orient' : index === 1 ? 'open' : index === all.length - 1 ? 'close' : 'start'), rewardLineage: item.rewardLineage || String(item.id), status: index === 0 ? 'active' : 'pending', orderIndex: index, createdAt: item.createdAt || command.now, updatedAt: command.now }));
    const steps = assignEntrySegments(rawSteps, command.idFactory);
    state.goals.push(goal); state.steps.push(...steps);
    return record(state, { idempotencyKey: command.idempotencyKey, type: 'goal_imported', goalId, createdAt: command.now, result: { goalId, firstStepId: steps[0]?.id || null } });
  }

  function exportableState(state) { return clone(state); }

  return { createInitialState, assignEntrySegments, importGoal, startStep, reportOutcome, saveResumeAnchor, resumeStep, undeferStep, routeObstacle, exportableState };
});
```

- [ ] **Step 4: Run the domain runner and confirm GREEN**

Run: `cd backend && node scripts/stepquest-v02-domain-test.js`

Expected: exit 0 and `{ "ok": true, "checked": "stepquest-v02-domain" }`.

- [ ] **Step 5: Add the runner to the domain suite**

Append `&& node scripts/stepquest-v02-domain-test.js` to the existing `test:domain` script after `stepquest-domain-test.js`:

```json
"test:domain": "npm run build && node scripts/health-test.js && node scripts/version-consistency-test.js && node scripts/production-env-test.js && node scripts/request-logger-test.js && node scripts/product-event-dto-test.js && node scripts/product-event-auth-test.js && node scripts/timezone-test.js && node scripts/stepquest-domain-test.js && node scripts/stepquest-v02-domain-test.js && node scripts/stepquest-state-test.js && node scripts/stepquest-persistence-test.js"
```

Run: `cd backend && npm run test:domain`

Expected: all existing checks and `stepquest-v02-domain` pass.

- [ ] **Step 6: Commit the domain unit**

```bash
git add backend/public/assets/js/stepquest-v02-domain.js backend/scripts/stepquest-v02-domain-test.js backend/package.json
git commit -m "Add StepQuest v0.2 domain transitions"
```

---

### Task 2: IndexedDB Repository, Migration, and Legacy Write Guard

**Files:**
- Create: `backend/public/assets/js/stepquest-v02-storage.js`
- Modify: `backend/public/assets/js/app.js`
- Modify: `backend/public/goals.html`
- Create: `backend/e2e/stepquest-v02-storage.spec.ts`

**Interfaces:**
- Consumes: `window.StepQuestV02Domain`, legacy `stepquest_guest_state`, and domain operation names.
- Produces: `openRepository()`, returning `{ mode, getSnapshot, execute, importGoal, getMeta, setMeta, exportRecords }`.

- [ ] **Step 1: Write failing browser persistence tests**

Create tests that clear `indexedDB.deleteDatabase('stepquest')`, seed a guest payload, reload, open the repository, and assert:

```ts
test('migrates legacy state once and blocks legacy rewrites', async ({ page }) => {
  await page.goto('/goals.html');
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('stepquest');
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
    localStorage.setItem('stepquest_guest_state', JSON.stringify({
      player: { goalCoin: 9 },
      village: [{ facilityKey: 'archive', material: 3 }],
      weekly: [{ id: 10, title: '기획서 쓰기', status: 'ACTIVE', category: 'writing', createdAt: '2026-07-11T00:00:00.000Z' }],
      micro: [{ id: 11, weeklyMissionId: 10, title: '문서 열기', status: 'OPEN', category: 'writing', createdAt: '2026-07-11T00:00:00.000Z' }],
      attempts: [],
    }));
  });
  await page.reload();
  const migrated = await page.evaluate(async () => {
    const repo = await window.StepQuestV02Storage.openRepository();
    await repo.migrateLegacy(JSON.parse(localStorage.getItem('stepquest_guest_state')), { idempotencyKey: 'legacy:v02:migration', now: '2026-07-11T00:00:00.000Z', idFactory: (prefix) => `${prefix}-test` });
    return repo.getSnapshot();
  });
  expect(migrated.wallet).toEqual({ stepCoin: 9, gold: 3 });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('stepquest_v02_active'))).toBe('1');
  const before = await page.evaluate(() => localStorage.getItem('stepquest_guest_state'));
  await page.evaluate(() => window.StepQuestApp.__testSaveGuest({ weekly: [], micro: [] }));
  expect(await page.evaluate(() => localStorage.getItem('stepquest_guest_state'))).toBe(before);
});
```

Add this second repository-level reload test:

```ts
test('keeps the same active expedition across reload', async ({ page }) => {
  const expeditionId = await page.evaluate(async () => {
    const repo = await window.StepQuestV02Storage.openRepository();
    const made = { weekly: { id: 20, title: '원정 테스트', createdAt: '2026-07-11T00:00:00.000Z' }, micro: [{ id: 21, title: '문서 열기', createdAt: '2026-07-11T00:00:00.000Z' }] };
    await repo.importGoal(made, { idempotencyKey: 'goal:20:import', now: '2026-07-11T00:00:00.000Z', idFactory: (prefix) => `${prefix}-20` });
    const result = await repo.execute('startStep', { stepId: '21', idempotencyKey: 'step:21:start', now: '2026-07-11T00:01:00.000Z', idFactory: () => 'expedition-20' });
    return result.result.expeditionId;
  });
  await page.reload();
  expect(await page.evaluate(async () => (await (await window.StepQuestV02Storage.openRepository()).getSnapshot()).expeditions.find((item) => item.status === 'active').id)).toBe(expeditionId);
});
```

- [ ] **Step 2: Run the storage test and confirm RED**

Run: `cd backend && npx playwright test e2e/stepquest-v02-storage.spec.ts --project=desktop-chrome`

Expected: failure because `StepQuestV02Storage` is undefined.

- [ ] **Step 3: Implement the repository schema and transaction helpers**

Create stores `meta`, `goals`, `steps`, `expeditions`, `resumeAnchors`, `events`, `rewards`, `wallet`, and `backups` in `onupgradeneeded`. Add `goalId` and `status` indexes for Steps, `stepId` and `status` for Expeditions, and `stepId` for Resume Anchors.

Use one readwrite transaction over all domain stores for `execute(operation, command)`: load the state, call `Domain[operation]`, clear and rewrite the domain stores, create a rolling snapshot for `reportOutcome`, `routeObstacle`, and `importGoal`, keep only five snapshots, and resolve only after `transaction.oncomplete`.

If `indexedDB.open` fails, return a repository with the same interface backed by `stepquest_v02_fallback_state`. Set `mode: 'localStorage'` and never claim persistent IndexedDB storage.

Use these concrete helpers and repository methods inside the IIFE:

```js
const DB_NAME = 'stepquest';
const DB_VERSION = 2;
const DOMAIN_STORES = ['goals', 'steps', 'expeditions', 'resumeAnchors', 'events', 'rewards'];
const MUTABLE_STORES = ['goals', 'steps', 'expeditions', 'resumeAnchors'];
const ALL_STORES = ['meta', ...DOMAIN_STORES, 'wallet', 'backups'];
const requestResult = (request) => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
const transactionDone = (tx) => new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(tx.error || new Error('IDB_TRANSACTION_FAILED')); });

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const create = (name, options) => db.objectStoreNames.contains(name) ? request.transaction.objectStore(name) : db.createObjectStore(name, options);
      create('meta', { keyPath: 'key' });
      const goals = create('goals', { keyPath: 'id' });
      const steps = create('steps', { keyPath: 'id' });
      const expeditions = create('expeditions', { keyPath: 'id' });
      const anchors = create('resumeAnchors', { keyPath: 'id' });
      create('events', { keyPath: 'idempotencyKey' });
      create('rewards', { keyPath: 'idempotencyKey' });
      create('wallet', { keyPath: 'id' });
      create('backups', { keyPath: 'createdAt' });
      if (!steps.indexNames.contains('goalId')) steps.createIndex('goalId', 'goalId');
      if (!steps.indexNames.contains('status')) steps.createIndex('status', 'status');
      if (!expeditions.indexNames.contains('stepId')) expeditions.createIndex('stepId', 'stepId');
      if (!expeditions.indexNames.contains('status')) expeditions.createIndex('status', 'status');
      if (!anchors.indexNames.contains('stepId')) anchors.createIndex('stepId', 'stepId');
      void goals;
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readState(tx, Domain) {
  const values = await Promise.all([...DOMAIN_STORES.map((name) => requestResult(tx.objectStore(name).getAll())), requestResult(tx.objectStore('wallet').get('main'))]);
  const rows = values.slice(0, DOMAIN_STORES.length); const wallet = values[DOMAIN_STORES.length];
  return { schemaVersion: 2, ...Object.fromEntries(DOMAIN_STORES.map((name, index) => [name, rows[index]])), wallet: wallet ? { stepCoin: wallet.stepCoin, gold: wallet.gold } : { stepCoin: 0, gold: 0 } };
}

function writeState(tx, state) {
  for (const name of MUTABLE_STORES) {
    const store = tx.objectStore(name); store.clear();
    for (const value of state[name]) store.put(value);
  }
  for (const name of ['events', 'rewards']) for (const value of state[name]) tx.objectStore(name).put(value);
  tx.objectStore('wallet').put({ id: 'main', stepCoin: state.wallet.stepCoin, gold: state.wallet.gold });
}

function partitionState(state) {
  const quarantined = [];
  const keyFor = (name, value) => ['events', 'rewards'].includes(name) ? value?.idempotencyKey : value?.id;
  for (const name of DOMAIN_STORES) state[name] = state[name].filter((value) => {
    const valid = value && typeof keyFor(name, value) === 'string' && keyFor(name, value).length > 0;
    if (!valid) quarantined.push({ store: name, id: String(keyFor(name, value) || 'unknown'), value });
    return valid;
  });
  state.wallet = { stepCoin: Math.max(0, Number(state.wallet?.stepCoin || 0)), gold: Math.max(0, Number(state.wallet?.gold || 0)) };
  return { state, quarantined };
}

async function quarantineRecords(db, rows, occurredAt) {
  if (!rows.length) return;
  const tx = db.transaction('meta', 'readwrite');
  rows.forEach((row, index) => tx.objectStore('meta').put({ key: `quarantine:${row.store}:${row.id}:${index}`, value: { ...row, occurredAt } }));
  tx.objectStore('meta').put({ key: 'lastQuarantineCount', value: rows.length });
  await transactionDone(tx);
}

function rotateBackups(tx, state, createdAt) {
  const store = tx.objectStore('backups');
  store.put({ createdAt, snapshot: state });
  const request = store.getAllKeys();
  request.onsuccess = () => request.result.sort().slice(0, -5).forEach((key) => store.delete(key));
}

function makeIndexedRepository(db, Domain) {
  return {
    mode: 'indexedDB',
    async getSnapshot() {
      const tx = db.transaction([...DOMAIN_STORES, 'wallet'], 'readonly');
      const raw = await readState(tx, Domain); await transactionDone(tx); const normalized = partitionState(raw); await quarantineRecords(db, normalized.quarantined, new Date().toISOString()); return normalized.state;
    },
    async execute(operation, command) {
      const tx = db.transaction([...DOMAIN_STORES, 'wallet', 'backups', 'meta'], 'readwrite');
      const normalized = partitionState(await readState(tx, Domain)); const state = normalized.state;
      normalized.quarantined.forEach((row, index) => tx.objectStore('meta').put({ key: `quarantine:${row.store}:${row.id}:${index}`, value: { ...row, occurredAt: command.now } }));
      if (normalized.quarantined.length) tx.objectStore('meta').put({ key: 'lastQuarantineCount', value: normalized.quarantined.length });
      const transition = Domain[operation](state, command);
      writeState(tx, transition.state);
      if (['reportOutcome', 'routeObstacle', 'importGoal'].includes(operation)) rotateBackups(tx, transition.state, command.now);
      await transactionDone(tx); return transition;
    },
    async importGoal(made, command) { return this.execute('importGoal', { ...command, made }); },
    async getMeta(key) { const tx = db.transaction('meta', 'readonly'); const value = await requestResult(tx.objectStore('meta').get(key)); await transactionDone(tx); return value?.value; },
    async setMeta(key, value) { const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').put({ key, value }); await transactionDone(tx); return value; },
    async exportRecords() { const state = await this.getSnapshot(); const tx = db.transaction('backups', 'readonly'); const backups = await requestResult(tx.objectStore('backups').getAll()); await transactionDone(tx); return { ...state, backups }; },
  };
}

function makeFallbackRepository(Domain) {
  const key = 'stepquest_v02_fallback_state';
  const backupKey = 'stepquest_v02_fallback_backups';
  const read = () => JSON.parse(localStorage.getItem(key) || 'null') || Domain.createInitialState();
  const write = (state) => localStorage.setItem(key, JSON.stringify(state));
  const readBackups = () => JSON.parse(localStorage.getItem(backupKey) || '[]');
  const rotate = (state, createdAt) => localStorage.setItem(backupKey, JSON.stringify([...readBackups(), { createdAt, snapshot: state }].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-5)));
  const metaKey = (name) => `stepquest_v02_meta_${name}`;
  return {
    mode: 'localStorage',
    async getSnapshot() { return read(); },
    async execute(operation, command) { const transition = Domain[operation](read(), command); write(transition.state); if (['reportOutcome', 'routeObstacle', 'importGoal'].includes(operation)) rotate(transition.state, command.now); return transition; },
    async importGoal(made, command) { return this.execute('importGoal', { ...command, made }); },
    async getMeta(name) { return JSON.parse(localStorage.getItem(metaKey(name)) || 'null'); },
    async setMeta(name, value) { localStorage.setItem(metaKey(name), JSON.stringify(value)); return value; },
    async exportRecords() { return { ...read(), backups: readBackups() }; },
  };
}

async function openRepository() {
  const Domain = globalThis.StepQuestV02Domain;
  try { return makeIndexedRepository(await openDatabase(), Domain); }
  catch { return makeFallbackRepository(Domain); }
}
globalThis.StepQuestV02Storage = { openRepository };
```

- [ ] **Step 4: Implement one-way migration**

The migration adapter maps legacy data exactly:

```js
const state = Domain.createInitialState();
state.wallet.stepCoin = Number(legacy.player?.goalCoin || 0);
state.wallet.gold = (legacy.village || []).reduce((sum, item) => sum + Number(item.material || 0), 0);
const activeGoal = (legacy.weekly || []).find((item) => item.status === 'ACTIVE') || legacy.weekly?.[0];
const sourceSteps = (legacy.micro || []).filter((item) => String(item.weeklyMissionId) === String(activeGoal?.id));
```

Map legacy status `OPEN` to `active`, `PENDING` to `pending`, `DONE` to `completed`, `DEFERRED` to `deferred`, `SKIPPED` to `skipped`, and `REPLACED` to `replaced`. Infer phases as first Step `orient`, second Step `open`, final Step `close`, and remaining Steps `start`, then call `assignEntrySegments` once. Store the raw payload in `meta.legacySnapshot`. Set `stepquest_v02_active=1` only after the migration transaction completes.

Add `migrateLegacy(legacy, command)` to both repositories. The IndexedDB implementation runs `Domain.importGoal` and wallet mapping in one transaction, writes `meta` records `legacySnapshot` and `migrationComplete`, waits for completion, then sets the guard. The fallback implementation writes `stepquest_v02_fallback_state`, sets the same metadata values under fallback keys, and then sets the guard.

The IndexedDB method uses this complete mapping before `writeState`:

```js
async function migrateLegacyIndexed(db, Domain, legacy, command) {
  const tx = db.transaction([...DOMAIN_STORES, 'wallet', 'meta', 'backups'], 'readwrite');
  const existing = await requestResult(tx.objectStore('goals').getAll());
  if (existing.length) { await transactionDone(tx); return { migrated: false, reason: 'LOCAL_STATE_EXISTS' }; }
  const state = Domain.createInitialState();
  state.wallet.stepCoin = Number(legacy.player?.goalCoin || 0);
  state.wallet.gold = (legacy.village || []).reduce((sum, item) => sum + Number(item.material || 0), 0);
  const activeGoal = (legacy.weekly || []).find((item) => item.status === 'ACTIVE') || legacy.weekly?.[0];
  if (activeGoal) {
    const goalId = String(activeGoal.id);
    state.goals.push({ id: goalId, title: activeGoal.title, type: 'project', status: 'active', createdAt: activeGoal.createdAt || command.now, updatedAt: command.now });
    const statusMap = { OPEN: 'active', PENDING: 'pending', DONE: 'completed', DEFERRED: 'deferred', SKIPPED: 'skipped', REPLACED: 'replaced' };
    const source = (legacy.micro || []).filter((item) => String(item.weeklyMissionId) === goalId);
    const mapped = source.map((item, index, all) => ({ id: String(item.id), goalId, title: item.title, nextPhysicalAction: item.title, phase: item.phase || (index === 0 ? 'orient' : index === 1 ? 'open' : index === all.length - 1 ? 'close' : 'start'), rewardLineage: item.rewardLineage || String(item.id), status: statusMap[item.status] || 'pending', orderIndex: index, createdAt: item.createdAt || command.now, updatedAt: command.now }));
    state.steps = Domain.assignEntrySegments(mapped, command.idFactory);
  }
  state.events = (legacy.attempts || []).map((item, index) => ({ idempotencyKey: `legacy:attempt:${item.id || index}`, type: `legacy_${item.action || 'attempt'}`, stepId: item.stepId ? String(item.stepId) : undefined, reason: item.reason || undefined, createdAt: item.createdAt || command.now, result: { imported: true } }));
  writeState(tx, state); rotateBackups(tx, state, command.now);
  tx.objectStore('meta').put({ key: 'legacySnapshot', value: legacy });
  tx.objectStore('meta').put({ key: 'migrationComplete', value: { completedAt: command.now } });
  await transactionDone(tx);
  localStorage.setItem('stepquest_v02_active', '1');
  return { migrated: true };
}
```

Wrap migration parsing and record mapping in `try/catch`. On error, leave `stepquest_guest_state` and the guard unchanged, set `migrationError` metadata to `{ message, occurredAt }`, and return `{ migrated: false, error }`. When a stored domain record cannot be normalized, write `{ key: 'quarantine:<store>:<id>', value: rawRecord }` to metadata, omit only that record from the loaded state, and expose `quarantinedRecords` count from the repository.

- [ ] **Step 5: Guard the single legacy write path**

Change `saveGuest` to:

```js
function saveGuest(guest) {
  if (localStorage.getItem('stepquest_v02_active') === '1') {
    window.dispatchEvent(new CustomEvent('stepquest:v02-legacy-write-blocked'));
    return false;
  }
  localStorage.setItem(guestStorageKey, JSON.stringify(guest));
  return true;
}
```

Expose `__testSaveGuest: saveGuest` and `makeGuestGoal` on `window.StepQuestApp`. Do not change other localStorage writers.

Add this first line to `maybeImportGuestProgress` so legacy auth cannot copy the preserved payload back to PostgreSQL after v0.2 activation:

```js
if (localStorage.getItem('stepquest_v02_active') === '1') return { status: 'v02_local_primary' };
```

- [ ] **Step 6: Load the domain and storage scripts**

Insert, before `app.js`:

```html
<script src="/assets/js/stepquest-v02-domain.js?v=0.1.1-alpha"></script>
<script src="/assets/js/stepquest-v02-storage.js?v=0.1.1-alpha"></script>
```

- [ ] **Step 7: Run the targeted storage tests and domain suite**

Run: `cd backend && npm run build && npx playwright test e2e/stepquest-v02-storage.spec.ts --project=desktop-chrome && npm run test:domain`

Expected: the migration, guard, reload, and domain checks pass.

- [ ] **Step 8: Commit the repository unit**

```bash
git add backend/public/assets/js/stepquest-v02-storage.js backend/public/assets/js/app.js backend/public/goals.html backend/e2e/stepquest-v02-storage.spec.ts
git commit -m "Add local-first StepQuest storage"
```

---

### Task 3: Persistent Storage and Backup Safety

**Files:**
- Create: `backend/public/assets/js/stepquest-v02-backup.js`
- Create: `backend/scripts/stepquest-v02-backup-test.js`
- Modify: `backend/package.json`
- Modify: `backend/public/goals.html`

**Interfaces:**
- Consumes: repository `exportRecords`, metadata getters/setters, and optional file handle.
- Produces: `buildExport`, `serializeExport`, `downloadJson`, `requestPersistentStorage`, `chooseExternalFile`, and `writeExternalFile`.

- [ ] **Step 1: Write the failing backup test runner**

The runner creates a fixed snapshot, asserts `schemaVersion: 2`, `exportedAt`, all store arrays, wallet, and valid JSON, then uses a fake file handle:

```js
const writes = [];
const handle = { async createWritable() { return { async write(value) { writes.push(value); }, async close() { writes.push('closed'); } }; } };
await Backup.writeExternalFile(handle, '{"schemaVersion":2}');
assert.deepEqual(writes, ['{"schemaVersion":2}', 'closed']);
```

- [ ] **Step 2: Run the backup runner and confirm RED**

Run: `cd backend && node scripts/stepquest-v02-backup-test.js`

Expected: exit 1 with a module-not-found error.

- [ ] **Step 3: Implement backup functions**

`buildExport(records, now)` returns a plain object with `schemaVersion`, `exportedAt`, `goals`, `steps`, `expeditions`, `resumeAnchors`, `events`, `rewards`, and `wallet`. `serializeExport` returns `JSON.stringify(value, null, 2)`.

`requestPersistentStorage` first calls `navigator.storage.persisted()`, then `navigator.storage.persist()` only when not already persistent, and returns `{ supported, persisted }` without throwing for an unsupported browser.

`chooseExternalFile` uses `showSaveFilePicker` with suggested name `stepquest-backup.json` and JSON MIME type. `writeExternalFile` writes and closes the handle. `downloadJson` creates one Blob URL, clicks a temporary download anchor, removes it, and revokes the URL.

Implement the module with this exact public behavior:

```js
(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StepQuestV02Backup = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  function buildExport(records, now = new Date().toISOString()) {
    return {
      schemaVersion: 2,
      exportedAt: now,
      goals: records.goals || [],
      steps: records.steps || [],
      expeditions: records.expeditions || [],
      resumeAnchors: records.resumeAnchors || [],
      events: records.events || [],
      rewards: records.rewards || [],
      wallet: records.wallet || { stepCoin: 0, gold: 0 },
    };
  }
  function serializeExport(value) { return JSON.stringify(value, null, 2); }
  async function requestPersistentStorage(storage = globalThis.navigator?.storage) {
    if (!storage?.persisted || !storage?.persist) return { supported: false, persisted: false };
    if (await storage.persisted()) return { supported: true, persisted: true };
    return { supported: true, persisted: Boolean(await storage.persist()) };
  }
  async function chooseExternalFile(picker = globalThis.showSaveFilePicker) {
    if (typeof picker !== 'function') return null;
    return picker({ suggestedName: 'stepquest-backup.json', types: [{ description: 'StepQuest JSON', accept: { 'application/json': ['.json'] } }] });
  }
  async function writeExternalFile(handle, json) {
    const writable = await handle.createWritable();
    await writable.write(json);
    await writable.close();
  }
  function downloadJson(json, documentValue = document, urlApi = URL) {
    const url = urlApi.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }));
    const anchor = documentValue.createElement('a');
    anchor.href = url; anchor.download = 'stepquest-backup.json'; documentValue.body.append(anchor); anchor.click(); anchor.remove(); urlApi.revokeObjectURL(url);
  }
  return { buildExport, serializeExport, requestPersistentStorage, chooseExternalFile, writeExternalFile, downloadJson };
});
```

- [ ] **Step 4: Load the backup asset and add it to the domain suite**

Add the script tag after storage:

```html
<script src="/assets/js/stepquest-v02-backup.js?v=0.1.1-alpha"></script>
```

Append `&& node scripts/stepquest-v02-backup-test.js` immediately after the v0.2 domain runner in `test:domain`.

- [ ] **Step 5: Run backup and regression checks**

Run: `cd backend && node scripts/stepquest-v02-backup-test.js && npm run test:domain`

Expected: backup and all existing domain checks pass.

- [ ] **Step 6: Commit the backup unit**

```bash
git add backend/public/assets/js/stepquest-v02-backup.js backend/scripts/stepquest-v02-backup-test.js backend/public/goals.html backend/package.json
git commit -m "Add StepQuest data backup safety"
```

---

### Task 4: v0.2 Application Facade and Local Goal Bootstrap

**Files:**
- Create: `backend/public/assets/js/stepquest-v02-app.js`
- Modify: `backend/public/goals.html`
- Modify: `backend/e2e/stepquest-v02-storage.spec.ts`

**Interfaces:**
- Consumes: `StepQuestV02Domain`, `StepQuestV02Storage`, `StepQuestV02Backup`, and `StepQuestApp.makeGuestGoal`.
- Produces: `init`, `getSnapshot`, `createGoal`, `importAccountProgress`, `keepLocalProfileEmpty`, `startCurrentStep`, `reportCurrentExpedition`, `resumeCurrentStep`, `undeferCurrentStep`, `routeCurrentObstacle`, `exportJson`, `enableExternalBackup`, and `getStatus`.

- [ ] **Step 1: Extend the browser test with failing facade behavior**

Assert that a new local Goal can be created for both a guest and a page with a fake auth token without a `/stepquest/goals` request. Assert that the resulting state contains one active local Goal and one active Step.

Add an explicit account-import assertion:

```ts
let serverGoalPosts = 0;
page.on('request', (request) => { if (request.method() === 'POST' && request.url().endsWith('/stepquest/goals')) serverGoalPosts += 1; });
const result = await page.evaluate(async () => {
  const Core = window.StepQuestV02App;
  window.StepQuestApp.state.token = 'test-token';
  window.StepQuestApp.state.weekly = [{ id: 90, title: '계정 목표', category: 'writing', status: 'ACTIVE', createdAt: '2026-07-11T00:00:00.000Z' }];
  window.StepQuestApp.state.nextMicro = { id: 91, weeklyMissionId: 90, title: '문서 열기', category: 'writing', status: 'OPEN', createdAt: '2026-07-11T00:00:00.000Z' };
  await Core.init({ App: window.StepQuestApp, forceRefresh: true });
  const before = Core.getStatus();
  await Core.importAccountProgress();
  return { before, after: Core.getSnapshot() };
});
expect(result.before.pendingAccountImport).toBe(true);
expect(result.after.goals[0].title).toBe('계정 목표');
expect(serverGoalPosts).toBe(0);
```

- [ ] **Step 2: Run the targeted test and confirm RED**

Run: `cd backend && npx playwright test e2e/stepquest-v02-storage.spec.ts --project=desktop-chrome`

Expected: failure because `createGoal` is missing.

- [ ] **Step 3: Implement facade initialization**

`init` opens the repository, migrates legacy state only when no local Goal exists, requests persistent storage after import, captures whether an active expedition existed before initialization, and returns the current snapshot.

Listen for `stepquest:v02-legacy-write-blocked` and store one metadata timestamp named `lastLegacyWriteBlockedAt`; do not create repeated user-facing warnings.

When the local profile is empty and `App.state.token`, `App.state.weekly[0]`, and `App.state.nextMicro` exist, set `pendingAccountImport: true` without writing data. `importAccountProgress` copies only that Goal and current Step through `repository.importGoal`; `keepLocalProfileEmpty` writes the explicit choice to metadata. Neither method calls an API.

Implement initialization and account choice with these bodies:

```js
let repository = null;
let snapshot = null;
let app = null;
let status = { mode: 'unknown', persisted: false, recoveredExpedition: false, pendingAccountImport: false, externalBackupStale: false, manualBackupDue: false, migrationError: null, lastExternalBackupAt: null, quarantinedRecords: 0 };
const makeId = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const now = () => new Date().toISOString();

async function init(options) {
  app = options.App;
  if (!repository || options.forceRefresh) repository = await StepQuestV02Storage.openRepository();
  snapshot = await repository.getSnapshot();
  if (!snapshot.goals.length) {
    const raw = localStorage.getItem('stepquest_guest_state');
    if (raw) {
      try {
        const migrated = await repository.migrateLegacy(JSON.parse(raw), { idempotencyKey: 'legacy:v02:migration', now: now(), idFactory: makeId });
        if (migrated.migrated) snapshot = await repository.getSnapshot(); else status.migrationError = migrated.error?.message || 'LEGACY_MIGRATION_FAILED';
      } catch (error) { status.migrationError = error.message; await repository.setMeta('migrationError', { message: error.message, occurredAt: now() }); }
    }
  }
  status.mode = repository.mode;
  status.lastExternalBackupAt = await repository.getMeta('lastExternalBackupAt') || null;
  status.quarantinedRecords = Number(await repository.getMeta('lastQuarantineCount') || 0);
  status.recoveredExpedition = snapshot.expeditions.some((item) => item.status === 'active');
  status.pendingAccountImport = !snapshot.goals.length && Boolean(app.state.token && app.state.weekly[0] && app.state.nextMicro) && !(await repository.getMeta('accountImportChoice'));
  if (snapshot.goals.length) { const result = await StepQuestV02Backup.requestPersistentStorage(); status.persisted = result.persisted; await repository.setMeta('storagePersistence', result); }
  return snapshot;
}

async function importAccountProgress() {
  if (!status.pendingAccountImport) throw new Error('ACCOUNT_IMPORT_NOT_PENDING');
  const weekly = { ...app.state.weekly[0], createdAt: app.state.weekly[0].createdAt || now() };
  const micro = [{ ...app.state.nextMicro, createdAt: app.state.nextMicro.createdAt || now() }];
  const transition = await repository.importGoal({ weekly, micro }, { idempotencyKey: `account:${weekly.id}:import`, now: now(), idFactory: makeId });
  await repository.setMeta('accountImportChoice', 'import'); status.pendingAccountImport = false; snapshot = transition.state; await afterSignificantCommit(); return transition.result;
}

async function keepLocalProfileEmpty() {
  await repository.setMeta('accountImportChoice', 'empty'); status.pendingAccountImport = false; return true;
}
```

- [ ] **Step 4: Implement local Goal creation**

Call `StepQuestApp.makeGuestGoal(input)` only as a side-effect-free template factory. Map its `weekly` and `micro` records through repository `importGoal`; never call `StepQuestApp.createStepQuestGoal` from the v0.2 path. This keeps signed-in and guest behavior identical and avoids a PostgreSQL write.

After every `reportOutcome`, `routeObstacle`, and `createGoal`, call the repository snapshot rotation and then write the selected external file when one exists. External backup failure updates `externalBackupStale: true` metadata without rolling back the committed domain transition.

Use this facade pattern for every command:

```js
async function createGoal(input) {
  const made = app.makeGuestGoal(input);
  const transition = await repository.importGoal(made, { idempotencyKey: `goal:${made.weekly.id}:import`, now: now(), idFactory: makeId });
  snapshot = transition.state; await afterSignificantCommit(); return transition.result;
}
async function startCurrentStep(idempotencyKey) {
  const step = snapshot.steps.find((item) => item.status === 'active');
  const transition = await repository.execute('startStep', { stepId: step.id, idempotencyKey, now: now(), idFactory: makeId });
  snapshot = transition.state; status.recoveredExpedition = false; return transition.result;
}
async function reportCurrentExpedition(command) {
  const expedition = snapshot.expeditions.find((item) => item.status === 'active');
  const transition = await repository.execute('reportOutcome', { ...command, expeditionId: expedition.id, now: now(), idFactory: makeId });
  snapshot = transition.state; await afterSignificantCommit(); return transition.result;
}
async function resumeCurrentStep(stepId, idempotencyKey) {
  const transition = await repository.execute('resumeStep', { stepId, idempotencyKey, now: now() }); snapshot = transition.state; return transition.result;
}
async function undeferCurrentStep(stepId, idempotencyKey) {
  const transition = await repository.execute('undeferStep', { stepId, idempotencyKey, now: now() }); snapshot = transition.state; return transition.result;
}
async function routeCurrentObstacle(command) {
  const step = snapshot.steps.find((item) => item.status === 'active');
  const transition = await repository.execute('routeObstacle', { ...command, stepId: step.id, now: now(), idFactory: makeId }); snapshot = transition.state; await afterSignificantCommit(); return transition.result;
}
async function exportJson() {
  const value = StepQuestV02Backup.buildExport(await repository.exportRecords(), now()); return StepQuestV02Backup.serializeExport(value);
}
async function afterSignificantCommit() {
  if (!status.persisted) { const value = await StepQuestV02Backup.requestPersistentStorage(); status.persisted = value.persisted; await repository.setMeta('storagePersistence', value); }
  const handle = await repository.getMeta('externalBackupHandle');
  if (!handle) {
    const count = Number(await repository.getMeta('commitsSinceExternalBackup') || 0) + 1;
    await repository.setMeta('commitsSinceExternalBackup', count); status.manualBackupDue = count >= 5; return;
  }
  try { await StepQuestV02Backup.writeExternalFile(handle, await exportJson()); status.lastExternalBackupAt = now(); await repository.setMeta('lastExternalBackupAt', status.lastExternalBackupAt); await repository.setMeta('commitsSinceExternalBackup', 0); status.externalBackupStale = false; status.manualBackupDue = false; }
  catch { status.externalBackupStale = true; await repository.setMeta('externalBackupStale', true); }
}
async function enableExternalBackup() {
  const handle = await StepQuestV02Backup.chooseExternalFile(); if (!handle) return false;
  await repository.setMeta('externalBackupHandle', handle); await afterSignificantCommit(); return true;
}
```

Expose the complete facade at the end of the IIFE:

```js
globalThis.StepQuestV02App = {
  init,
  getSnapshot: () => snapshot,
  getStatus: () => ({ ...status }),
  createGoal,
  importAccountProgress,
  keepLocalProfileEmpty,
  startCurrentStep,
  reportCurrentExpedition,
  resumeCurrentStep,
  undeferCurrentStep,
  routeCurrentObstacle,
  exportJson,
  enableExternalBackup,
};
```

- [ ] **Step 5: Load the facade after app.js**

```html
<script src="/assets/js/stepquest-v02-app.js?v=0.1.1-alpha"></script>
```

- [ ] **Step 6: Run facade, storage, and domain checks**

Run: `cd backend && npm run build && npx playwright test e2e/stepquest-v02-storage.spec.ts --project=desktop-chrome && npm run test:domain`

Expected: local Goal creation does not call the server, migration remains one-way, and all pure checks pass.

- [ ] **Step 7: Commit the facade unit**

```bash
git add backend/public/assets/js/stepquest-v02-app.js backend/public/goals.html backend/e2e/stepquest-v02-storage.spec.ts
git commit -m "Add StepQuest v0.2 application facade"
```

---

### Task 5: Primary Start, Expedition, Return, and Resume UI

**Files:**
- Create: `backend/public/assets/js/stepquest-v02-ui.js`
- Modify: `backend/public/goals.html`
- Modify: `backend/public/assets/css/app.css`
- Create: `backend/e2e/stepquest-v02.spec.ts`
- Modify: `backend/e2e/stepquest-alpha.spec.ts`

**Interfaces:**
- Consumes: `StepQuestApp.renderShell`, `StepQuestApp.h`, `StepQuestApp.toast`, and all facade methods.
- Produces: `mount()` and `render()` on `window.StepQuestV02UI`.

- [ ] **Step 1: Write failing end-to-end user-flow tests**

Cover these selectors and outcomes:

```ts
await page.locator('#v02-goal-title').fill('기획서 쓰기');
await page.locator('#v02-create-goal').click();
await expect(page.locator('#v02-start-step')).toBeVisible();
await page.locator('#v02-start-step').click();
await expect(page.locator('#v02-expedition-active')).toContainText('앱을 닫아도 됩니다');
await page.reload();
await expect(page.locator('#v02-return-report')).toBeVisible();
await page.locator('[data-v02-outcome="partial"]').click();
await page.locator('#v02-last-action').fill('첫 문장을 썼음');
await page.locator('#v02-next-action').fill('둘째 문장 첫 단어 쓰기');
await page.locator('#v02-save-outcome').click();
await page.reload();
await expect(page.locator('#v02-resume-anchor')).toContainText('둘째 문장 첫 단어 쓰기');
await page.locator('#v02-resume-step').click();
await expect(page.locator('#v02-start-step')).toBeVisible();
```

Add tests for completed advancing one Step, interrupted requiring an anchor, not-started recording a reason then manual shrink, not-started then defer, duplicate rapid clicks minting one reward, and elapsed time not changing wallet balances.

Use these concrete cases after a shared `resetV02(page)` helper deletes the database and clears localStorage:

```ts
async function resetV02(page) {
  await page.goto('/goals.html');
  await page.evaluate(async () => {
    localStorage.clear(); sessionStorage.clear();
    await new Promise<void>((resolve) => { const request = indexedDB.deleteDatabase('stepquest'); request.onsuccess = request.onerror = request.onblocked = () => resolve(); });
  });
  await page.reload();
}
async function createGoal(page, title) {
  await page.locator('#v02-goal-title').fill(title);
  await page.locator('#v02-create-goal').click();
  await expect(page.locator('#v02-start-step')).toBeVisible();
}
async function createAndStart(page, title) {
  await createGoal(page, title);
  await page.locator('#v02-start-step').click();
  await expect(page.locator('#v02-expedition-active')).toBeVisible();
}

test('completed advances exactly one step', async ({ page }) => {
  await createAndStart(page, '공부 시작하기'); await page.reload();
  const before = await page.locator('[data-v02-current-step]').innerText();
  await page.locator('[data-v02-outcome="completed"]').click();
  await expect(page.locator('[data-v02-current-step]')).not.toHaveText(before);
});

test('interrupted requires and restores a Resume Anchor', async ({ page }) => {
  await createAndStart(page, '글쓰기 시작하기'); await page.reload();
  await page.locator('[data-v02-outcome="interrupted"]').click();
  await page.locator('#v02-save-outcome').click();
  await expect(page.locator('#v02-next-action')).toBeFocused();
  await page.locator('#v02-next-action').fill('마지막 문장 아래 이름 쓰기');
  await page.locator('#v02-save-outcome').click(); await page.reload();
  await expect(page.locator('#v02-resume-anchor')).toContainText('마지막 문장 아래 이름 쓰기');
});

test('not started records reason and supports manual shrink', async ({ page }) => {
  await createAndStart(page, '방 청소하기'); await page.reload();
  await page.locator('[data-v02-outcome="not_started"]').click();
  await page.locator('[data-v02-reason="too_big"]').click();
  await page.locator('#v02-smaller-action').fill('바닥 한 칸 보기');
  await page.locator('#v02-manual-shrink').click();
  await expect(page.locator('[data-v02-current-step]')).toHaveText('바닥 한 칸 보기');
});

test('not started can defer with no wallet change', async ({ page }) => {
  await createAndStart(page, '서류 정리하기'); await page.reload();
  const wallet = await page.locator('#v02-wallet').innerText();
  await page.locator('[data-v02-outcome="not_started"]').click();
  await page.locator('[data-v02-reason="not_now"]').click();
  await page.locator('#v02-defer').click();
  await expect(page.locator('#v02-deferred-step')).toBeVisible();
  await expect(page.locator('#v02-wallet')).toHaveText(wallet);
  await page.locator('#v02-undefer-step').click();
  await expect(page.locator('#v02-start-step')).toBeVisible();
  await expect(page.locator('#v02-wallet')).toHaveText(wallet);
});

test('double click and elapsed time do not multiply rewards', async ({ page }) => {
  await createGoal(page, '문서 쓰기');
  await page.locator('#v02-start-step').dblclick();
  const wallet = await page.evaluate(() => window.StepQuestV02App.getSnapshot().wallet);
  await page.evaluate(() => { const original = Date.now; Date.now = () => original() + 1000 * 60 * 60 * 24 * 30; });
  expect(await page.evaluate(() => window.StepQuestV02App.getSnapshot().wallet)).toEqual(wallet);
});

test('exports valid JSON and rotates five recovery snapshots', async ({ page }) => {
  await createGoal(page, '백업 확인');
  for (let index = 0; index < 6; index += 1) {
    const step = await page.evaluate(() => window.StepQuestV02App.getSnapshot().steps.find((item) => item.status === 'active'));
    if (!step) break;
    await page.locator('#v02-start-step').click(); await page.locator('#v02-open-report').click(); await page.locator('[data-v02-outcome="completed"]').click();
  }
  const exported = await page.evaluate(() => window.StepQuestV02App.exportJson());
  expect(JSON.parse(exported).schemaVersion).toBe(2);
  const backupCount = await page.evaluate(async () => (await (await window.StepQuestV02Storage.openRepository()).exportRecords()).backups.length);
  expect(backupCount).toBeLessThanOrEqual(5);
});

test('writes the latest state to an authorized external file', async ({ page }) => {
  const supported = await page.evaluate(() => Boolean(navigator.storage?.getDirectory));
  test.skip(!supported, 'OPFS file handles are unavailable in this browser');
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle('stepquest-e2e-backup.json', { create: true });
    window.showSaveFilePicker = async () => handle;
  });
  await page.locator('#v02-enable-backup').click();
  await createGoal(page, '외부 백업 확인');
  const text = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const file = await (await root.getFileHandle('stepquest-e2e-backup.json')).getFile();
    return file.text();
  });
  expect(JSON.parse(text).goals[0].title).toBe('외부 백업 확인');
});

test('storage persistence denial keeps the app usable and shows backup', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'storage', { value: { persisted: async () => false, persist: async () => false, getDirectory: navigator.storage?.getDirectory?.bind(navigator.storage) }, configurable: true });
  });
  await page.goto('/goals.html');
  await createGoal(page, '저장 거부 확인');
  await expect(page.locator('.v02-storage-warning')).toBeVisible();
  await expect(page.locator('#v02-start-step')).toBeVisible();
});
```

Keep only the production-super-mode test in `stepquest-alpha.spec.ts`; the other three tests assert the completion-first UI that this feature intentionally replaces.

- [ ] **Step 2: Run the v0.2 flow and confirm RED**

Run: `cd backend && npx playwright test e2e/stepquest-v02.spec.ts --project=desktop-chrome`

Expected: failure because v0.2 UI selectors are absent.

- [ ] **Step 3: Implement the renderer states**

`mount` calls `App.renderShell('지금 할 한 동작')`, adds `v02-mode` to `<body>`, initializes the facade, and renders only into `#page-root`.

Render exactly one of these states:

- Empty: one-line Goal form and storage status.
- Active with anchor: Resume Anchor first, then `[재개]`.
- Active without anchor: one current Step and `[시작]`.
- Just started: expedition panel, “앱을 닫아도 됩니다”, and `[돌아왔어요]`.
- Recovered active expedition: four-outcome return report immediately.
- Partial or interrupted selected: Resume Anchor form with required next action.
- Not-started selected: one reason question followed by `[더 작게]` and `[나중에]`.
- Deferred: the preserved Step and `[다시 꺼내기]`, which grants no reward.
- Pending account import: `[계정 진행 복사]` and `[이 기기에서 새로 시작]` before an empty Goal form.

The wallet header labels are `스텝코인` and `골드`. Do not render streak, consistency score, multiple facilities, multiple costumes, or a growing expedition counter in `v02-mode`.

Implement the state selection with this concrete renderer structure:

```js
(function expose(root) {
  let App; let Core; let reporting = false; let selectedOutcome = null; let selectedReason = null;
  const outcomeLabels = { completed: '완료', partial: '조금 진행', interrupted: '시작했지만 멈춤', not_started: '시작 못 함' };
  const reasons = { too_big: '너무 큼', no_material: '준비물 없음', unclear: '무엇을 할지 애매', tired: '피곤함', wrong_place: '장소 안 맞음', not_now: '지금 싫음', anxious: '불안·부담' };
  const h = (value) => App.h(String(value ?? ''));
  const key = (name, id) => `v02:${name}:${id}`;

  function viewModel() {
    const state = Core.getSnapshot();
    const active = state.steps.find((item) => item.status === 'active');
    const interrupted = state.steps.find((item) => item.status === 'interrupted');
    const deferred = state.steps.find((item) => item.status === 'deferred');
    const expedition = state.expeditions.find((item) => item.status === 'active');
    const anchor = interrupted && state.resumeAnchors.filter((item) => item.stepId === interrupted.id && !item.consumedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const lastNotStarted = [...state.events].reverse().find((item) => item.type === 'expedition_reported' && item.outcome === 'not_started');
    const routed = lastNotStarted && state.events.some((item) => item.type === 'obstacle_routed' && item.stepId === lastNotStarted.stepId && item.createdAt >= lastNotStarted.createdAt);
    return { state, active, interrupted, deferred, expedition, anchor, pendingObstacle: lastNotStarted && !routed ? lastNotStarted : null };
  }

  function render() {
    App.renderShell('지금 할 한 동작'); document.body.classList.add('v02-mode');
    const rootNode = document.getElementById('page-root'); const vm = viewModel(); const status = Core.getStatus();
    const wallet = `<div id="v02-wallet" class="v02-wallet"><span>스텝코인 <b>${vm.state.wallet.stepCoin}</b></span><span>골드 <b>${vm.state.wallet.gold}</b></span></div>`;
    let body;
    if (status.pendingAccountImport) body = `<section class="panel v02-runner"><h2>계정의 현재 행동을 이 기기로 가져올까요?</h2><div class="primary-actions"><button id="v02-import-account">계정 진행 복사</button><button id="v02-empty-local" class="ghost">이 기기에서 새로 시작</button></div></section>`;
    else if (vm.pendingObstacle) body = `<section class="panel v02-obstacle"><h2>지금 무엇이 막고 있나요?</h2><div class="reason-grid">${Object.entries(reasons).map(([value, label]) => `<button data-v02-reason="${value}">${label}</button>`).join('')}</div>${selectedReason ? `<label>더 작은 손동작<input id="v02-smaller-action" /></label><div class="primary-actions"><button id="v02-manual-shrink">더 작게</button><button id="v02-defer" class="ghost">나중에</button></div>` : ''}</section>`;
    else if (vm.expedition && (reporting || status.recoveredExpedition)) body = `<section id="v02-return-report" class="panel v02-runner"><h2>어떻게 돌아왔나요?</h2><div class="v02-outcome-grid">${Object.entries(outcomeLabels).map(([value, label]) => `<button data-v02-outcome="${value}">${label}</button>`).join('')}</div>${['partial', 'interrupted'].includes(selectedOutcome) ? `<div class="v02-anchor"><label>마지막으로 한 것<input id="v02-last-action" /></label><label>다음 손동작<input id="v02-next-action" aria-required="true" /></label><label>장소<input id="v02-location" /></label><label>필요한 준비물<input id="v02-material" /></label><label>메모<textarea id="v02-note"></textarea></label><button id="v02-save-outcome">기록 저장</button></div>` : ''}</section>`;
    else if (vm.expedition) body = `<section id="v02-expedition-active" class="panel v02-expedition"><h2>${h(vm.state.steps.find((item) => item.id === vm.expedition.stepId)?.title)}</h2><p>앱을 닫아도 됩니다.</p><button id="v02-open-report">돌아왔어요</button></section>`;
    else if (vm.interrupted && vm.anchor) body = `<section id="v02-resume-anchor" class="panel v02-anchor"><span>마지막 위치</span><p>${h(vm.anchor.lastCompletedAction || '시작한 기록이 남아 있습니다.')}</p><span>다음 손동작</span><h2>${h(vm.anchor.nextPhysicalAction)}</h2><button id="v02-resume-step">재개</button></section>`;
    else if (vm.active) body = `<section class="panel v02-runner"><span>지금 할 하나</span><h2 data-v02-current-step>${h(vm.active.title)}</h2><button id="v02-start-step">시작</button></section>`;
    else if (vm.deferred) body = `<section id="v02-deferred-step" class="panel v02-runner"><h2>이 행동은 나중을 위해 남겨두었습니다.</h2><p>${h(vm.deferred.title)}</p><button id="v02-undefer-step">다시 꺼내기</button></section>`;
    else body = `<section class="panel v02-runner"><label>목표 한 줄<input id="v02-goal-title" maxlength="140" /></label><button id="v02-create-goal">첫 행동 만들기</button></section>`;
    const backupTime = status.lastExternalBackupAt ? `마지막 외부 파일 백업: ${h(status.lastExternalBackupAt)}` : '외부 파일 백업 기록 없음';
    const warning = status.mode === 'localStorage' || !status.persisted || status.manualBackupDue || status.externalBackupStale || status.migrationError || status.quarantinedRecords ? `<section class="panel v02-storage-warning"><p>${status.migrationError ? '이전 기록을 자동으로 옮기지 못했습니다. 원본은 그대로 보존되어 있습니다.' : status.quarantinedRecords ? `읽을 수 없는 기록 ${status.quarantinedRecords}개를 격리하고 나머지 기록을 열었습니다.` : status.manualBackupDue ? '변경 사항이 5회 쌓였습니다. 외부 JSON 백업을 갱신하세요.' : status.externalBackupStale ? '외부 자동 백업을 갱신하지 못했습니다. 다시 시도하거나 JSON을 내려받으세요.' : '브라우저 저장소가 지워질 수 있습니다.'}</p><small>${backupTime}</small><button id="v02-export">JSON 백업</button><button id="v02-enable-backup">자동 백업 파일 선택</button></section>` : `<div><small>${backupTime}</small><button id="v02-export" class="ghost">JSON 백업</button><button id="v02-enable-backup" class="ghost">자동 백업 파일 선택</button></div>`;
    rootNode.innerHTML = `${wallet}${body}${warning}<p id="v02-live" aria-live="polite"></p>`; wire();
  }
```

Close the module after the action wiring below with `root.StepQuestV02UI = { mount, render }; })(globalThis);`.

- [ ] **Step 4: Wire actions with stable command keys**

Generate one command key when the user initiates an action and disable its button until the promise settles. Outcome key is `expedition:{id}:report`; retry reuses it. Manual shrink key is `step:{id}:obstacle:{reason}:manual_shrink`; defer uses `step:{id}:obstacle:{reason}:defer`.

Use `aria-live="polite"` for saved-state feedback, `aria-required="true"` on next physical action, and focus the first invalid field. Animation classes must be disabled by the existing reduced-motion preference.

Wire the renderer using these exact calls:

```js
  async function run(button, action) {
    button.disabled = true;
    try { const result = await action(); if (result === false) button.disabled = false; else render(); }
    catch (error) { button.disabled = false; App.toast(error.message, true); }
  }
  function wire() {
    document.getElementById('v02-create-goal')?.addEventListener('click', (event) => run(event.currentTarget, async () => { const title = document.getElementById('v02-goal-title').value.trim(); if (!title) { document.getElementById('v02-goal-title').focus(); return false; } await Core.createGoal({ title, category: 'auto', burdenLevel: 4, energyLevel: 'medium' }); }));
    document.getElementById('v02-start-step')?.addEventListener('click', (event) => run(event.currentTarget, async () => { const step = Core.getSnapshot().steps.find((item) => item.status === 'active'); await Core.startCurrentStep(key('start', step.id)); reporting = false; }));
    document.getElementById('v02-open-report')?.addEventListener('click', () => { reporting = true; render(); });
    document.querySelectorAll('[data-v02-outcome]').forEach((button) => button.addEventListener('click', (event) => { selectedOutcome = button.dataset.v02Outcome; if (selectedOutcome === 'partial' || selectedOutcome === 'interrupted') return render(); return run(event.currentTarget, async () => { const expedition = Core.getSnapshot().expeditions.find((item) => item.status === 'active'); await Core.reportCurrentExpedition({ outcome: selectedOutcome, idempotencyKey: key('report', expedition.id) }); reporting = false; selectedOutcome = null; }); }));
    document.getElementById('v02-save-outcome')?.addEventListener('click', (event) => run(event.currentTarget, async () => { const nextPhysicalAction = document.getElementById('v02-next-action').value.trim(); if (!nextPhysicalAction) { document.getElementById('v02-next-action').focus(); return false; } const expedition = Core.getSnapshot().expeditions.find((item) => item.status === 'active'); await Core.reportCurrentExpedition({ outcome: selectedOutcome, idempotencyKey: key('report', expedition.id), anchor: { lastCompletedAction: document.getElementById('v02-last-action').value.trim(), nextPhysicalAction, location: document.getElementById('v02-location').value.trim(), requiredMaterial: document.getElementById('v02-material').value.trim(), note: document.getElementById('v02-note').value.trim() } }); reporting = false; selectedOutcome = null; }));
    document.getElementById('v02-resume-step')?.addEventListener('click', (event) => run(event.currentTarget, async () => { const step = Core.getSnapshot().steps.find((item) => item.status === 'interrupted'); await Core.resumeCurrentStep(step.id, key('resume', step.id)); }));
    document.getElementById('v02-undefer-step')?.addEventListener('click', (event) => run(event.currentTarget, async () => { const step = Core.getSnapshot().steps.find((item) => item.status === 'deferred'); await Core.undeferCurrentStep(step.id, key('undefer', step.id)); }));
    document.querySelectorAll('[data-v02-reason]').forEach((button) => button.addEventListener('click', () => { selectedReason = button.dataset.v02Reason; render(); }));
    document.getElementById('v02-manual-shrink')?.addEventListener('click', (event) => run(event.currentTarget, async () => { const value = document.getElementById('v02-smaller-action').value.trim(); if (!value) { document.getElementById('v02-smaller-action').focus(); return false; } const step = Core.getSnapshot().steps.find((item) => item.status === 'active'); await Core.routeCurrentObstacle({ reason: selectedReason, route: 'manual_shrink', nextPhysicalAction: value, idempotencyKey: key(`obstacle:${selectedReason}:manual_shrink`, step.id) }); selectedReason = null; }));
    document.getElementById('v02-defer')?.addEventListener('click', (event) => run(event.currentTarget, async () => { const step = Core.getSnapshot().steps.find((item) => item.status === 'active'); await Core.routeCurrentObstacle({ reason: selectedReason, route: 'defer', idempotencyKey: key(`obstacle:${selectedReason}:defer`, step.id) }); selectedReason = null; }));
    document.getElementById('v02-import-account')?.addEventListener('click', (event) => run(event.currentTarget, () => Core.importAccountProgress()));
    document.getElementById('v02-empty-local')?.addEventListener('click', (event) => run(event.currentTarget, () => Core.keepLocalProfileEmpty()));
    document.getElementById('v02-export')?.addEventListener('click', (event) => run(event.currentTarget, async () => { StepQuestV02Backup.downloadJson(await Core.exportJson()); return false; }));
    document.getElementById('v02-enable-backup')?.addEventListener('click', (event) => run(event.currentTarget, () => Core.enableExternalBackup()));
  }
  async function mount(options) { App = options.App; Core = options.Core; await Core.init({ App }); reporting = Core.getStatus().recoveredExpedition; render(); }
```

- [ ] **Step 5: Add scoped responsive styles**

Add `.v02-mode`, `.v02-runner`, `.v02-wallet`, `.v02-expedition`, `.v02-outcome-grid`, `.v02-anchor`, `.v02-obstacle`, and `.v02-storage-warning`. Hide `.hero`, `.nav-list`, and legacy progress panels only under `.v02-mode`. At `max-width: 720px`, outcome and wallet grids become one column and all primary buttons have at least 44px height.

Add these scoped declarations, extending colors from existing CSS variables:

```css
.v02-mode .hero, .v02-mode .nav-list { display: none; }
.v02-runner, .v02-expedition, .v02-anchor, .v02-obstacle, .v02-storage-warning { max-width: 760px; margin-inline: auto; }
.v02-wallet, .v02-outcome-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
.v02-wallet span { border: 1px solid var(--line); border-radius: 12px; padding: 12px; background: rgba(255,255,255,.04); }
.v02-runner h2, .v02-expedition h2, .v02-anchor h2 { font-size: clamp(30px, 6vw, 52px); }
.v02-expedition { min-height: 360px; display: grid; align-content: center; text-align: center; }
.v02-anchor label, .v02-obstacle label { display: grid; gap: 8px; margin-block: 12px; }
.v02-storage-warning { border-color: #a88445; }
@media (max-width: 720px) {
  .v02-wallet, .v02-outcome-grid { grid-template-columns: 1fr; }
  .v02-mode button { min-height: 44px; }
}
```

- [ ] **Step 6: Mount the UI from the existing bootstrap**

Load `stepquest-v02-ui.js` after the facade. Replace the current DOMContentLoaded body with:

```js
window.addEventListener('DOMContentLoaded', async () => {
  try { await App.refresh(); } catch (error) { App.log(`${ko.initFailed}: ${error.message}`); }
  await window.StepQuestV02UI.mount({ App, Core: window.StepQuestV02App });
});
```

Remove the legacy `stepquest:refresh` renderer registration so account events cannot overwrite the v0.2 screen. Keep service-worker registration unchanged.

- [ ] **Step 7: Run desktop and mobile UI tests**

Run: `cd backend && npm run build && npx playwright test e2e/stepquest-v02.spec.ts --project=desktop-chrome --project=mobile-chrome`

Expected: all start, reload, return, anchor, router, reward, and responsive checks pass.

- [ ] **Step 8: Commit the UI unit**

```bash
git add backend/public/assets/js/stepquest-v02-ui.js backend/public/goals.html backend/public/assets/css/app.css backend/e2e/stepquest-v02.spec.ts backend/e2e/stepquest-alpha.spec.ts
git commit -m "Add StepQuest start and return experience"
```

---

### Task 6: PWA Cache, Persistence Contract, and Cross-Browser Verification

**Files:**
- Modify: `backend/public/sw.js`
- Modify: `backend/scripts/stepquest-persistence-test.js`
- Modify: `blueprint.md`

**Interfaces:**
- Consumes: all new static assets and final browser selectors.
- Produces: offline availability, structural regression assertions, and documented completion status.

- [ ] **Step 1: Add failing persistence-contract assertions**

Assert that `goals.html` loads all five v0.2 scripts in dependency order, `app.js` contains the `stepquest_v02_active` guard, the UI contains all four outcome values and required selectors, the storage file opens IndexedDB version 2, and the service worker precaches every new asset with `v=0.1.1-alpha`.

Add these concrete source-contract assertions:

```js
const v02Assets = ['stepquest-v02-domain.js', 'stepquest-v02-storage.js', 'stepquest-v02-backup.js', 'stepquest-v02-app.js', 'stepquest-v02-ui.js'];
v02Assets.forEach((asset) => {
  assert.ok(goalsHtml.includes(`/assets/js/${asset}?v=0.1.1-alpha`), `goals shell must load ${asset}`);
  assert.ok(serviceWorker.includes(`/assets/js/${asset}?v=0.1.1-alpha`), `service worker must cache ${asset}`);
});
assert.ok(browserApp.includes("localStorage.getItem('stepquest_v02_active') === '1'"), 'legacy guest writes need the committed migration guard');
assert.ok(v02Storage.includes("indexedDB.open(DB_NAME, DB_VERSION)"), 'v0.2 storage must open the versioned database');
assert.ok(v02Storage.includes("const DB_VERSION = 2"), 'v0.2 database version must be 2');
['completed', 'partial', 'interrupted', 'not_started'].forEach((outcome) => assert.ok(v02Ui.includes(outcome), `return UI must include ${outcome}`));
['v02-start-step', 'v02-return-report', 'v02-resume-anchor', 'v02-next-action', 'v02-undefer-step'].forEach((id) => assert.ok(v02Ui.includes(id), `v0.2 UI must include ${id}`));
```

- [ ] **Step 2: Run the persistence runner and confirm RED**

Run: `cd backend && npm run build && node scripts/stepquest-persistence-test.js`

Expected: failure identifying the first missing v0.2 cache assertion.

- [ ] **Step 3: Precache the new assets**

Add these exact entries after `app.js` in `APP_SHELL`:

```js
'/assets/js/stepquest-v02-domain.js?v=0.1.1-alpha',
'/assets/js/stepquest-v02-storage.js?v=0.1.1-alpha',
'/assets/js/stepquest-v02-backup.js?v=0.1.1-alpha',
'/assets/js/stepquest-v02-app.js?v=0.1.1-alpha',
'/assets/js/stepquest-v02-ui.js?v=0.1.1-alpha',
```

Do not change `CACHE_VERSION`; the global app-version migration is outside this slice.

- [ ] **Step 4: Run full verification**

Run in `backend`:

```bash
npm run build
npm run test:domain
npm run audit:ci
npm run test:e2e
```

Expected: zero failures on desktop Chrome, mobile Chrome, and mobile Safari. File System Access assertions branch on capability; Safari must show manual backup status rather than a false automatic-backup claim.

- [ ] **Step 5: Perform a built-app persistence inspection**

Run: `cd backend && npm start`

In a browser, create a Goal, start, reload, report partial, save an anchor, reload, resume, and export JSON. Inspect Application > IndexedDB > `stepquest` and confirm the Expedition is reported, the Anchor exists, wallet values match the ledger, and `stepquest_guest_state` retains its original bytes.

Stop the server after inspection. Record the observed store names and balances in the implementation handoff; do not commit generated Playwright reports or audit JSON.

- [ ] **Step 6: Update the blueprint**

Mark the implemented and verified checkboxes under “Current Change” and add the exact verification commands. Leave later v0.2 roadmap items unchecked.

Replace the current unchecked slice lines with:

```markdown
- [x] Implement the v0.2 domain transitions test-first.
- [x] Implement the minimum not-started router with persisted reason, manual shrink, and defer.
- [x] Implement IndexedDB persistence, migration, persistent-storage request, JSON export, and backup rotation.
- [x] Replace the primary UI with start, expedition, four-outcome return, and Resume Anchor flow.
- [x] Verify reload recovery and regressions in the built PWA.

Verification: `npm run build`, `npm run test:domain`, `npm run audit:ci`, and `npm run test:e2e` from `backend/`.
```

- [ ] **Step 7: Commit cache and verification updates**

```bash
git add backend/public/sw.js backend/scripts/stepquest-persistence-test.js blueprint.md
git commit -m "Verify StepQuest v0.2 local-first flow"
```

---

## Plan Self-Review Record

- Spec coverage: Tasks 1-6 cover start, four outcomes, Resume Anchor, resume, undefer, IndexedDB, persistence request, JSON export, rolling snapshots, optional external backup, five-change manual-backup reminders, entry-segment idempotency, replacement reward lineage, Gold cap, non-destructive guest migration, explicit account import, legacy write blocking, corrupt-record quarantine, the minimum obstacle router, PWA cache, and cross-browser verification.
- Scope boundary: action-size adaptation, full reason-specific routing, long-return variants, Gold lineage hardening, central-camp spending, event compression, “already started” shortcut, cloud sync, and app-version migration remain outside this slice.
- Type consistency: `stepCoin`, `gold`, `entrySegmentId`, `rewardLineage`, `nextPhysicalAction`, `manual_shrink`, `defer`, `undeferStep`, `idempotencyKey`, and all public facade names are consistent across tasks.
- Test order: every production unit begins with a runner or browser test that fails because the feature is absent, then implements the minimum behavior and reruns regression checks.
