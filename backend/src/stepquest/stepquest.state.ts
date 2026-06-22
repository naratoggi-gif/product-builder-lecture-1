import {
  BurdenLevel,
  EnergyLevel,
  GeneratedStep,
  QuestCategory,
  calculateStepReward,
  decomposeGoal,
  difficultyForSeconds,
  gradeForSeconds,
  shrinkStep,
} from './stepquest.domain';

export type GoalStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';
export type ChainStatus = 'active' | 'superseded' | 'completed';
export type StepStatus = 'pending' | 'active' | 'completed' | 'deferred' | 'skipped' | 'replaced';
export type StepAttemptAction = 'complete' | 'shrink' | 'defer' | 'skip' | 'undo';
export type RewardType = 'xp' | 'facility_xp' | 'return_mark' | 'costume_fragment';
export type CostumeRole = 'starter' | 'focus' | 'return' | 'tidy' | 'writing' | 'wake';
export type FacilityKey = 'knowledge_tower' | 'guild_office' | 'training_ground' | 'workshop' | 'archive' | 'inn' | 'kitchen' | 'garden';

export interface StepQuestUser {
  id: string;
  level: number;
  xp: number;
  material: number;
  returnMarks: number;
  equippedCostumeId: string;
  lastActiveAt: string;
}

export interface GoalState {
  id: string;
  userId: string;
  title: string;
  category: QuestCategory;
  burdenLevel: BurdenLevel;
  status: GoalStatus;
  createdAt: string;
  completedAt?: string;
}

export interface QuestChainState {
  id: string;
  goalId: string;
  revision: number;
  source: 'template' | 'ai' | 'manual' | 'costume';
  status: ChainStatus;
  createdAt: string;
}

export interface MicroStepState extends GeneratedStep {
  id: string;
  chainId: string;
  orderIndex: number;
  status: StepStatus;
  difficulty: number;
  xpReward: number;
  facilityReward: number;
  activatedAt?: string;
  completedAt?: string;
}

export interface StepAttemptState {
  id: string;
  stepId: string;
  action: StepAttemptAction;
  reason?: string;
  createdAt: string;
}

export interface RewardTransactionState {
  id: string;
  sourceType: 'step' | 'return' | 'achievement';
  sourceId: string;
  rewardType: RewardType;
  amount: number;
  idempotencyKey: string;
  createdAt: string;
}

export interface VillageFacilityState {
  facilityKey: FacilityKey;
  level: number;
  xp: number;
  material: number;
}

export interface CostumeDefinition {
  id: string;
  name: string;
  role: CostumeRole;
  passiveMultiplier: number;
  licensedContent: boolean;
}

export interface ReturnSessionState {
  eligible: boolean;
  inactiveHours: number;
  message: string;
  recoveryStep?: MicroStepState;
}

export interface StepQuestState {
  user: StepQuestUser;
  goal: GoalState;
  chain: QuestChainState;
  steps: MicroStepState[];
  attempts: StepAttemptState[];
  rewards: RewardTransactionState[];
  village: VillageFacilityState[];
  sessionCombo: number;
}

export interface CreateStateInput {
  userId: string;
  goalTitle: string;
  category?: QuestCategory | 'auto';
  burdenLevel: BurdenLevel;
  energyLevel: EnergyLevel;
  now: string;
}

export const BASIC_COSTUMES: CostumeDefinition[] = [
  {
    id: 'starter_mage',
    name: '\uCD08\uB3D9 \uB9C8\uBC95\uC0AC',
    role: 'starter',
    passiveMultiplier: 1.2,
    licensedContent: false,
  },
  {
    id: 'focus_archer',
    name: '\uC9D1\uC911 \uC0AC\uC218',
    role: 'focus',
    passiveMultiplier: 1.15,
    licensedContent: false,
  },
  {
    id: 'return_paladin',
    name: '\uADC0\uD658 \uC131\uAE30\uC0AC',
    role: 'return',
    passiveMultiplier: 1.3,
    licensedContent: false,
  },
  {
    id: 'tidy_rogue',
    name: '\uC815\uB3C8 \uB3C4\uC801',
    role: 'tidy',
    passiveMultiplier: 1.2,
    licensedContent: false,
  },
  {
    id: 'blank_scribe',
    name: '\uBC31\uC9C0 \uAE30\uB85D\uC790',
    role: 'writing',
    passiveMultiplier: 1.2,
    licensedContent: false,
  },
  {
    id: 'dawn_knight',
    name: '\uC0C8\uBCBD \uAE30\uC0AC',
    role: 'wake',
    passiveMultiplier: 1.2,
    licensedContent: false,
  },
];

const FACILITY_BY_CATEGORY: Record<QuestCategory, FacilityKey> = {
  study: 'knowledge_tower',
  work: 'guild_office',
  writing: 'archive',
  cleaning: 'workshop',
  exercise: 'training_ground',
  wake: 'inn',
  sleep: 'inn',
  life_admin: 'guild_office',
  relationship: 'garden',
};

export function createStepQuestState(input: CreateStateInput): StepQuestState {
  const decomposed = decomposeGoal({
    goalTitle: input.goalTitle,
    category: input.category,
    burdenLevel: input.burdenLevel,
    energyLevel: input.energyLevel,
  });

  const goalId = 'goal-1';
  const chainId = 'chain-1';
  const steps = decomposed.steps.map((step, index) => {
    const reward = calculateStepReward({ grade: step.grade, sessionCombo: 0 });
    return {
      ...step,
      id: `step-${index + 1}`,
      chainId,
      orderIndex: index,
      status: index === 0 ? 'active' as StepStatus : 'pending' as StepStatus,
      difficulty: difficultyForSeconds(step.estimatedSeconds),
      xpReward: reward.xp,
      facilityReward: reward.facilityXp,
      activatedAt: index === 0 ? input.now : undefined,
    };
  });

  return {
    user: {
      id: input.userId,
      level: 1,
      xp: 0,
      material: 0,
      returnMarks: 0,
      equippedCostumeId: 'starter_mage',
      lastActiveAt: input.now,
    },
    goal: {
      id: goalId,
      userId: input.userId,
      title: decomposed.normalizedGoal,
      category: decomposed.category,
      burdenLevel: input.burdenLevel,
      status: 'active',
      createdAt: input.now,
    },
    chain: {
      id: chainId,
      goalId,
      revision: 1,
      source: 'template',
      status: 'active',
      createdAt: input.now,
    },
    steps,
    attempts: [],
    rewards: [],
    village: initialVillage(),
    sessionCombo: 0,
  };
}

export function completeActiveStep(state: StepQuestState, now: string, idempotencyKey: string): StepQuestState {
  if (state.rewards.some((reward) => reward.idempotencyKey === idempotencyKey)) return clone(state);

  const next = clone(state);
  const active = next.steps.find((step) => step.status === 'active');
  if (!active) return next;

  active.status = 'completed';
  active.completedAt = now;
  next.attempts.push({
    id: `attempt-${next.attempts.length + 1}`,
    stepId: active.id,
    action: 'complete',
    createdAt: now,
  });

  next.sessionCombo += 1;
  const isReturnStep = active.clientId === 'return-step-1';
  const costumeMultiplier = costumeMultiplierFor(next.user.equippedCostumeId, next.goal.category, false);
  const reward = calculateStepReward({
    grade: gradeForSeconds(active.estimatedSeconds),
    sessionCombo: next.sessionCombo,
    costumeMultiplier,
    isFirstReturnStep: isReturnStep,
  });
  grantReward(next, 'step', active.id, 'xp', reward.xp, idempotencyKey, now);
  grantReward(next, 'step', active.id, 'facility_xp', reward.facilityXp, `${idempotencyKey}:facility`, now);
  growVillage(next, next.goal.category, reward.facilityXp);

  const following = next.steps.find((step) => step.status === 'pending');
  if (following) {
    following.status = 'active';
    following.activatedAt = now;
  } else {
    next.chain.status = 'completed';
    next.goal.status = 'completed';
    next.goal.completedAt = now;
  }
  next.user.lastActiveAt = now;
  next.user.level = Math.floor(next.user.xp / 10) + 1;

  return next;
}

export function undoLastCompletion(state: StepQuestState, now: string): StepQuestState {
  const next = clone(state);
  const completed = next.steps
    .filter((step) => step.status === 'completed')
    .sort((a, b) => b.orderIndex - a.orderIndex)[0];
  if (!completed) return next;

  const laterProgress = next.steps.some((step) =>
    step.orderIndex > completed.orderIndex
      && ['completed', 'skipped', 'replaced'].includes(step.status),
  );
  if (laterProgress) return next;

  const active = next.steps.find((step) => step.status === 'active' && step.orderIndex > completed.orderIndex);
  if (active) {
    active.status = 'pending';
    delete active.activatedAt;
  }
  completed.status = 'active';
  completed.activatedAt = now;
  delete completed.completedAt;

  const rewards = next.rewards.filter((reward) => reward.sourceType === 'step' && reward.sourceId === completed.id);
  const xp = rewards.filter((reward) => reward.rewardType === 'xp').reduce((sum, reward) => sum + reward.amount, 0);
  const facilityXp = rewards.filter((reward) => reward.rewardType === 'facility_xp').reduce((sum, reward) => sum + reward.amount, 0);
  next.rewards = next.rewards.filter((reward) => !(reward.sourceType === 'step' && reward.sourceId === completed.id));
  next.user.xp = Math.max(0, next.user.xp - xp);
  next.user.material = Math.max(0, next.user.material - facilityXp);
  next.user.level = Math.floor(next.user.xp / 10) + 1;
  next.sessionCombo = Math.max(0, next.sessionCombo - 1);
  shrinkVillage(next, next.goal.category, facilityXp);

  next.chain.status = 'active';
  next.goal.status = 'active';
  delete next.goal.completedAt;
  next.attempts.push({
    id: `attempt-${next.attempts.length + 1}`,
    stepId: completed.id,
    action: 'undo',
    createdAt: now,
  });
  next.user.lastActiveAt = now;
  return next;
}

export function shrinkActiveStep(state: StepQuestState, now: string, reason: string): StepQuestState {
  const next = clone(state);
  const active = next.steps.find((step) => step.status === 'active');
  if (!active) return next;

  active.status = 'replaced';
  next.chain.revision += 1;
  next.attempts.push({
    id: `attempt-${next.attempts.length + 1}`,
    stepId: active.id,
    action: 'shrink',
    reason,
    createdAt: now,
  });

  const replacements = shrinkStep(active.title, active.estimatedSeconds).map((step, index) => {
    const reward = calculateStepReward({ grade: step.grade, sessionCombo: next.sessionCombo });
    return {
      ...step,
      id: `step-${next.steps.length + index + 1}`,
      chainId: next.chain.id,
      orderIndex: active.orderIndex + index + 1,
      status: index === 0 ? 'active' as StepStatus : 'pending' as StepStatus,
      difficulty: difficultyForSeconds(step.estimatedSeconds),
      xpReward: reward.xp,
      facilityReward: reward.facilityXp,
      activatedAt: index === 0 ? now : undefined,
    };
  });

  const insertAt = next.steps.findIndex((step) => step.id === active.id) + 1;
  next.steps.splice(insertAt, 0, ...replacements);
  next.steps.forEach((step, index) => {
    step.orderIndex = index;
  });
  next.user.lastActiveAt = now;
  return next;
}

export function skipActiveStep(state: StepQuestState, now: string): StepQuestState {
  const next = clone(state);
  const active = next.steps.find((step) => step.status === 'active');
  if (!active) return next;

  active.status = 'skipped';
  next.attempts.push({
    id: `attempt-${next.attempts.length + 1}`,
    stepId: active.id,
    action: 'skip',
    createdAt: now,
  });

  const following = next.steps.find((step) => step.status === 'pending');
  if (following) {
    following.status = 'active';
    following.activatedAt = now;
  }
  next.user.lastActiveAt = now;
  return next;
}

export function deferActiveStep(state: StepQuestState, now: string, reason = 'not_now'): StepQuestState {
  const next = clone(state);
  const active = next.steps.find((step) => step.status === 'active');
  if (!active) return next;

  active.status = 'deferred';
  delete active.activatedAt;
  next.attempts.push({
    id: `attempt-${next.attempts.length + 1}`,
    stepId: active.id,
    action: 'defer',
    reason,
    createdAt: now,
  });
  next.user.lastActiveAt = now;
  return next;
}

export function resumeDeferredStep(state: StepQuestState, now: string): StepQuestState {
  const next = clone(state);
  const deferred = next.steps.find((step) => step.status === 'deferred');
  if (!deferred) return next;

  const active = next.steps.find((step) => step.status === 'active');
  if (active) {
    active.status = 'pending';
    delete active.activatedAt;
  }
  deferred.status = 'active';
  deferred.activatedAt = now;
  next.user.lastActiveAt = now;
  return next;
}

export function getReturnEligibility(state: StepQuestState, now: string): ReturnSessionState {
  const inactiveHours = Math.max(0, (Date.parse(now) - Date.parse(state.user.lastActiveAt)) / 36e5);
  const eligible = inactiveHours >= 24;
  return {
    eligible,
    inactiveHours,
    message: eligible
      ? '\uB3CC\uC544\uC654\uB2E4. \uAE30\uB85D\uC740 \uB0A8\uC544 \uC788\uB2E4.'
      : '\uC9C0\uAE08 \uD560 \uC77C\uC740 \uD558\uB098\uB2E4.',
  };
}

export function startReturnSession(state: StepQuestState, now: string): StepQuestState {
  const eligibility = getReturnEligibility(state, now);
  if (!eligibility.eligible) return clone(state);

  const next = clone(state);
  const currentActive = next.steps.find((step) => step.status === 'active' || step.status === 'deferred');
  if (currentActive) currentActive.status = 'deferred';

  const returnStep: MicroStepState = {
    clientId: 'return-step-1',
    id: `step-${next.steps.length + 1}`,
    chainId: next.chain.id,
    orderIndex: 0,
    title: '\uC9C0\uB09C \uBAA9\uD45C \uC81C\uBAA9 \uD55C \uBC88 \uBCF4\uAE30',
    successCriterion: '\uC81C\uBAA9 \uD655\uC778 \uC644\uB8CC',
    estimatedSeconds: 5,
    phase: 'orient',
    grade: 'F',
    status: 'active',
    difficulty: 1,
    xpReward: 1,
    facilityReward: 1,
    activatedAt: now,
  };

  next.steps.unshift(returnStep);
  next.steps.forEach((step, index) => {
    step.orderIndex = index;
  });
  next.user.lastActiveAt = now;
  grantReward(next, 'return', returnStep.id, 'return_mark', 1, `return:${now}`, now);
  return next;
}

export function activateStarterCostume(state: StepQuestState, now: string): StepQuestState {
  if (state.user.equippedCostumeId !== 'starter_mage') return clone(state);
  const next = shrinkActiveStep(state, now, 'costume_active');
  next.chain.source = 'costume';
  return next;
}

function grantReward(
  state: StepQuestState,
  sourceType: RewardTransactionState['sourceType'],
  sourceId: string,
  rewardType: RewardType,
  amount: number,
  idempotencyKey: string,
  createdAt: string,
): void {
  if (state.rewards.some((reward) => reward.idempotencyKey === idempotencyKey)) return;
  state.rewards.push({
    id: `reward-${state.rewards.length + 1}`,
    sourceType,
    sourceId,
    rewardType,
    amount,
    idempotencyKey,
    createdAt,
  });
  if (rewardType === 'xp') state.user.xp += amount;
  if (rewardType === 'facility_xp') state.user.material += amount;
  if (rewardType === 'return_mark') state.user.returnMarks += amount;
}

function growVillage(state: StepQuestState, category: QuestCategory, facilityXp: number): void {
  const facility = state.village.find((item) => item.facilityKey === FACILITY_BY_CATEGORY[category]);
  if (!facility) return;
  facility.xp += facilityXp;
  facility.material += 1;
  facility.level = Math.floor(facility.xp / 5) + 1;
}

function shrinkVillage(state: StepQuestState, category: QuestCategory, facilityXp: number): void {
  const facility = state.village.find((item) => item.facilityKey === FACILITY_BY_CATEGORY[category]);
  if (!facility) return;
  facility.xp = Math.max(0, facility.xp - facilityXp);
  facility.material = Math.max(0, facility.material - 1);
  facility.level = Math.floor(facility.xp / 5) + 1;
}

function costumeMultiplierFor(costumeId: string, category: QuestCategory, isReturnStep: boolean): number {
  if (costumeId === 'starter_mage') return 1.2;
  if (costumeId === 'focus_archer' && category === 'study') return 1.15;
  if (costumeId === 'return_paladin' && isReturnStep) return 1.3;
  if (costumeId === 'tidy_rogue' && category === 'cleaning') return 1.2;
  if (costumeId === 'blank_scribe' && category === 'writing') return 1.2;
  if (costumeId === 'dawn_knight' && category === 'wake') return 1.2;
  return 1;
}

function initialVillage(): VillageFacilityState[] {
  return [
    { facilityKey: 'knowledge_tower', level: 1, xp: 0, material: 0 },
    { facilityKey: 'guild_office', level: 1, xp: 0, material: 0 },
    { facilityKey: 'training_ground', level: 1, xp: 0, material: 0 },
    { facilityKey: 'workshop', level: 1, xp: 0, material: 0 },
    { facilityKey: 'archive', level: 1, xp: 0, material: 0 },
    { facilityKey: 'inn', level: 1, xp: 0, material: 0 },
    { facilityKey: 'kitchen', level: 1, xp: 0, material: 0 },
    { facilityKey: 'garden', level: 1, xp: 0, material: 0 },
  ];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
