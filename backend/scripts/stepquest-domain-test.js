#!/usr/bin/env node
const assert = require('node:assert/strict');
const {
  calculateStepReward,
  decomposeGoal,
  firstStepCapSeconds,
  gradeForSeconds,
  resolveQuestCategory,
  shrinkStep,
} = require('../dist/stepquest/stepquest.domain');
const {
  FallbackGoalDecomposer,
  MockAiGoalDecomposer,
  TemplateGoalDecomposer,
  validateAiOutput,
} = require('../dist/stepquest/stepquest.decomposer');

const STUDY_GOAL = '토익 공부하기';
const WRITING_GOAL = '오늘 1000자 쓰기';
const TODAY_ENTRANCE = '오늘은 입구만 연다.';
const SEE_DESK = '책상이 있는 방향 보기';
const PUT_BOOK_ON_DESK = '책을 책상 위에 놓기';
const SEE_BOOK_LOCATION = '책이 있는 위치 보기';
const NAME_NEEDED_ITEM = '필요한 것 하나 이름 적기';
const BROKEN_TEXT = /[?]{2,}|\uFFFD|[\u3400-\u9FFF\uF900-\uFAFF]/u;

function assertReadableKorean(output) {
  assert.ok(!BROKEN_TEXT.test(output.normalizedGoal));
  assert.ok(!BROKEN_TEXT.test(output.chainTitle));
  assert.ok(!BROKEN_TEXT.test(output.message));
  for (const step of output.steps) {
    assert.ok(!BROKEN_TEXT.test(step.title), `broken title: ${step.title}`);
    assert.ok(!BROKEN_TEXT.test(step.successCriterion), `broken success criterion: ${step.successCriterion}`);
  }
}

function run() {
  assert.equal(resolveQuestCategory(STUDY_GOAL, 'auto'), 'study');
  assert.equal(resolveQuestCategory(WRITING_GOAL, 'auto'), 'writing');
  assert.equal(firstStepCapSeconds(4, 'high'), 10);
  assert.equal(firstStepCapSeconds(2, 'low'), 10);
  assert.equal(firstStepCapSeconds(2, 'medium'), 30);
  assert.equal(gradeForSeconds(5), 'F');
  assert.equal(gradeForSeconds(180), 'C');

  const output = decomposeGoal({
    goalTitle: STUDY_GOAL,
    category: 'auto',
    burdenLevel: 4,
    energyLevel: 'low',
  });

  assert.equal(output.category, 'study');
  assert.equal(output.message, TODAY_ENTRANCE);
  assert.equal(output.source, 'template');
  assert.ok(output.steps.length >= 4 && output.steps.length <= 8);
  assert.ok(output.steps[0].estimatedSeconds <= 10);
  assert.equal(output.steps[0].title, SEE_DESK);
  assertReadableKorean(output);
  assert.ok(output.steps.every((step) => !/(이해|집중|완벽|제대로|열심히)/.test(step.title)));

  const personalized = decomposeGoal({
    goalTitle: STUDY_GOAL,
    category: 'auto',
    burdenLevel: 2,
    energyLevel: 'high',
    location: '책상',
    availableMinutes: 3,
    obstacle: 'no_material',
  });
  assert.equal(personalized.steps[0].title, '책상 방향 보기');
  assert.ok(personalized.steps.some((step) => step.title === NAME_NEEDED_ITEM));
  assert.ok(personalized.steps[0].estimatedSeconds <= 5);
  assertReadableKorean(personalized);

  const replacements = shrinkStep(PUT_BOOK_ON_DESK, 15);
  assert.ok(replacements.length >= 2 && replacements.length <= 5);
  assert.equal(replacements[0].title, SEE_BOOK_LOCATION);
  assert.ok(replacements.every((step) => step.estimatedSeconds <= 10 || step.title === PUT_BOOK_ON_DESK));
  assert.ok(replacements.every((step) => !BROKEN_TEXT.test(step.title)));

  const reward = calculateStepReward({
    grade: 'F',
    sessionCombo: 5,
    costumeMultiplier: 2,
    isFirstReturnStep: true,
  });
  assert.equal(reward.xp, 2);
  assert.equal(reward.facilityXp, 1);

  const validAi = validateAiOutput({
    goalTitle: WRITING_GOAL,
    category: 'auto',
    burdenLevel: 4,
    energyLevel: 'low',
  }, {
    normalizedGoal: WRITING_GOAL,
    category: 'writing',
    chainTitle: `${WRITING_GOAL} 입구 열기`,
    steps: [
      { title: '문서 이름 보기', successCriterion: '문서 이름 확인 완료', estimatedSeconds: 5, phase: 'orient' },
      { title: '문서 열기', successCriterion: '문서 열기 완료', estimatedSeconds: 10, phase: 'open' },
      { title: '커서를 본문 첫 줄에 놓기', successCriterion: '커서 위치 확인 완료', estimatedSeconds: 10, phase: 'prepare' },
      { title: '단어 하나 쓰기', successCriterion: '단어 하나 입력 완료', estimatedSeconds: 15, phase: 'start' },
    ],
  });
  assert.equal(validAi.source, 'ai');
  assert.equal(validAi.steps[0].estimatedSeconds, 5);
  assertReadableKorean(validAi);

  assert.throws(() => validateAiOutput({
    goalTitle: STUDY_GOAL,
    category: 'study',
    burdenLevel: 4,
    energyLevel: 'low',
  }, {
    normalizedGoal: STUDY_GOAL,
    category: 'study',
    chainTitle: `${STUDY_GOAL} 입구 열기`,
    steps: [
      { title: '완벽하게 집중해서 공부하기', successCriterion: '완료', estimatedSeconds: 60, phase: 'start' },
      { title: '책 보기', successCriterion: '완료', estimatedSeconds: 5, phase: 'orient' },
      { title: '문장 읽기', successCriterion: '완료', estimatedSeconds: 10, phase: 'start' },
      { title: '메모 적기', successCriterion: '완료', estimatedSeconds: 10, phase: 'close' },
    ],
  }));

  assert.throws(() => validateAiOutput({
    goalTitle: STUDY_GOAL,
    category: 'study',
    burdenLevel: 4,
    energyLevel: 'low',
  }, {
    normalizedGoal: STUDY_GOAL,
    category: 'study',
    chainTitle: `${STUDY_GOAL} 입구 열기`,
    steps: [
      { title: '\uF9DE\uBB35\uC3E8\uC3F7', successCriterion: '완료', estimatedSeconds: 5, phase: 'orient' },
      { title: '책 보기', successCriterion: '완료', estimatedSeconds: 5, phase: 'orient' },
      { title: '문장 읽기', successCriterion: '완료', estimatedSeconds: 10, phase: 'start' },
      { title: '메모 적기', successCriterion: '완료', estimatedSeconds: 10, phase: 'close' },
    ],
  }));

  class BrokenAi {
    async generate() {
      return {
        normalizedGoal: STUDY_GOAL,
        category: 'study',
        chainTitle: `${STUDY_GOAL} 입구 열기`,
        steps: [
          { title: '집중하기', successCriterion: '완료', estimatedSeconds: 60, phase: 'start' },
        ],
      };
    }
  }

  return new FallbackGoalDecomposer(new BrokenAi(), new TemplateGoalDecomposer(), { enabled: true, timeoutMs: 100 })
    .decompose({
      goalTitle: STUDY_GOAL,
      category: 'auto',
      burdenLevel: 4,
      energyLevel: 'low',
    })
    .then(async (fallback) => {
      assert.equal(fallback.source, 'template');
      assert.ok(fallback.fallbackReason);
      assertReadableKorean(fallback);

      const mockAi = await new FallbackGoalDecomposer(new MockAiGoalDecomposer(), new TemplateGoalDecomposer(), { enabled: true, timeoutMs: 100 })
        .decompose({
          goalTitle: WRITING_GOAL,
          category: 'auto',
          burdenLevel: 4,
          energyLevel: 'low',
        });
      assert.equal(mockAi.source, 'ai');
      assert.ok(mockAi.steps[0].estimatedSeconds <= 10);
      assertReadableKorean(mockAi);

      console.log(JSON.stringify({ ok: true, checked: 'stepquest-domain' }, null, 2));
    });
}

Promise.resolve(run()).catch((error) => {
  console.error(error);
  process.exit(1);
});
