(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StepQuestV02Domain = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const ENTRY_PHASES = new Set(['orient', 'prepare', 'open']);
  const WORK_PHASES = new Set(['start', 'continue', 'close']);
  const OUTCOMES = new Set(['completed', 'partial', 'interrupted', 'not_started']);
  const OBSTACLE_ROUTES = new Set(['manual_shrink', 'defer', 'retry', 'block']);
  const CAMP_MAX_LEVEL = 5;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function domainError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
  }

  function createInitialState() {
    return {
      schemaVersion: 2,
      goals: [],
      steps: [],
      expeditions: [],
      resumeAnchors: [],
      events: [],
      rewards: [],
      wallet: { stepCoin: 0, gold: 0 },
      camp: { level: 0 },
    };
  }

  function assignEntrySegments(steps, idFactory) {
    let entrySegmentId = null;
    return steps.map((step) => {
      if (!ENTRY_PHASES.has(step.phase)) {
        entrySegmentId = null;
        const next = { ...step };
        delete next.entrySegmentId;
        return next;
      }
      if (!entrySegmentId) entrySegmentId = idFactory('entry');
      return { ...step, entrySegmentId };
    });
  }

  function replay(state, idempotencyKey) {
    const event = state.events.find((item) => item.idempotencyKey === idempotencyKey);
    if (!event) return null;
    return {
      state: clone(state),
      result: clone(event.result),
      duplicate: true,
    };
  }

  function grantReward(state, reward) {
    if (state.rewards.some((item) => item.idempotencyKey === reward.idempotencyKey)) return 0;
    state.rewards.push(reward);
    state.wallet[reward.currency] += reward.amount;
    return reward.amount;
  }

  function recordEvent(state, event) {
    state.events.push(event);
    return {
      state,
      result: event.result,
      duplicate: false,
    };
  }

  function rewardLineage(step) {
    return step.rewardLineage || step.id;
  }

  function notStartedReportIsResolved(state, report) {
    const explicitlyRouted = state.events.some((event) => (
      event.type === 'obstacle_routed'
      && event.stepId === report.stepId
      && (
        event.resolvesEventKey === report.idempotencyKey
        || (
          !event.resolvesEventKey
          && String(event.createdAt || '') >= String(report.createdAt || '')
        )
      )
    ));
    if (explicitlyRouted) return true;

    // v0.2 briefly allowed a direct retry before obstacle routing became mandatory.
    // Preserve those histories while preventing new direct retries.
    return state.events.some((event) => (
      event.type === 'step_started'
      && event.stepId === report.stepId
      && event.expeditionId !== report.expeditionId
      && String(event.createdAt || '') >= String(report.createdAt || '')
    ));
  }

  function hasUnresolvedNotStartedReport(state, stepId) {
    return state.events.some((event) => (
      event.type === 'expedition_reported'
      && event.outcome === 'not_started'
      && event.stepId === stepId
      && !notStartedReportIsResolved(state, event)
    ));
  }

  function startStep(source, command) {
    const repeated = replay(source, command.idempotencyKey);
    if (repeated) return repeated;

    const state = clone(source);
    const step = state.steps.find((item) => item.id === command.stepId && item.status === 'active');
    if (!step) throw domainError('STEP_NOT_ACTIVE');
    if (hasUnresolvedNotStartedReport(state, step.id)) {
      throw domainError('OBSTACLE_ROUTE_REQUIRED');
    }
    if (state.expeditions.some((item) => item.status === 'active')) {
      throw domainError('EXPEDITION_ALREADY_ACTIVE');
    }

    const expeditionId = command.idFactory('expedition');
    state.expeditions.push({
      id: expeditionId,
      stepId: step.id,
      status: 'active',
      startedAt: command.now,
      goldCap: 2,
      goldGranted: 0,
    });
    step.status = 'started';
    step.updatedAt = command.now;
    step.rewardLineage = rewardLineage(step);

    const isEntry = ENTRY_PHASES.has(step.phase);
    const stage = isEntry ? 'entry' : 'start';
    const rewardKey = isEntry
      ? `goal:${step.goalId}:entry:${step.entrySegmentId || step.rewardLineage}`
      : `goal:${step.goalId}:lineage:${step.rewardLineage}:start`;
    const stepCoinGranted = grantReward(state, {
      idempotencyKey: rewardKey,
      currency: 'stepCoin',
      amount: isEntry ? 2 : 5,
      sourceGoalId: step.goalId,
      sourceStepId: step.id,
      rewardLineage: step.rewardLineage,
      stage,
      createdAt: command.now,
    });

    return recordEvent(state, {
      idempotencyKey: command.idempotencyKey,
      type: 'step_started',
      stepId: step.id,
      expeditionId,
      createdAt: command.now,
      result: { stepId: step.id, expeditionId, stepCoinGranted },
    });
  }

  function appendResumeAnchor(state, step, anchor, command) {
    const nextPhysicalAction = String(anchor?.nextPhysicalAction || '').trim();
    if (!nextPhysicalAction) throw domainError('NEXT_PHYSICAL_ACTION_REQUIRED');
    const value = {
      id: command.idFactory('anchor'),
      stepId: step.id,
      lastCompletedAction: String(anchor?.lastCompletedAction || '').trim() || undefined,
      nextPhysicalAction,
      location: String(anchor?.location || '').trim() || undefined,
      requiredMaterial: String(anchor?.requiredMaterial || '').trim() || undefined,
      note: String(anchor?.note || '').trim() || undefined,
      createdAt: command.now,
    };
    state.resumeAnchors.push(value);
    return value;
  }

  function reportOutcome(source, command) {
    const repeated = replay(source, command.idempotencyKey);
    if (repeated) return repeated;
    if (!OUTCOMES.has(command.outcome)) throw domainError('OUTCOME_INVALID');

    const state = clone(source);
    const expedition = state.expeditions.find(
      (item) => item.id === command.expeditionId && item.status === 'active',
    );
    if (!expedition) throw domainError('EXPEDITION_NOT_ACTIVE');
    const step = state.steps.find(
      (item) => item.id === expedition.stepId && item.status === 'started',
    );
    if (!step) throw domainError('STEP_NOT_STARTED');
    step.rewardLineage = rewardLineage(step);

    let anchor = null;
    if (command.outcome === 'partial' || command.outcome === 'interrupted') {
      anchor = appendResumeAnchor(state, step, command.anchor, command);
    }

    expedition.status = 'reported';
    expedition.reportedAt = command.now;
    expedition.outcome = command.outcome;

    let stepCoinGranted = 0;
    if (
      (command.outcome === 'partial' || command.outcome === 'completed')
      && WORK_PHASES.has(step.phase)
    ) {
      stepCoinGranted += grantReward(state, {
        idempotencyKey: `goal:${step.goalId}:lineage:${step.rewardLineage}:progress`,
        currency: 'stepCoin',
        amount: 7,
        sourceGoalId: step.goalId,
        sourceStepId: step.id,
        rewardLineage: step.rewardLineage,
        stage: 'progress',
        createdAt: command.now,
      });
    }

    const priorGold = state.rewards
      .filter((item) => (
        item.currency === 'gold'
        && (item.rewardLineage || item.sourceStepId) === step.rewardLineage
      ))
      .reduce((sum, item) => sum + item.amount, 0);
    const requestedGold = command.outcome === 'completed'
      ? Math.max(0, 2 - priorGold)
      : command.outcome === 'partial' && priorGold < 2
        ? 1
        : 0;
    const goldGranted = requestedGold > 0
      ? grantReward(state, {
        idempotencyKey: `goal:${step.goalId}:lineage:${step.rewardLineage}:gold:${priorGold}`,
        currency: 'gold',
        amount: requestedGold,
        sourceGoalId: step.goalId,
        sourceStepId: step.id,
        rewardLineage: step.rewardLineage,
        stage: command.outcome,
        createdAt: command.now,
      })
      : 0;
    expedition.goldGranted = goldGranted;

    if (command.outcome === 'completed') {
      step.status = 'completed';
      const next = state.steps
        .filter((item) => item.goalId === step.goalId && item.status === 'pending')
        .sort((left, right) => left.orderIndex - right.orderIndex)[0];
      if (next) {
        next.status = 'active';
        next.updatedAt = command.now;
      } else {
        const goal = state.goals.find((item) => item.id === step.goalId);
        if (goal) {
          goal.status = 'completed';
          goal.updatedAt = command.now;
        }
        stepCoinGranted += grantReward(state, {
          idempotencyKey: `goal:${step.goalId}:milestone`,
          currency: 'stepCoin',
          amount: 6,
          sourceGoalId: step.goalId,
          sourceStepId: step.id,
          rewardLineage: step.rewardLineage,
          stage: 'milestone',
          createdAt: command.now,
        });
      }
    } else if (command.outcome === 'not_started') {
      step.status = 'active';
    } else {
      step.status = 'interrupted';
    }
    step.updatedAt = command.now;

    return recordEvent(state, {
      idempotencyKey: command.idempotencyKey,
      type: 'expedition_reported',
      stepId: step.id,
      expeditionId: expedition.id,
      outcome: command.outcome,
      createdAt: command.now,
      result: {
        stepId: step.id,
        expeditionId: expedition.id,
        outcome: command.outcome,
        anchorId: anchor?.id || null,
        stepCoinGranted,
        goldGranted,
      },
    });
  }

  function saveResumeAnchor(source, command) {
    const repeated = replay(source, command.idempotencyKey);
    if (repeated) return repeated;
    const state = clone(source);
    const step = state.steps.find((item) => item.id === command.stepId);
    if (!step) throw domainError('STEP_NOT_FOUND');
    const anchor = appendResumeAnchor(state, step, command.anchor, command);
    return recordEvent(state, {
      idempotencyKey: command.idempotencyKey,
      type: 'resume_anchor_saved',
      stepId: step.id,
      createdAt: command.now,
      result: { stepId: step.id, anchorId: anchor.id },
    });
  }

  function resumeStep(source, command) {
    const repeated = replay(source, command.idempotencyKey);
    if (repeated) return repeated;
    const state = clone(source);
    const step = state.steps.find(
      (item) => item.id === command.stepId && item.status === 'interrupted',
    );
    if (!step) throw domainError('STEP_NOT_INTERRUPTED');
    const anchor = state.resumeAnchors
      .filter((item) => item.stepId === step.id && !item.consumedAt)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
    if (!anchor) throw domainError('RESUME_ANCHOR_NOT_FOUND');
    anchor.consumedAt = command.now;
    step.status = 'active';
    step.updatedAt = command.now;
    return recordEvent(state, {
      idempotencyKey: command.idempotencyKey,
      type: 'step_resumed',
      stepId: step.id,
      createdAt: command.now,
      result: { stepId: step.id, anchorId: anchor.id },
    });
  }

  function undeferStep(source, command) {
    const repeated = replay(source, command.idempotencyKey);
    if (repeated) return repeated;
    const state = clone(source);
    const step = state.steps.find(
      (item) => item.id === command.stepId && item.status === 'deferred',
    );
    if (!step) throw domainError('STEP_NOT_DEFERRED');
    if (
      state.steps.some((item) => item.status === 'active' || item.status === 'started')
      || state.expeditions.some((item) => item.status === 'active')
    ) {
      throw domainError('ANOTHER_STEP_ACTIVE');
    }
    step.status = 'active';
    delete step.deferContext;
    step.updatedAt = command.now;
    return recordEvent(state, {
      idempotencyKey: command.idempotencyKey,
      type: 'step_undeferred',
      stepId: step.id,
      createdAt: command.now,
      result: { stepId: step.id },
    });
  }

  function unblockStep(source, command) {
    const repeated = replay(source, command.idempotencyKey);
    if (repeated) return repeated;
    const state = clone(source);
    const step = state.steps.find(
      (item) => item.id === command.stepId
        && (item.status === 'blocked' || item.status === 'waiting'),
    );
    if (!step) throw domainError('STEP_NOT_BLOCKED');
    if (
      state.steps.some((item) => item.status === 'active' || item.status === 'started')
      || state.expeditions.some((item) => item.status === 'active')
    ) {
      throw domainError('ANOTHER_STEP_ACTIVE');
    }
    step.status = 'active';
    delete step.blockContext;
    step.updatedAt = command.now;
    return recordEvent(state, {
      idempotencyKey: command.idempotencyKey,
      type: 'step_unblocked',
      stepId: step.id,
      createdAt: command.now,
      result: { stepId: step.id },
    });
  }

  function routeObstacle(source, command) {
    const repeated = replay(source, command.idempotencyKey);
    if (repeated) return repeated;
    if (!OBSTACLE_ROUTES.has(command.route)) throw domainError('OBSTACLE_ROUTE_INVALID');
    const reason = String(command.reason || '').trim();
    if (!reason) throw domainError('OBSTACLE_REASON_REQUIRED');

    const state = clone(source);
    const step = state.steps.find(
      (item) => item.id === command.stepId && item.status === 'active',
    );
    if (!step) throw domainError('STEP_NOT_ACTIVE');
    if (command.reportIdempotencyKey) {
      const report = state.events.find((event) => (
        event.idempotencyKey === command.reportIdempotencyKey
        && event.type === 'expedition_reported'
        && event.outcome === 'not_started'
        && event.stepId === step.id
      ));
      if (!report) throw domainError('NOT_STARTED_REPORT_NOT_FOUND');
    }
    step.rewardLineage = rewardLineage(step);

    let title = null;
    if (command.route === 'manual_shrink') {
      title = String(command.nextPhysicalAction || '').trim();
      if (!title) throw domainError('NEXT_PHYSICAL_ACTION_REQUIRED');
    }
    let blockKind = null;
    let blockNote = null;
    if (command.route === 'block') {
      blockKind = String(command.blockKind || '').trim();
      if (blockKind !== 'material' && blockKind !== 'person') {
        throw domainError('BLOCK_KIND_INVALID');
      }
      blockNote = String(command.blockNote || '').trim();
      if (!blockNote) throw domainError('BLOCK_NOTE_REQUIRED');
    }

    if (command.route !== 'retry') {
      state.events.push({
        idempotencyKey: `${command.idempotencyKey}:reason`,
        type: 'obstacle_reported',
        stepId: step.id,
        reason,
        createdAt: command.now,
        result: { stepId: step.id, reason },
      });
    }

    let replacementStepId = null;
    if (command.route === 'defer') {
      step.status = 'deferred';
      const deferNote = String(command.deferNote || '').trim();
      if (deferNote) step.deferContext = { note: deferNote, createdAt: command.now };
      else delete step.deferContext;
      step.updatedAt = command.now;
    } else if (command.route === 'block') {
      step.status = blockKind === 'material' ? 'blocked' : 'waiting';
      step.blockContext = { kind: blockKind, note: blockNote, createdAt: command.now };
      step.updatedAt = command.now;
    } else if (command.route === 'manual_shrink') {
      const originalIndex = step.orderIndex;
      state.steps
        .filter(
          (item) => item.goalId === step.goalId
            && item.id !== step.id
            && item.orderIndex > originalIndex,
        )
        .forEach((item) => { item.orderIndex += 1; });
      step.status = 'replaced';
      step.orderIndex = originalIndex + 1;
      step.updatedAt = command.now;
      replacementStepId = command.idFactory('step');
      state.steps.push({
        id: replacementStepId,
        goalId: step.goalId,
        title,
        nextPhysicalAction: title,
        phase: step.phase,
        entrySegmentId: step.entrySegmentId,
        rewardLineage: step.rewardLineage,
        status: 'active',
        orderIndex: originalIndex,
        createdAt: command.now,
        updatedAt: command.now,
      });
    }

    return recordEvent(state, {
      idempotencyKey: command.idempotencyKey,
      type: 'obstacle_routed',
      stepId: step.id,
      reason,
      route: command.route,
      resolvesEventKey: command.reportIdempotencyKey || undefined,
      createdAt: command.now,
      result: {
        stepId: step.id,
        reason,
        route: command.route,
        replacementStepId,
      },
    });
  }

  function upgradeCamp(source, command) {
    const repeated = replay(source, command.idempotencyKey);
    if (repeated) return repeated;
    const state = clone(source);
    const rawLevel = Number(state.camp?.level);
    const level = Number.isFinite(rawLevel)
      ? Math.max(0, Math.min(CAMP_MAX_LEVEL, Math.trunc(rawLevel)))
      : 0;
    if (level >= CAMP_MAX_LEVEL) throw domainError('CAMP_MAX_LEVEL_REACHED');
    const cost = 2 + level;
    if (state.wallet.gold < cost) throw domainError('GOLD_INSUFFICIENT');

    const nextLevel = level + 1;
    state.camp = { level: nextLevel };
    grantReward(state, {
      idempotencyKey: `camp:level:${nextLevel}`,
      currency: 'gold',
      amount: -cost,
      stage: 'camp_upgrade',
      createdAt: command.now,
    });

    return recordEvent(state, {
      idempotencyKey: command.idempotencyKey,
      type: 'camp_upgraded',
      level: nextLevel,
      cost,
      createdAt: command.now,
      result: { level: nextLevel, cost },
    });
  }

  function importGoal(source, command) {
    const repeated = replay(source, command.idempotencyKey);
    if (repeated) return repeated;
    if (!command.made?.weekly || !Array.isArray(command.made.micro)) {
      throw domainError('GOAL_IMPORT_INVALID');
    }
    if (source.expeditions.some((item) => item.status === 'active')) {
      throw domainError('EXPEDITION_ALREADY_ACTIVE');
    }

    const state = clone(source);
    state.goals
      .filter((item) => item.status === 'active')
      .forEach((item) => {
        item.status = 'paused';
        item.updatedAt = command.now;
      });
    state.steps
      .filter((item) => item.status === 'active')
      .forEach((item) => {
        item.status = 'deferred';
        item.updatedAt = command.now;
      });

    const made = command.made;
    const goalId = String(made.weekly.id);
    if (state.goals.some((item) => item.id === goalId)) throw domainError('GOAL_ALREADY_EXISTS');
    const goal = {
      id: goalId,
      title: made.weekly.title,
      type: made.weekly.type || 'project',
      doneDefinition: made.weekly.doneDefinition || undefined,
      status: 'active',
      createdAt: made.weekly.createdAt || command.now,
      updatedAt: command.now,
    };
    const rawSteps = made.micro.map((item, index, all) => {
      const id = String(item.id);
      return {
        id,
        goalId,
        title: item.title,
        nextPhysicalAction: item.nextPhysicalAction || item.title,
        phase: item.phase || (
          index === 0
            ? 'orient'
            : index === 1
              ? 'open'
              : index === all.length - 1
                ? 'close'
                : 'start'
        ),
        rewardLineage: item.rewardLineage || id,
        status: index === 0 ? 'active' : 'pending',
        orderIndex: index,
        createdAt: item.createdAt || command.now,
        updatedAt: command.now,
      };
    });
    const steps = assignEntrySegments(rawSteps, command.idFactory);
    state.goals.push(goal);
    state.steps.push(...steps);
    return recordEvent(state, {
      idempotencyKey: command.idempotencyKey,
      type: 'goal_imported',
      goalId,
      createdAt: command.now,
      result: { goalId, firstStepId: steps[0]?.id || null },
    });
  }

  function exportableState(state) {
    return clone(state);
  }

  return {
    createInitialState,
    assignEntrySegments,
    importGoal,
    startStep,
    reportOutcome,
    saveResumeAnchor,
    resumeStep,
    undeferStep,
    unblockStep,
    routeObstacle,
    upgradeCamp,
    exportableState,
  };
});
