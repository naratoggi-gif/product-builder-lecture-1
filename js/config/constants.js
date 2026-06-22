// The Hunter System - 게임 상수
export const GAME_CONSTANTS = {
  // 앱 정보
  APP_NAME: 'The Hunter System',
  STORAGE_KEY: 'hunter_system_data',

  // 경험치 공식: 100 * 1.2^(level-1)
  BASE_EXP: 100,
  EXP_MULTIPLIER: 1.2,

  // 레벨업 보상 (Narrative Growth: 스탯 포인트 제거)
  STAT_POINTS_PER_LEVEL: 0,
  BONUS_STAT_POINTS_INTERVAL: 10,
  BONUS_STAT_POINTS: 0,

  // v5.0 Dual Economy: Essence rewards by quest grade
  ESSENCE_GAIN: {
    E: 5,
    D: 10,
    C: 15,
    B: 20,
    A: 30,
    S: 40
  },

  // 초기 스탯 (기획서: 모두 5)
  INITIAL_STATS: {
    STR: 5,   // 물리 데미지
    INT: 5,   // 스킬 데미지 & 보상 배율
    WIL: 5,   // 방어력 & 스태미나 효율
    FOCUS: 5, // 퀘스트 대기시간, 자동전투 크리티컬
    LUK: 5    // 드롭률, 랜덤 보너스
  },

  // 일일 스태미나
  DAILY_STAMINA: 100,

  // 퀘스트 등급별 스태미나 소모
  QUEST_STAMINA_COST: {
    E: 5,
    D: 10,
    C: 15,
    B: 20,
    A: 30,
    S: 40
  },

  // 퀘스트 등급별 기본 보상 (v5.0: Gold removed - earned via idle only)
  QUEST_BASE_REWARDS: {
    E: { exp: 20, gold: 0 },
    D: { exp: 40, gold: 0 },
    C: { exp: 70, gold: 0 },
    B: { exp: 120, gold: 0 },
    A: { exp: 200, gold: 0 },
    S: { exp: 350, gold: 0 }
  },

  // 퀘스트 카테고리 -> 스탯 연결
  QUEST_CATEGORIES: {
    exercise: { label: '운동/청소', stat: 'STR', icon: '💪' },
    study: { label: '공부/일', stat: 'INT', icon: '📚' },
    meditation: { label: '명상/루틴', stat: 'WIL', icon: '🧘' },
    rest: { label: '휴식/회복', stat: 'STAMINA', icon: '😴' }
  },

  // FOCUS 효과 - 퀘스트 대기시간 (분)
  FOCUS_WAIT_TIME: [
    { min: 0, max: 9, minutes: 10 },
    { min: 10, max: 19, minutes: 8 },
    { min: 20, max: 29, minutes: 6 },
    { min: 30, max: Infinity, minutes: 4 }
  ],

  // FOCUS 효과 - 자동전투 크리티컬
  AUTO_BATTLE_CRIT_BASE: 5,
  AUTO_BATTLE_CRIT_PER_FOCUS: 0.3,

  // 보상 배율
  REWARD_MULTIPLIER: {
    REAL_HUNTER: 1.0,      // 실제 퀘스트 완료 시
    SIMULATION: 0.35       // 시뮬레이션 모드
  },

  // 아이들 골드 계산 (Design v3.0: goldPerSecond = baseGold * (1 + STR * 0.05))
  IDLE_BASE_GOLD: 1,
  IDLE_STR_MULTIPLIER: 0.05,  // STR 1당 5% 증가

  // 크리티컬 히트 (Design v3.0)
  CRITICAL_ANIMATION_COOLDOWN: 1500, // 1.5초 쿨다운 (애니메이션 스팸 방지)

  // 게이트 종류
  GATE_TYPES: {
    WEEKDAY: { id: 'weekday', name: '평일 게이트', available: 'always' },
    WEEKEND: { id: 'weekend', name: '주말 레이드', available: 'weekend' },
    RANDOM: { id: 'random', name: '랜덤 게이트', available: 'daily' },
    SIMULATION: { id: 'simulation', name: '시뮬레이션 게이트', available: 'always' }
  },

  // 코스튬 레어리티 (v5.0: NORMAL now uses essence)
  COSTUME_RARITY: {
    NORMAL: { id: 'normal', name: '일반', color: '#9ca3af', obtain: 'essence' },
    RARE: { id: 'rare', name: '레어', color: '#3b82f6', obtain: 'ads' },
    EPIC: { id: 'epic', name: '에픽', color: '#a855f7', obtain: 'events' },
    LEGENDARY: { id: 'legendary', name: '전설', color: '#fbbf24', obtain: 'achievement' }
  },

  // 광고 보상 (외부 에너지 계약)
  AD_REWARDS: {
    AUTO_BATTLE_BOOST: { duration: 30, multiplier: 2 }, // 30분간 x2
    STAMINA_RECOVERY: 20,
    RANDOM_GATE_RETRY: true
  }
};

// ========== 레벨 해금 시스템 ==========
// 레벨별 해금되는 기능들 (데이터 드리븐)
export const LEVEL_UNLOCKS = {
  3: ['C_GRADE_QUESTS'],
  5: ['WEEKEND_RAID_GATE', 'B_GRADE_QUESTS'],
  7: ['SUDDEN_GATE'],
  10: ['SKILL_SLOT_1', 'A_GRADE_QUESTS'],
  15: ['COSTUME_SLOT', 'S_GRADE_QUESTS'],
  20: ['SKILL_SLOT_2'],
  25: ['RANK_UP_D'],
  30: ['COSTUME_TRANSFORM'],
  40: ['RANK_UP_C'],
  50: ['SKILL_SLOT_3', 'RANK_UP_B']
};

// 해금 기능 상세 정보
export const UNLOCK_DETAILS = {
  // 퀘스트 등급
  C_GRADE_QUESTS: {
    name: 'C등급 퀘스트',
    description: 'C등급 퀘스트를 생성할 수 있습니다.',
    icon: '📋',
    category: 'quest'
  },
  B_GRADE_QUESTS: {
    name: 'B등급 퀘스트',
    description: 'B등급 퀘스트를 생성할 수 있습니다.',
    icon: '📋',
    category: 'quest'
  },
  A_GRADE_QUESTS: {
    name: 'A등급 퀘스트',
    description: 'A등급 퀘스트를 생성할 수 있습니다.',
    icon: '📋',
    category: 'quest'
  },
  S_GRADE_QUESTS: {
    name: 'S등급 퀘스트',
    description: 'S등급 퀘스트를 생성할 수 있습니다.',
    icon: '📋',
    category: 'quest'
  },

  // 게이트
  WEEKEND_RAID_GATE: {
    name: '주말 레이드 게이트',
    description: '주말에 특별 레이드 게이트에 입장할 수 있습니다. (보상 5배)',
    icon: '🏰',
    category: 'gate'
  },
  SUDDEN_GATE: {
    name: '돌발 게이트',
    description: '랜덤하게 발생하는 돌발 게이트에 도전할 수 있습니다.',
    icon: '⚡',
    category: 'gate'
  },

  // 스킬
  SKILL_SLOT_1: {
    name: '스킬 슬롯 1',
    description: '첫 번째 스킬 슬롯이 해금됩니다.',
    icon: '✨',
    category: 'skill'
  },
  SKILL_SLOT_2: {
    name: '스킬 슬롯 2',
    description: '두 번째 스킬 슬롯이 해금됩니다.',
    icon: '✨',
    category: 'skill'
  },
  SKILL_SLOT_3: {
    name: '스킬 슬롯 3',
    description: '세 번째 스킬 슬롯이 해금됩니다.',
    icon: '✨',
    category: 'skill'
  },

  // 코스튬
  COSTUME_SLOT: {
    name: '코스튬 장착',
    description: '코스튬을 장착하여 추가 능력을 얻을 수 있습니다.',
    icon: '👔',
    category: 'costume'
  },
  COSTUME_TRANSFORM: {
    name: '코스튬 변신',
    description: '코스튬 변신 기능이 해금됩니다.',
    icon: '🎭',
    category: 'costume'
  },

  // 랭크
  RANK_UP_D: {
    name: 'D랭크 승급',
    description: '헌터 랭크가 D로 상승합니다!',
    icon: '🏅',
    category: 'rank'
  },
  RANK_UP_C: {
    name: 'C랭크 승급',
    description: '헌터 랭크가 C로 상승합니다!',
    icon: '🏅',
    category: 'rank'
  },
  RANK_UP_B: {
    name: 'B랭크 승급',
    description: '헌터 랭크가 B로 상승합니다!',
    icon: '🏅',
    category: 'rank'
  }
};

// 특정 레벨에서 해금되는 기능들 가져오기
export function getUnlocksAtLevel(level) {
  return LEVEL_UNLOCKS[level] || [];
}

// 특정 기능이 해금되었는지 확인
export function isFeatureUnlocked(featureId, unlockedFeatures = []) {
  return unlockedFeatures.includes(featureId);
}

// 다음 해금까지 필요한 레벨 정보
export function getNextUnlockInfo(currentLevel) {
  const levels = Object.keys(LEVEL_UNLOCKS).map(Number).sort((a, b) => a - b);
  const nextLevel = levels.find(lvl => lvl > currentLevel);

  if (!nextLevel) return null;

  return {
    level: nextLevel,
    unlocks: LEVEL_UNLOCKS[nextLevel].map(id => ({
      id,
      ...UNLOCK_DETAILS[id]
    }))
  };
}

// 필요 경험치 계산
export function getRequiredExp(level) {
  return Math.floor(GAME_CONSTANTS.BASE_EXP * Math.pow(GAME_CONSTANTS.EXP_MULTIPLIER, level - 1));
}

// FOCUS에 따른 퀘스트 대기시간 계산
export function getQuestWaitTime(focus) {
  const tier = GAME_CONSTANTS.FOCUS_WAIT_TIME.find(t => focus >= t.min && focus <= t.max);
  return tier ? tier.minutes : 10;
}

// 자동전투 크리티컬 확률 계산
export function getAutoBattleCritRate(focus) {
  return GAME_CONSTANTS.AUTO_BATTLE_CRIT_BASE + (focus * GAME_CONSTANTS.AUTO_BATTLE_CRIT_PER_FOCUS);
}

/**
 * Calculate base idle gold per second (v5.0)
 *
 * Formula: goldPerSecond = baseGold * (1 + STR * 0.05)
 *
 * Additional multipliers applied in stateManager.updateIdleGold():
 * - Hunter Multiplier: Real=1.0x, Simulation=0.35x
 * - Auto Battle Boost: x2 (from ads, 30 min duration)
 * - Critical Hit: x2 (5% + FOCUS*0.3% chance)
 *
 * @param {number} str - STR stat value
 * @returns {number} Base gold per second (before multipliers)
 */
export function calculateIdleGold(str) {
  return GAME_CONSTANTS.IDLE_BASE_GOLD * (1 + str * GAME_CONSTANTS.IDLE_STR_MULTIPLIER);
}

// 보상 계산 (리얼 헌터 vs 시뮬레이션) - v5.0: Gold removed from quest rewards
export function calculateReward(baseReward, isRealHunter) {
  const multiplier = isRealHunter
    ? GAME_CONSTANTS.REWARD_MULTIPLIER.REAL_HUNTER
    : GAME_CONSTANTS.REWARD_MULTIPLIER.SIMULATION;

  return {
    exp: Math.floor(baseReward.exp * multiplier),
    gold: 0 // v5.0: Gold earned via idle only
  };
}

// INT에 따른 보상 배율 계산
export function getIntRewardBonus(int) {
  return 1 + (int * 0.02); // INT 1당 2% 보상 증가
}

// 스탯 -> 전투 스탯 변환
export function calculateCombatStats(stats) {
  return {
    maxHp: 100 + (stats.WIL * 10),
    attack: Math.floor(10 + (stats.STR * 2)),
    skillDamage: Math.floor(10 + (stats.INT * 2.5)),
    defense: Math.floor(5 + (stats.WIL * 1.5)),
    critRate: getAutoBattleCritRate(stats.FOCUS),
    critDamage: 150 + (stats.STR * 1),
    dropRate: 5 + (stats.LUK * 0.5),
    bonusChance: stats.LUK * 0.3
  };
}

// 스태미나 효율 계산 (WIL 기반)
export function getStaminaEfficiency(wil) {
  return 1 + (wil * 0.02); // WIL 1당 2% 스태미나 효율 증가
}

// 연마 비용 계산 (Refine System)
export function calculateRefineCost(currentStatValue) {
  return 10 + (currentStatValue * 2);
}
