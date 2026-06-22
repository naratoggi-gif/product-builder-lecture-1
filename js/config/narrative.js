// The Hunter System - 내러티브 시스템 (v6.1 현대 판타지 소설 톤)

/**
 * v6.1: 퀘스트 카테고리별 완료 메시지 (현대 판타지 소설 톤)
 */
export const QUEST_COMPLETION_NARRATIVES = {
  exercise: [
    "육체 연성 완료. 마석에 깃든 힘이 근육으로 스며든다.",
    "물리 각성 성공. 그림자조차 두려워하는 힘이 깨어났다.",
    "STR 코어 강화 완료. 맨손으로 A급 마수도 찢을 수 있을 것 같다.",
    "신체 강화술 완성. 헌터의 몸이 강철보다 단단해졌다.",
    "파괴의 기운이 축적되었다. 다음 타격은 더욱 치명적이리라."
  ],
  study: [
    "마나 회로 확장 성공. 뇌리에 새로운 마법진이 각인되었다.",
    "지식 흡수 완료. 고대 마도서의 지혜가 스며들었다.",
    "INT 코어 각성. 마력이 폭발적으로 증가하고 있다.",
    "정신 연성 성공. 이제 S급 스킬도 시전할 수 있을 것 같다.",
    "마법 공식 해독 완료. 세계의 이치가 조금 더 선명해졌다."
  ],
  meditation: [
    "정신 결계 강화 완료. 어떤 정신 공격도 뚫지 못하리라.",
    "의지력 각성 성공. 굳건한 마음이 방패가 되었다.",
    "WIL 코어 안정화. 죽음의 문턱에서도 일어설 수 있다.",
    "내면의 힘 해방. 영혼이 단단한 갑옷이 되었다.",
    "불굴의 의지 획득. 어떤 고난도 당신을 무너뜨리지 못한다."
  ],
  rest: [
    "회복 마법 시전 완료. 지친 육체에 생기가 돌아왔다.",
    "재생의 오라 활성화. 내일의 전투를 위한 충전이 완료되었다.",
    "휴식 프로토콜 성공. 현명한 헌터는 쉴 줄도 안다.",
    "체력 회복 완료. 전투력이 최대치로 복구되었다.",
    "에너지 비축 성공. 다음 게이트에서 폭발할 준비가 되었다."
  ]
};

/**
 * v6.1: 아이들 골드 수급 로그 (현대 판타지 소설 톤)
 */
export const IDLE_GOLD_NARRATIVES = [
  "자동 사냥 시스템 가동 중... 마석 정산 완료.",
  "그림자 분신이 저급 마수를 처치했다. 마석 획득.",
  "던전 자동 순찰 중... 영혼의 정수 추출 성공.",
  "마나 결정체 분해 완료. 골드로 환산되었다.",
  "몬스터 코어 매각 완료. 헌터 협회 정산금 입금.",
  "자동 채굴 시스템이 마정석을 캐냈다.",
  "그림자 병사들이 보스 레어를 습격 중... 전리품 획득."
];

/**
 * v6.1: 크리티컬 히트 로그 (현대 판타지 소설 톤)
 */
export const CRITICAL_HIT_NARRATIVES = [
  "치명타 발동! 급소를 정확히 꿰뚫었다!",
  "크리티컬! 마수의 심장을 관통했다!",
  "일격필살! 적의 코어가 파괴되었다!",
  "회심의 일격! 마석이 두 배로 쏟아졌다!",
  "정밀 타격 성공! 보스급 전리품을 획득했다!"
];

/**
 * v6.1: 랭크 승급 내러티브 (현대 판타지 소설 톤)
 */
export const RANK_UP_NARRATIVES = {
  'D': "축하합니다! D등급으로 승급되었습니다. 이제 저급 게이트 솔로 클리어가 가능합니다.",
  'C': "C등급 승급! 중급 헌터로 인정받았습니다. 길드 가입 자격이 주어집니다.",
  'B': "B등급 달성! 당신의 이름이 헌터 협회 본부에 등록되었습니다.",
  'A': "A등급 승급! 국가 재난급 게이트 공략에 참여할 수 있습니다.",
  'S': "S등급 도달! 전 세계에 당신의 이름이 알려집니다. 전설의 시작입니다."
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
 * v6.1: 레벨업 내러티브 메시지 (현대 판타지 소설 톤)
 */
export const LEVEL_UP_NARRATIVES = [
  "레벨 업! 몸 전체로 마나가 폭주한다. 새로운 경지에 도달했다.",
  "각성 단계 상승. 세계의 이치가 더 선명하게 보인다.",
  "경험치 임계점 돌파! 신체가 한계를 넘어 재구성되었다.",
  "레벨 상승 완료. 마정석의 기운이 전신에 스며들었다.",
  "진화 완료! 이제 더 강한 마수와 맞설 수 있다."
];

/**
 * v6.1: 게이트 클리어 로그 (현대 판타지 소설 톤)
 */
export const GATE_CLEAR_NARRATIVES = [
  "게이트 클리어! 보스 마수가 마석으로 분해되었다.",
  "던전 정복 완료. 차원의 균열이 봉인되었다.",
  "게이트 폐쇄 성공. 헌터 협회에 보고가 접수되었다.",
  "마수 소탕 완료. 전리품이 인벤토리에 추가되었다.",
  "던전 정화 성공. 당신의 이름이 협회 기록에 남았다."
];

/**
 * v6.1: 스탯 연마 로그 (현대 판타지 소설 톤)
 */
export const REFINE_NARRATIVES = {
  STR: "힘의 정수가 근육에 스며들었다. 파괴력이 상승한다.",
  INT: "지혜의 마석이 뇌에 각인되었다. 마력이 확장된다.",
  WIL: "의지의 결정이 심장에 녹아들었다. 정신력이 강화된다.",
  FOCUS: "집중의 보석이 눈에 박혔다. 감각이 극대화된다.",
  LUK: "행운의 동전이 영혼에 새겨졌다. 운명이 미소 짓는다."
};

/**
 * v6.1: 랜덤 아이들 골드 내러티브 가져오기
 */
export function getIdleGoldNarrative() {
  return IDLE_GOLD_NARRATIVES[Math.floor(Math.random() * IDLE_GOLD_NARRATIVES.length)];
}

/**
 * v6.1: 크리티컬 히트 내러티브 가져오기
 */
export function getCriticalNarrative() {
  return CRITICAL_HIT_NARRATIVES[Math.floor(Math.random() * CRITICAL_HIT_NARRATIVES.length)];
}

/**
 * v6.1: 랭크 승급 내러티브 가져오기
 */
export function getRankUpNarrative(rank) {
  return RANK_UP_NARRATIVES[rank] || "랭크가 상승했습니다!";
}

/**
 * v6.1: 스탯 연마 내러티브 가져오기
 */
export function getRefineNarrative(stat) {
  return REFINE_NARRATIVES[stat] || "스탯이 상승했습니다.";
}
