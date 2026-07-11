#!/usr/bin/env node
const assert = require('node:assert/strict');
const Domain = require('../public/assets/js/stepquest-v02-domain');

const NOW = '2026-07-11T00:00:00.000Z';
let sequence = 0;
const idFactory = (prefix) => `${prefix}-${++sequence}`;

function makeState(phases = ['orient', 'prepare', 'open', 'start']) {
  const state = Domain.createInitialState();
  state.goals.push({
    id: 'goal-1',
    title: '기획서 쓰기',
    type: 'project',
    status: 'active',
    createdAt: NOW,
    updatedAt: NOW,
  });
  state.steps = phases.map((phase, index) => ({
    id: `step-${index + 1}`,
    goalId: 'goal-1',
    title: `행동 ${index + 1}`,
    nextPhysicalAction: `행동 ${index + 1}`,
    phase,
    rewardLineage: `step-${index + 1}`,
    status: index === 0 ? 'active' : 'pending',
    orderIndex: index,
    createdAt: NOW,
    updatedAt: NOW,
  }));
  state.steps = Domain.assignEntrySegments(state.steps, idFactory);
  return state;
}

function activeStep(state) {
  return state.steps.find((step) => step.status === 'active');
}

function activeExpedition(state) {
  return state.expeditions.find((expedition) => expedition.status === 'active');
}

function testEntrySegmentsPayOnce() {
  const separated = Domain.assignEntrySegments([
    { id: 'a', phase: 'orient' },
    { id: 'b', phase: 'start' },
    { id: 'c', phase: 'open' },
  ], idFactory);
  assert.notEqual(separated[0].entrySegmentId, separated[2].entrySegmentId);

  let transition = Domain.startStep(makeState(), {
    stepId: 'step-1',
    idempotencyKey: 'entry-start-1',
    now: NOW,
    idFactory,
  });
  assert.equal(transition.state.wallet.stepCoin, 2);
  assert.equal(transition.state.steps[0].status, 'started');

  const replay = Domain.startStep(transition.state, {
    stepId: 'step-1',
    idempotencyKey: 'entry-start-1',
    now: NOW,
    idFactory,
  });
  assert.equal(replay.duplicate, true);
  assert.equal(replay.state.wallet.stepCoin, 2);

  transition = Domain.reportOutcome(transition.state, {
    expeditionId: transition.result.expeditionId,
    outcome: 'completed',
    idempotencyKey: 'entry-report-1',
    now: NOW,
    idFactory,
  });
  transition = Domain.startStep(transition.state, {
    stepId: 'step-2',
    idempotencyKey: 'entry-start-2',
    now: NOW,
    idFactory,
  });
  assert.equal(transition.state.wallet.stepCoin, 2, 'one contiguous entry segment pays once');
}

function testPartialProgressAndResumeAnchor() {
  let transition = Domain.startStep(makeState(['start', 'close']), {
    stepId: 'step-1',
    idempotencyKey: 'partial-start',
    now: NOW,
    idFactory,
  });
  assert.deepEqual(transition.state.wallet, { stepCoin: 5, gold: 0 });

  transition = Domain.reportOutcome(transition.state, {
    expeditionId: transition.result.expeditionId,
    outcome: 'partial',
    idempotencyKey: 'partial-report',
    now: NOW,
    idFactory,
    anchor: {
      lastCompletedAction: '첫 문장 쓰기',
      nextPhysicalAction: '둘째 문장 첫 단어 쓰기',
      location: '작업실',
      requiredMaterial: '노트북',
      note: '수정하지 않기',
    },
  });
  assert.deepEqual(transition.state.wallet, { stepCoin: 12, gold: 1 });
  assert.equal(transition.state.steps[0].status, 'interrupted');
  assert.equal(transition.state.resumeAnchors[0].nextPhysicalAction, '둘째 문장 첫 단어 쓰기');

  transition = Domain.resumeStep(transition.state, {
    stepId: 'step-1',
    idempotencyKey: 'partial-resume',
    now: NOW,
  });
  assert.equal(transition.state.steps[0].status, 'active');
  assert.equal(transition.state.resumeAnchors[0].consumedAt, NOW);
  assert.deepEqual(transition.state.wallet, { stepCoin: 12, gold: 1 });
}

function testReplacementLineageCannotMintStartReward() {
  let transition = Domain.startStep(makeState(['start']), {
    stepId: 'step-1',
    idempotencyKey: 'lineage-start-original',
    now: NOW,
    idFactory,
  });
  transition = Domain.reportOutcome(transition.state, {
    expeditionId: transition.result.expeditionId,
    outcome: 'not_started',
    idempotencyKey: 'lineage-report-original',
    now: NOW,
    idFactory,
  });
  const walletAfterFirstStart = transition.state.wallet.stepCoin;

  transition = Domain.routeObstacle(transition.state, {
    stepId: 'step-1',
    reason: 'too_big',
    route: 'manual_shrink',
    nextPhysicalAction: '문서 제목만 보기',
    reportIdempotencyKey: 'lineage-report-original',
    idempotencyKey: 'lineage-shrink-1',
    now: NOW,
    idFactory,
  });
  assert.equal(
    transition.state.events.find((event) => event.type === 'obstacle_routed').resolvesEventKey,
    'lineage-report-original',
  );
  let replacement = activeStep(transition.state);
  assert.equal(replacement.phase, 'start');
  assert.equal(replacement.rewardLineage, 'step-1');
  transition = Domain.startStep(transition.state, {
    stepId: replacement.id,
    idempotencyKey: 'lineage-start-1',
    now: NOW,
    idFactory,
  });
  assert.equal(transition.state.wallet.stepCoin, walletAfterFirstStart);

  transition = Domain.reportOutcome(transition.state, {
    expeditionId: transition.result.expeditionId,
    outcome: 'not_started',
    idempotencyKey: 'lineage-report-1',
    now: NOW,
    idFactory,
  });
  replacement = activeStep(transition.state);
  transition = Domain.routeObstacle(transition.state, {
    stepId: replacement.id,
    reason: 'too_big',
    route: 'manual_shrink',
    nextPhysicalAction: '파일 이름만 보기',
    reportIdempotencyKey: 'lineage-report-1',
    idempotencyKey: 'lineage-shrink-2',
    now: NOW,
    idFactory,
  });
  replacement = activeStep(transition.state);
  assert.equal(replacement.rewardLineage, 'step-1');
  transition = Domain.startStep(transition.state, {
    stepId: replacement.id,
    idempotencyKey: 'lineage-start-2',
    now: NOW,
    idFactory,
  });
  assert.equal(transition.state.wallet.stepCoin, walletAfterFirstStart, 'two shrink replacements cannot mint start rewards');
}

function testOutcomeRules() {
  let transition = Domain.startStep(makeState(['start']), {
    stepId: 'step-1',
    idempotencyKey: 'not-started-start',
    now: NOW,
    idFactory,
  });
  transition = Domain.reportOutcome(transition.state, {
    expeditionId: transition.result.expeditionId,
    outcome: 'not_started',
    idempotencyKey: 'not-started-report',
    now: NOW,
    idFactory,
  });
  assert.equal(transition.state.steps[0].status, 'active');
  assert.deepEqual(transition.state.wallet, { stepCoin: 5, gold: 0 });

  transition = Domain.startStep(makeState(['start']), {
    stepId: 'step-1',
    idempotencyKey: 'interrupted-start',
    now: NOW,
    idFactory,
  });
  assert.throws(() => Domain.reportOutcome(transition.state, {
    expeditionId: transition.result.expeditionId,
    outcome: 'interrupted',
    idempotencyKey: 'interrupted-report',
    now: NOW,
    idFactory,
    anchor: { nextPhysicalAction: '' },
  }), /NEXT_PHYSICAL_ACTION_REQUIRED/);

  transition = Domain.startStep(makeState(['start']), {
    stepId: 'step-1',
    idempotencyKey: 'completed-start',
    now: NOW,
    idFactory,
  });
  transition = Domain.reportOutcome(transition.state, {
    expeditionId: transition.result.expeditionId,
    outcome: 'completed',
    idempotencyKey: 'completed-report',
    now: NOW,
    idFactory,
  });
  assert.deepEqual(transition.state.wallet, { stepCoin: 18, gold: 2 });
  assert.equal(transition.state.goals[0].status, 'completed');
}

function testNotStartedRequiresObstacleRouteBeforeRestart() {
  let transition = Domain.startStep(makeState(['start']), {
    stepId: 'step-1',
    idempotencyKey: 'blocked-start',
    now: NOW,
    idFactory,
  });
  transition = Domain.reportOutcome(transition.state, {
    expeditionId: transition.result.expeditionId,
    outcome: 'not_started',
    idempotencyKey: 'blocked-report',
    now: NOW,
    idFactory,
  });

  assert.throws(() => Domain.startStep(transition.state, {
    stepId: 'step-1',
    idempotencyKey: 'blocked-retry',
    now: NOW,
    idFactory,
  }), /OBSTACLE_ROUTE_REQUIRED/);
}

function testLegacyObstacleRouteWithoutLinkAllowsRestart() {
  let transition = Domain.startStep(makeState(['start']), {
    stepId: 'step-1',
    idempotencyKey: 'legacy-route-start',
    now: '2026-07-11T00:00:00.000Z',
    idFactory,
  });
  transition = Domain.reportOutcome(transition.state, {
    expeditionId: transition.result.expeditionId,
    outcome: 'not_started',
    idempotencyKey: 'legacy-route-report',
    now: '2026-07-11T00:00:01.000Z',
    idFactory,
  });
  transition = Domain.routeObstacle(transition.state, {
    stepId: 'step-1',
    reason: 'not_now',
    route: 'defer',
    idempotencyKey: 'legacy-route-defer',
    now: '2026-07-11T00:00:02.000Z',
    idFactory,
  });
  transition = Domain.undeferStep(transition.state, {
    stepId: 'step-1',
    idempotencyKey: 'legacy-route-undefer',
    now: '2026-07-11T00:00:03.000Z',
  });

  assert.doesNotThrow(() => Domain.startStep(transition.state, {
    stepId: 'step-1',
    idempotencyKey: 'legacy-route-restart',
    now: '2026-07-11T00:00:04.000Z',
    idFactory,
  }));
}

function testDeferCanBeUndeferredWithoutReward() {
  let transition = Domain.routeObstacle(makeState(['start']), {
    stepId: 'step-1',
    reason: 'not_now',
    route: 'defer',
    idempotencyKey: 'defer-1',
    now: NOW,
    idFactory,
  });
  assert.equal(transition.state.steps[0].status, 'deferred');
  assert.deepEqual(transition.state.wallet, { stepCoin: 0, gold: 0 });

  transition = Domain.undeferStep(transition.state, {
    stepId: 'step-1',
    idempotencyKey: 'undefer-1',
    now: NOW,
  });
  assert.equal(transition.state.steps[0].status, 'active');
  assert.deepEqual(transition.state.wallet, { stepCoin: 0, gold: 0 });
  assert.ok(transition.state.events.some((event) => event.type === 'step_undeferred'));
}

function testOnlyOneExpeditionCanBeActive() {
  const state = makeState(['start', 'start']);
  state.steps[1].status = 'active';
  const transition = Domain.startStep(state, {
    stepId: 'step-1',
    idempotencyKey: 'single-expedition-1',
    now: NOW,
    idFactory,
  });
  assert.throws(() => Domain.startStep(transition.state, {
    stepId: 'step-2',
    idempotencyKey: 'single-expedition-2',
    now: NOW,
    idFactory,
  }), /EXPEDITION_ALREADY_ACTIVE/);
  assert.equal(activeExpedition(transition.state).id, transition.result.expeditionId);
}

testEntrySegmentsPayOnce();
testPartialProgressAndResumeAnchor();
testReplacementLineageCannotMintStartReward();
testOutcomeRules();
testNotStartedRequiresObstacleRouteBeforeRestart();
testLegacyObstacleRouteWithoutLinkAllowsRestart();
testDeferCanBeUndeferredWithoutReward();
testOnlyOneExpeditionCanBeActive();

console.log(JSON.stringify({ ok: true, checked: 'stepquest-v02-domain' }, null, 2));
