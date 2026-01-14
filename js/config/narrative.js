// The Hunter System - 내러티브 시스템 (자기계발 목적 강화)

/**
 * 퀘스트 카테고리별 완료 메시지 (시스템 로그 스타일)
 */
export const QUEST_COMPLETION_NARRATIVES = {
  exercise: [
    "운동(STR) 수련 완료. 현실의 근력이 파괴력으로 치환됩니다.",
    "육체 단련 임무 성공. 당신의 공격력이 상승합니다.",
    "STR 훈련 완료. 몸이 기억하는 힘이 시스템에 반영되었습니다.",
    "물리적 한계 돌파. 데미지 계수가 조정되었습니다.",
    "근력 강화 완료. 현실의 땀이 가상의 힘으로 변환됩니다."
  ],
  study: [
    "학습(INT) 임무 성공. 지식이 마력 회로를 확장합니다.",
    "지혜 축적 완료. 스킬 데미지 배율이 증가합니다.",
    "INT 연구 성공. 뇌신경 회로가 마법 회로로 치환되었습니다.",
    "정보 흡수 완료. 보상 획득 효율이 상승합니다.",
    "지식 습득 달성. 마나 용량이 확장되었습니다."
  ],
  meditation: [
    "명상(WIL) 수행 완료. 정신력이 방어막으로 구현됩니다.",
    "의지 단련 성공. 체력과 방어력이 강화됩니다.",
    "WIL 훈련 완료. 흔들리지 않는 마음이 시스템에 각인됩니다.",
    "정신 집중 달성. 스태미나 효율이 최적화되었습니다.",
    "내면 수련 성공. 정신력이 물리적 방어로 변환됩니다."
  ],
  rest: [
    "회복 프로토콜 완료. 스태미나가 충전되었습니다.",
    "휴식 임무 성공. 오버히트 방지 시스템 가동.",
    "재충전 완료. 다음 전투를 위한 에너지가 비축되었습니다.",
    "컨디션 회복 달성. 지속 가능한 성장을 위한 필수 과정입니다.",
    "신체 회복 성공. 휴식도 훈련의 일부입니다."
  ]
};

/**
 * 상단 명언 위젯용 인용구 (일일/세션 로테이션)
 */
export const DAILY_QUOTES = [
  { text: "현실에서의 1%가 가상의 100%보다 값집니다.", author: "시스템" },
  { text: "오늘 흘린 땀은 내일의 경험치입니다.", author: "시스템" },
  { text: "시뮬레이션은 연습일 뿐. 진정한 레벨업은 현실에서.", author: "시스템" },
  { text: "작은 습관이 쌓여 전설이 됩니다.", author: "시스템" },
  { text: "게으름은 0.35배의 삶을 선택하는 것입니다.", author: "시스템" },
  { text: "몸을 단련하면 STR이, 마음을 단련하면 WIL이 오릅니다.", author: "시스템" },
  { text: "지식은 INT로, 집중력은 FOCUS로 변환됩니다.", author: "시스템" },
  { text: "Real Hunter의 하루는 Simulation의 3일과 같습니다.", author: "시스템" },
  { text: "오늘 하지 않으면 내일의 나는 더 약해집니다.", author: "시스템" },
  { text: "당신의 선택이 당신의 스탯을 결정합니다.", author: "시스템" },
  { text: "퀘스트는 목표이고, 완료는 성장입니다.", author: "시스템" },
  { text: "휴식도 전략입니다. 하지만 핑계는 아닙니다.", author: "시스템" },
  { text: "어제보다 나은 오늘, 그것이 레벨업입니다.", author: "시스템" },
  { text: "행동 없는 각성은 잠든 것과 같습니다.", author: "시스템" }
];

/**
 * 경고 메시지 (3일 이상 현실 퀘스트 미완료 시)
 */
export const WARNING_MESSAGES = {
  streak_broken: "경고: 연속 기록이 끊겼습니다. 시스템과의 연결이 약해지고 있습니다.",
  no_quest_3days: "경고: 3일간 현실 퀘스트 미완료. 헌터 자격이 박탈될 수 있습니다.",
  simulation_only: "경고: 시뮬레이션 모드 지속 중. 실전 능력이 감소하고 있습니다.",
  low_stamina: "알림: 스태미나가 부족합니다. 휴식 퀘스트를 고려하세요."
};

/**
 * 일일 평가 내러티브 생성
 */
export function generateDailyEvaluation(stats, questHistory, currentStreak) {
  const insights = [];

  // 스탯 분포 분석
  const statValues = [stats.STR, stats.INT, stats.WIL, stats.FOCUS, stats.LUK];
  const maxStat = Math.max(...statValues);
  const minStat = Math.min(...statValues);
  const avgStat = statValues.reduce((a, b) => a + b, 0) / 5;

  // 주력 스탯 분석
  if (stats.STR === maxStat) {
    insights.push("물리 전투형 헌터로 성장 중. 육체 훈련에 집중하고 있습니다.");
  } else if (stats.INT === maxStat) {
    insights.push("마법 계열 헌터로 성장 중. 지식 축적에 매진하고 있습니다.");
  } else if (stats.WIL === maxStat) {
    insights.push("정신력 기반 헌터로 성장 중. 내면의 힘을 기르고 있습니다.");
  } else if (stats.FOCUS === maxStat) {
    insights.push("집중력 특화 헌터로 성장 중. 효율적인 성장을 추구합니다.");
  }

  // 스탯 균형 분석
  if (maxStat - minStat > 15) {
    insights.push(`스탯 불균형 감지. 최저 스탯(${minStat}) 강화를 권장합니다.`);
  } else if (maxStat - minStat < 5) {
    insights.push("균형 잡힌 스탯 분포. 올라운더형 성장 경로입니다.");
  }

  // 연속 기록 분석
  if (currentStreak >= 7) {
    insights.push(`${currentStreak}일 연속 달성! 습관이 능력이 되고 있습니다.`);
  } else if (currentStreak >= 3) {
    insights.push(`${currentStreak}일 연속 진행 중. 꾸준함이 힘입니다.`);
  } else if (currentStreak === 0) {
    insights.push("연속 기록 리셋. 오늘부터 다시 시작하세요.");
  }

  return insights;
}

/**
 * 오늘의 명언 가져오기 (날짜 기반 로테이션)
 */
export function getDailyQuote() {
  const today = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
  const index = dayOfYear % DAILY_QUOTES.length;
  return DAILY_QUOTES[index];
}

/**
 * 세션 기반 랜덤 명언 (새로고침 시마다 변경)
 */
export function getRandomQuote() {
  return DAILY_QUOTES[Math.floor(Math.random() * DAILY_QUOTES.length)];
}

/**
 * 퀘스트 완료 내러티브 메시지 가져오기
 */
export function getQuestCompletionNarrative(category) {
  const narratives = QUEST_COMPLETION_NARRATIVES[category];
  if (!narratives || narratives.length === 0) {
    return "임무 완료. 시스템에 기록되었습니다.";
  }
  return narratives[Math.floor(Math.random() * narratives.length)];
}

/**
 * 게이트 입장 경고 메시지
 */
export const GATE_ENTRY_WARNINGS = {
  simulation: "현실의 노력이 뒷받침되지 않은 진입은 시뮬레이션에 불과합니다.",
  real: "현실의 노력이 당신을 이끕니다. 실전 모드 활성화."
};

/**
 * 레벨업 내러티브 메시지
 */
export const LEVEL_UP_NARRATIVES = [
  "레벨 업! 시스템이 당신의 성장을 인정합니다.",
  "각성 단계 상승. 새로운 힘이 깨어납니다.",
  "경험치 임계점 돌파. 한계를 넘어섰습니다.",
  "레벨 상승 완료. 당신은 더 강해졌습니다."
];
