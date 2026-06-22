#!/usr/bin/env node
const assert = require('node:assert/strict');
const {
  BASIC_COSTUMES,
  activateStarterCostume,
  completeActiveStep,
  createStepQuestState,
  deferActiveStep,
  getReturnEligibility,
  resumeDeferredStep,
  shrinkActiveStep,
  skipActiveStep,
  startReturnSession,
  undoLastCompletion,
} = require('../dist/stepquest/stepquest.state');

const STUDY_GOAL = '\uD1A0\uC775 \uACF5\uBD80\uD558\uAE30';
const T0 = '2026-06-21T00:00:00.000Z';
const T1 = '2026-06-21T00:01:00.000Z';
const T2 = '2026-06-22T01:05:00.000Z';

function run() {
  const initial = createStepQuestState({
    userId: 'user-1',
    goalTitle: STUDY_GOAL,
    category: 'auto',
    burdenLevel: 4,
    energyLevel: 'low',
    now: T0,
  });

  assert.equal(initial.goal.status, 'active');
  assert.equal(initial.chain.revision, 1);
  assert.equal(initial.steps.filter((step) => step.status === 'active').length, 1);
  assert.ok(initial.steps[0].estimatedSeconds <= 10);
  assert.equal(BASIC_COSTUMES.length, 6);
  assert.ok(BASIC_COSTUMES.some((costume) => costume.id === 'blank_scribe'));
  assert.ok(BASIC_COSTUMES.some((costume) => costume.id === 'dawn_knight'));
  assert.ok(BASIC_COSTUMES.every((costume) => costume.licensedContent === false));

  const completed = completeActiveStep(initial, T1, 'step-1-once');
  assert.equal(completed.steps[0].status, 'completed');
  assert.equal(completed.steps[1].status, 'active');
  assert.equal(completed.attempts.at(-1).action, 'complete');
  assert.equal(completed.sessionCombo, 1);
  assert.ok(completed.user.xp > 0);
  const firstReward = completed.rewards.find((reward) => reward.idempotencyKey === 'step-1-once' && reward.rewardType === 'xp');
  assert.equal(firstReward.amount, 1);
  assert.ok(completed.village.find((item) => item.facilityKey === 'knowledge_tower').xp > 0);

  const duplicate = completeActiveStep(completed, T1, 'step-1-once');
  assert.equal(duplicate.user.xp, completed.user.xp);
  assert.equal(duplicate.rewards.length, completed.rewards.length);

  const undone = undoLastCompletion(completed, T1);
  assert.equal(undone.steps[0].status, 'active');
  assert.equal(undone.steps[1].status, 'pending');
  assert.equal(undone.attempts.at(-1).action, 'undo');
  assert.equal(undone.user.xp, initial.user.xp);
  assert.equal(undone.user.material, initial.user.material);
  assert.equal(undone.rewards.some((reward) => reward.sourceId === 'step-1'), false);
  assert.equal(undone.village.find((item) => item.facilityKey === 'knowledge_tower').xp, 0);

  const combo2 = completeActiveStep(completed, T1, 'step-2-once');
  const combo3 = completeActiveStep(combo2, T1, 'step-3-once');
  assert.equal(combo3.sessionCombo, 3);
  const thirdXp = combo3.rewards.find((reward) => reward.idempotencyKey === 'step-3-once' && reward.rewardType === 'xp').amount;
  const thirdFacility = combo3.rewards.find((reward) => reward.idempotencyKey === 'step-3-once:facility').amount;
  assert.ok(thirdXp > thirdFacility);

  const shrunk = shrinkActiveStep(completed, T1, 'too_big');
  assert.equal(shrunk.steps[1].status, 'replaced');
  assert.equal(shrunk.chain.revision, 2);
  assert.equal(shrunk.steps.filter((step) => step.status === 'active').length, 1);
  assert.equal(shrunk.attempts.at(-1).action, 'shrink');

  const skipped = skipActiveStep(shrunk, T1);
  assert.equal(skipped.attempts.at(-1).action, 'skip');
  assert.equal(skipped.steps.filter((step) => step.status === 'active').length, 1);

  const deferred = deferActiveStep(completed, T1, 'not_now');
  assert.equal(deferred.attempts.at(-1).action, 'defer');
  assert.equal(deferred.steps.filter((step) => step.status === 'active').length, 0);
  assert.equal(deferred.steps.find((step) => step.status === 'deferred').id, completed.steps.find((step) => step.status === 'active').id);
  assert.equal(deferred.user.xp, completed.user.xp);

  const resumed = resumeDeferredStep(deferred, T1);
  assert.equal(resumed.steps.filter((step) => step.status === 'active').length, 1);
  assert.equal(resumed.steps.find((step) => step.status === 'active').id, completed.steps.find((step) => step.status === 'active').id);

  const returnedFromDeferred = startReturnSession(deferred, T2);
  assert.equal(returnedFromDeferred.steps[0].status, 'active');
  assert.ok(returnedFromDeferred.steps.some((step) => step.status === 'deferred'));

  const eligibility = getReturnEligibility(completed, T2);
  assert.equal(eligibility.eligible, true);
  assert.ok(eligibility.inactiveHours >= 24);
  const returned = startReturnSession(completed, T2);
  assert.equal(returned.steps[0].status, 'active');
  assert.equal(returned.steps[0].estimatedSeconds, 5);
  assert.equal(returned.user.returnMarks, 1);
  const returnCompleted = completeActiveStep(returned, T2, 'return-step-once');
  assert.equal(returnCompleted.steps[0].status, 'completed');
  assert.equal(returnCompleted.attempts.at(-1).action, 'complete');
  assert.ok(returnCompleted.user.xp > returned.user.xp);

  const costumeState = activateStarterCostume(createStepQuestState({
    userId: 'user-1',
    goalTitle: STUDY_GOAL,
    category: 'auto',
    burdenLevel: 4,
    energyLevel: 'low',
    now: T0,
  }), T1);
  assert.equal(costumeState.chain.source, 'costume');
  assert.equal(costumeState.steps.some((step) => step.status === 'replaced'), true);
  assert.equal(costumeState.steps.filter((step) => step.status === 'active').length, 1);

  console.log(JSON.stringify({ ok: true, checked: 'stepquest-state' }, null, 2));
}

run();
