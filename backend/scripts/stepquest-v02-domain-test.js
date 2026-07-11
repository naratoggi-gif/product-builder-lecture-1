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

function testReplacementLineageCannotMintExtraGold() {
  let transition = Domain.startStep(makeState(['start']), {
    stepId: 'step-1',
    idempotencyKey: 'gold-lineage-start-original',
    now: NOW,
    idFactory,
  });
  transition = Domain.reportOutcome(transition.state, {
    expeditionId: transition.result.expeditionId,
    outcome: 'partial',
    anchor: { nextPhysicalAction: 'smaller action' },
    idempotencyKey: 'gold-lineage-partial-original',
    now: NOW,
    idFactory,
  });
  assert.equal(transition.state.wallet.gold, 1);

  transition = Domain.resumeStep(transition.state, {
    stepId: 'step-1',
    idempotencyKey: 'gold-lineage-resume-original',
    now: NOW,
  });
  transition = Domain.startStep(transition.state, {
    stepId: 'step-1',
    idempotencyKey: 'gold-lineage-restart-original',
    now: NOW,
    idFactory,
  });
  transition = Domain.reportOutcome(transition.state, {
    expeditionId: transition.result.expeditionId,
    outcome: 'not_started',
    idempotencyKey: 'gold-lineage-not-started-original',
    now: NOW,
    idFactory,
  });

  transition = Domain.routeObstacle(transition.state, {
    stepId: 'step-1',
    reason: 'too_big',
    route: 'manual_shrink',
    nextPhysicalAction: 'smaller replacement',
    reportIdempotencyKey: 'gold-lineage-not-started-original',
    idempotencyKey: 'gold-lineage-shrink',
    now: NOW,
    idFactory,
  });
  let replacement = activeStep(transition.state);
  transition = Domain.startStep(transition.state, {
    stepId: replacement.id,
    idempotencyKey: 'gold-lineage-start-replacement',
    now: NOW,
    idFactory,
  });
  transition = Domain.reportOutcome(transition.state, {
    expeditionId: transition.result.expeditionId,
    outcome: 'not_started',
    idempotencyKey: 'gold-lineage-not-started-replacement',
    now: NOW,
    idFactory,
  });
  transition = Domain.routeObstacle(transition.state, {
    stepId: replacement.id,
    reason: 'too_big',
    route: 'manual_shrink',
    nextPhysicalAction: 'smallest replacement',
    reportIdempotencyKey: 'gold-lineage-not-started-replacement',
    idempotencyKey: 'gold-lineage-shrink-again',
    now: NOW,
    idFactory,
  });
  replacement = activeStep(transition.state);
  transition = Domain.startStep(transition.state, {
    stepId: replacement.id,
    idempotencyKey: 'gold-lineage-start-final-replacement',
    now: NOW,
    idFactory,
  });
  transition = Domain.reportOutcome(transition.state, {
    expeditionId: transition.result.expeditionId,
    outcome: 'completed',
    idempotencyKey: 'gold-lineage-complete-final-replacement',
    now: NOW,
    idFactory,
  });

  const goldRows = transition.state.rewards.filter((item) => item.currency === 'gold');
  assert.equal(transition.state.wallet.gold, 2, 'replacement completion fills only the lineage remainder');
  assert.deepEqual(goldRows.map((item) => item.amount), [1, 1]);
  assert.equal(
    goldRows[1].idempotencyKey,
    'goal:goal-1:lineage:step-1:gold:1',
  );
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

function testRetryRouteResolvesMisTapWithoutRewards() {
  let transition = Domain.startStep(makeState(['start']), {
    stepId: 'step-1',
    idempotencyKey: 'retry-start-1',
    now: NOW,
    idFactory,
  });
  transition = Domain.reportOutcome(transition.state, {
    expeditionId: transition.result.expeditionId,
    outcome: 'not_started',
    idempotencyKey: 'retry-report-1',
    now: NOW,
    idFactory,
  });
  const walletBeforeRetry = { ...transition.state.wallet };

  transition = Domain.routeObstacle(transition.state, {
    stepId: 'step-1',
    reason: 'mis_tap',
    route: 'retry',
    reportIdempotencyKey: 'retry-report-1',
    idempotencyKey: 'retry-route-1',
    now: NOW,
    idFactory,
  });
  assert.deepEqual(transition.state.wallet, walletBeforeRetry);
  assert.equal(transition.state.steps[0].status, 'active');
  assert.equal(
    transition.state.events.filter((event) => event.type === 'obstacle_reported').length,
    0,
  );
  assert.equal(
    transition.state.events.find((event) => event.idempotencyKey === 'retry-route-1').resolvesEventKey,
    'retry-report-1',
  );

  const replay = Domain.routeObstacle(transition.state, {
    stepId: 'step-1',
    reason: 'mis_tap',
    route: 'retry',
    reportIdempotencyKey: 'retry-report-1',
    idempotencyKey: 'retry-route-1',
    now: NOW,
    idFactory,
  });
  assert.equal(replay.duplicate, true);
  assert.deepEqual(replay.state.wallet, walletBeforeRetry);

  transition = Domain.startStep(transition.state, {
    stepId: 'step-1',
    idempotencyKey: 'retry-start-2',
    now: NOW,
    idFactory,
  });
  assert.deepEqual(transition.state.wallet, walletBeforeRetry);
  transition = Domain.reportOutcome(transition.state, {
    expeditionId: transition.result.expeditionId,
    outcome: 'not_started',
    idempotencyKey: 'retry-report-2',
    now: NOW,
    idFactory,
  });
  transition = Domain.routeObstacle(transition.state, {
    stepId: 'step-1',
    reason: 'mis_tap',
    route: 'retry',
    reportIdempotencyKey: 'retry-report-2',
    idempotencyKey: 'retry-route-2',
    now: NOW,
    idFactory,
  });
  assert.doesNotThrow(() => Domain.startStep(transition.state, {
    stepId: 'step-1',
    idempotencyKey: 'retry-start-3',
    now: NOW,
    idFactory,
  }));
  assert.deepEqual(transition.state.wallet, walletBeforeRetry);
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

function testBlockedStepCanBeUnblockedWithoutReward() {
  let transition = Domain.routeObstacle(makeState(['start']), {
    stepId: 'step-1',
    reason: 'no_material',
    route: 'block',
    blockKind: 'material',
    blockNote: 'USB cable',
    idempotencyKey: 'block-material',
    now: NOW,
    idFactory,
  });
  assert.equal(transition.state.steps[0].status, 'blocked');
  assert.deepEqual(transition.state.steps[0].blockContext, {
    kind: 'material',
    note: 'USB cable',
    createdAt: NOW,
  });
  assert.deepEqual(transition.state.wallet, { stepCoin: 0, gold: 0 });

  const replay = Domain.routeObstacle(transition.state, {
    stepId: 'step-1',
    reason: 'no_material',
    route: 'block',
    blockKind: 'material',
    blockNote: 'USB cable',
    idempotencyKey: 'block-material',
    now: NOW,
    idFactory,
  });
  assert.equal(replay.duplicate, true);

  transition = Domain.unblockStep(transition.state, {
    stepId: 'step-1',
    idempotencyKey: 'unblock-material',
    now: NOW,
  });
  assert.equal(transition.state.steps[0].status, 'active');
  assert.equal(transition.state.steps[0].blockContext, undefined);
  assert.deepEqual(transition.state.wallet, { stepCoin: 0, gold: 0 });
  assert.ok(transition.state.events.some((event) => event.type === 'step_unblocked'));
  const unblockReplay = Domain.unblockStep(transition.state, {
    stepId: 'step-1',
    idempotencyKey: 'unblock-material',
    now: NOW,
  });
  assert.equal(unblockReplay.duplicate, true);
}

function testWaitingStepLifecycleAndBlockValidation() {
  let transition = Domain.routeObstacle(makeState(['start']), {
    stepId: 'step-1',
    reason: 'waiting_person',
    route: 'block',
    blockKind: 'person',
    blockNote: 'designer approval',
    idempotencyKey: 'block-person',
    now: NOW,
    idFactory,
  });
  assert.equal(transition.state.steps[0].status, 'waiting');
  assert.equal(transition.state.steps[0].blockContext.note, 'designer approval');
  const unblocked = Domain.unblockStep(transition.state, {
    stepId: 'step-1',
    idempotencyKey: 'unblock-person',
    now: NOW,
  });
  assert.equal(unblocked.state.steps[0].status, 'active');
  assert.equal(Domain.unblockStep(unblocked.state, {
    stepId: 'step-1',
    idempotencyKey: 'unblock-person',
    now: NOW,
  }).duplicate, true);

  assert.throws(() => Domain.routeObstacle(makeState(['start']), {
    stepId: 'step-1',
    reason: 'no_material',
    route: 'block',
    blockKind: 'material',
    blockNote: '  ',
    idempotencyKey: 'block-empty-note',
    now: NOW,
    idFactory,
  }), /BLOCK_NOTE_REQUIRED/);

  const stateWithAnotherActive = transition.state;
  stateWithAnotherActive.steps.push({
    ...stateWithAnotherActive.steps[0],
    id: 'step-2',
    status: 'active',
  });
  assert.throws(() => Domain.unblockStep(stateWithAnotherActive, {
    stepId: 'step-1',
    idempotencyKey: 'unblock-with-active',
    now: NOW,
  }), /ANOTHER_STEP_ACTIVE/);
}

function testBlockRouteResolvesPendingReport() {
  let transition = Domain.startStep(makeState(['start']), {
    stepId: 'step-1',
    idempotencyKey: 'block-resolution-start',
    now: NOW,
    idFactory,
  });
  transition = Domain.reportOutcome(transition.state, {
    expeditionId: transition.result.expeditionId,
    outcome: 'not_started',
    idempotencyKey: 'block-resolution-report',
    now: NOW,
    idFactory,
  });
  transition = Domain.routeObstacle(transition.state, {
    stepId: 'step-1',
    reason: 'no_material',
    route: 'block',
    blockKind: 'material',
    blockNote: 'cable',
    reportIdempotencyKey: 'block-resolution-report',
    idempotencyKey: 'block-resolution-route',
    now: NOW,
    idFactory,
  });
  transition = Domain.unblockStep(transition.state, {
    stepId: 'step-1',
    idempotencyKey: 'block-resolution-unblock',
    now: NOW,
  });
  const restarted = Domain.startStep(transition.state, {
    stepId: 'step-1',
    idempotencyKey: 'block-resolution-restart',
    now: NOW,
    idFactory,
  });
  assert.equal(restarted.state.steps[0].status, 'started');
  assert.deepEqual(restarted.state.wallet, { stepCoin: 5, gold: 0 });
}

function testDeferContextIsClearedOnUndefer() {
  let transition = Domain.routeObstacle(makeState(['start']), {
    stepId: 'step-1',
    reason: 'wrong_place',
    route: 'defer',
    deferNote: 'library',
    idempotencyKey: 'defer-with-context',
    now: NOW,
    idFactory,
  });
  assert.deepEqual(transition.state.steps[0].deferContext, {
    note: 'library',
    createdAt: NOW,
  });
  transition = Domain.undeferStep(transition.state, {
    stepId: 'step-1',
    idempotencyKey: 'undefer-with-context',
    now: NOW,
  });
  assert.equal(transition.state.steps[0].deferContext, undefined);
}

function testObstacleRouteMatrixDoesNotChangeWallet() {
  const cases = [
    ['too_big', 'manual_shrink', 'replaced', { nextPhysicalAction: 'smaller' }],
    ['unclear', 'manual_shrink', 'replaced', { nextPhysicalAction: 'first signal' }],
    ['anxious', 'manual_shrink', 'replaced', { nextPhysicalAction: 'preview' }],
    ['tired', 'manual_shrink', 'replaced', { nextPhysicalAction: 'lighter' }],
    ['tired', 'defer', 'deferred', {}],
    ['no_material', 'block', 'blocked', { blockKind: 'material', blockNote: 'cable' }],
    ['waiting_person', 'block', 'waiting', { blockKind: 'person', blockNote: 'reply' }],
    ['wrong_place', 'defer', 'deferred', { deferNote: 'library' }],
    ['not_now', 'defer', 'deferred', {}],
    ['mis_tap', 'retry', 'active', {}],
  ];

  cases.forEach(([reason, route, expectedStatus, extra], index) => {
    const transition = Domain.routeObstacle(makeState(['start']), {
      stepId: 'step-1',
      reason,
      route,
      ...extra,
      idempotencyKey: `route-matrix-${index}`,
      now: NOW,
      idFactory,
    });
    assert.equal(transition.state.steps[0].status, expectedStatus, `${reason} status`);
    assert.deepEqual(transition.state.wallet, { stepCoin: 0, gold: 0 }, `${reason} wallet`);
  });
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
testReplacementLineageCannotMintExtraGold();
testOutcomeRules();
testNotStartedRequiresObstacleRouteBeforeRestart();
testRetryRouteResolvesMisTapWithoutRewards();
testLegacyObstacleRouteWithoutLinkAllowsRestart();
testDeferCanBeUndeferredWithoutReward();
testBlockedStepCanBeUnblockedWithoutReward();
testWaitingStepLifecycleAndBlockValidation();
testBlockRouteResolvesPendingReport();
testDeferContextIsClearedOnUndefer();
testObstacleRouteMatrixDoesNotChangeWallet();
testOnlyOneExpeditionCanBeActive();

console.log(JSON.stringify({ ok: true, checked: 'stepquest-v02-domain' }, null, 2));
