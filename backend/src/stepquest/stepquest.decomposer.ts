import {
  DecomposeGoalInput,
  DecomposeGoalOutput,
  EnergyLevel,
  QuestCategory,
  StepPhase,
  decomposeGoal,
  firstStepCapSeconds,
  gradeForSeconds,
  resolveQuestCategory,
} from './stepquest.domain';

export interface GoalDecomposer {
  decompose(input: DecomposeGoalInput): Promise<DecomposeGoalOutput>;
}

type RawAiStep = {
  title?: unknown;
  successCriterion?: unknown;
  estimatedSeconds?: unknown;
  phase?: unknown;
};

type RawAiOutput = {
  normalizedGoal?: unknown;
  category?: unknown;
  chainTitle?: unknown;
  steps?: unknown;
  explanation?: unknown;
};

const PHASES = new Set<StepPhase>(['orient', 'prepare', 'open', 'start', 'continue', 'close']);
const CATEGORIES = new Set<QuestCategory>([
  'study',
  'work',
  'writing',
  'cleaning',
  'exercise',
  'wake',
  'sleep',
  'life_admin',
  'relationship',
]);
const BANNED_QUALITY_WORDS = /(이해|집중|완벽|제대로|열심히|꼼꼼하게|차분하게|편하게|멋지게|잘하기)/;
const BAD_TEXT = /[?]{2,}|\uFFFD|[\u3400-\u9FFF\uF900-\uFAFF]/u;

export class TemplateGoalDecomposer implements GoalDecomposer {
  async decompose(input: DecomposeGoalInput): Promise<DecomposeGoalOutput> {
    return decomposeGoal(input);
  }
}

export class MockAiGoalDecomposer {
  async generate(input: DecomposeGoalInput): Promise<RawAiOutput> {
    const category = resolveQuestCategory(input.goalTitle, input.category);
    const template = decomposeGoal(input);
    if (category === 'writing') {
      return {
        normalizedGoal: input.goalTitle.trim(),
        category,
        chainTitle: `${input.goalTitle.trim()} 입구 열기`,
        explanation: '글쓰기 목표는 빈 화면을 여는 행동부터 한 단어를 남기는 행동까지 작게 줄였습니다.',
        steps: [
          { title: '작성할 문서 이름 보기', successCriterion: '문서 이름 확인 완료', estimatedSeconds: 5, phase: 'orient' },
          { title: '문서 열기', successCriterion: '문서가 열린 상태', estimatedSeconds: 10, phase: 'open' },
          { title: '커서를 본문 첫 줄에 놓기', successCriterion: '본문 첫 줄에 커서가 있음', estimatedSeconds: 10, phase: 'prepare' },
          { title: '단어 하나 쓰기', successCriterion: '단어 하나 입력 완료', estimatedSeconds: 15, phase: 'start' },
          { title: '문장 하나 쓰기', successCriterion: '문장 하나 입력 완료', estimatedSeconds: 45, phase: 'start' },
          { title: '다음 장면 메모 한 줄 남기기', successCriterion: '다음에 쓸 한 줄이 남아 있음', estimatedSeconds: 60, phase: 'close' },
        ],
      };
    }
    return {
      normalizedGoal: template.normalizedGoal,
      category,
      chainTitle: template.chainTitle,
      explanation: '템플릿 결과를 AI 출력 계약 형태로 재구성했습니다.',
      steps: template.steps.map((step) => ({
        title: step.title,
        successCriterion: step.successCriterion,
        estimatedSeconds: step.estimatedSeconds,
        phase: step.phase,
      })),
    };
  }
}

export class FallbackGoalDecomposer implements GoalDecomposer {
  constructor(
    private readonly ai: MockAiGoalDecomposer,
    private readonly template: TemplateGoalDecomposer,
    private readonly options: { enabled: boolean; timeoutMs: number },
  ) {}

  async decompose(input: DecomposeGoalInput): Promise<DecomposeGoalOutput> {
    const templateOutput = await this.template.decompose(input);
    if (!this.options.enabled) return templateOutput;

    try {
      const raw = await withTimeout(this.ai.generate(input), this.options.timeoutMs);
      return validateAiOutput(input, raw);
    } catch (error) {
      return {
        ...templateOutput,
        source: 'template',
        fallbackReason: error instanceof Error ? error.message : 'AI 출력을 사용할 수 없어 템플릿으로 바꿉니다.',
      };
    }
  }
}

export function createStepQuestDecomposer(): GoalDecomposer {
  return new FallbackGoalDecomposer(
    new MockAiGoalDecomposer(),
    new TemplateGoalDecomposer(),
    {
      enabled: process.env.STEPQUEST_AI_MOCK === 'true',
      timeoutMs: Number(process.env.STEPQUEST_AI_TIMEOUT_MS || 800),
    },
  );
}

export function validateAiOutput(input: DecomposeGoalInput, raw: RawAiOutput): DecomposeGoalOutput {
  const category = normalizeCategory(raw.category, input);
  if (!Array.isArray(raw.steps)) throw new Error('AI steps must be an array.');
  if (raw.steps.length < 4 || raw.steps.length > 8) throw new Error('AI steps must contain 4 to 8 items.');

  const cap = firstStepCapSeconds(input.burdenLevel, input.energyLevel as EnergyLevel);
  const steps = raw.steps.map((item, index) => normalizeStep(item as RawAiStep, index, cap));
  const first = steps[0];
  if (!first || first.estimatedSeconds > cap) throw new Error('AI first step is too large.');

  const normalizedGoal = cleanText(raw.normalizedGoal, input.goalTitle.trim(), 140);
  const chainTitle = cleanText(raw.chainTitle, `${normalizedGoal} 입구 열기`, 160);
  return {
    normalizedGoal,
    category,
    chainTitle,
    steps,
    recommendedFirstStepId: first.clientId,
    message: '오늘은 입구만 연다.',
    source: 'ai',
    explanation: typeof raw.explanation === 'string' ? cleanText(raw.explanation, '', 220) : undefined,
  };
}

function normalizeCategory(value: unknown, input: DecomposeGoalInput): QuestCategory {
  if (typeof value === 'string' && CATEGORIES.has(value as QuestCategory)) return value as QuestCategory;
  return resolveQuestCategory(input.goalTitle, input.category);
}

function normalizeStep(item: RawAiStep, index: number, firstCap: number) {
  const title = cleanText(item.title, '', 160);
  if (!title) throw new Error(`AI step ${index + 1} has no title.`);
  if (BAD_TEXT.test(title) || BANNED_QUALITY_WORDS.test(title)) {
    throw new Error(`AI step ${index + 1} has unsafe wording.`);
  }
  const phase = typeof item.phase === 'string' && PHASES.has(item.phase as StepPhase)
    ? item.phase as StepPhase
    : index === 0
      ? 'orient'
      : 'prepare';
  const rawSeconds = Number(item.estimatedSeconds);
  if (!Number.isFinite(rawSeconds) || rawSeconds <= 0) throw new Error(`AI step ${index + 1} has invalid seconds.`);
  const estimatedSeconds = Math.max(3, Math.min(index === 0 ? firstCap : 180, Math.round(rawSeconds)));
  const successCriterion = cleanText(item.successCriterion, `${title} 완료`, 180);
  return {
    clientId: `ai-step-${index + 1}`,
    title,
    successCriterion,
    estimatedSeconds,
    phase,
    grade: gradeForSeconds(estimatedSeconds),
  };
}

function cleanText(value: unknown, fallback: string, maxLength: number): string {
  const raw = typeof value === 'string' ? value : fallback;
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text || BAD_TEXT.test(text)) return fallback.slice(0, maxLength);
  return text.slice(0, maxLength);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('AI 분해 시간이 지나 템플릿으로 바꿉니다.')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
