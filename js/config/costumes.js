// The Hunter System - 코스튬 데이터 (직업 전직 시스템)

/**
 * 코스튬 데이터 모델:
 * - id: 고유 식별자
 * - name: 코스튬 이름
 * - rarity: NORMAL | RARE | EPIC | LEGENDARY
 * - requiredStats: { STR?: n, INT?: n, WIL?: n, FOCUS?: n, LUK?: n }
 * - statBonus: {
 *     expMult?: 배율 (예: 1.1 = +10%)
 *     goldMult?: 배율 (예: 1.05 = +5%)
 *     strFlat?: 추가 STR
 *     intFlat?: 추가 INT
 *     wilFlat?: 추가 WIL
 *     focusFlat?: 추가 FOCUS
 *     lukFlat?: 추가 LUK
 *   }
 * - jobTitle: 직업 명칭 (오마주)
 */
export const COSTUMES = [
  // ===== Normal (골드 구매) =====
  {
    id: 'hunter_basic',
    name: '기본 헌터복',
    rarity: 'NORMAL',
    price: 500,
    statBonus: {
      expMult: 1.0,
      goldMult: 1.0,
      strFlat: 1
    },
    requiredStats: null,
    jobTitle: '초보 헌터',
    description: '초보 헌터의 기본 장비'
  },
  {
    id: 'shadow_cloak',
    name: '그림자 망토',
    rarity: 'NORMAL',
    price: 1000,
    statBonus: {
      expMult: 1.05,
      goldMult: 1.0,
      focusFlat: 2
    },
    requiredStats: { FOCUS: 10 },
    jobTitle: '그림자 추적자',
    description: '어둠 속에서 집중력을 높여준다'
  },
  {
    id: 'warrior_armor',
    name: '전사의 갑옷',
    rarity: 'NORMAL',
    price: 1500,
    statBonus: {
      expMult: 1.08,
      goldMult: 1.02,
      strFlat: 2,
      wilFlat: 1
    },
    requiredStats: { STR: 15 },
    jobTitle: '강철의 전사',
    description: '전장의 베테랑이 입던 갑옷'
  },
  {
    id: 'scholar_robe',
    name: '학자의 로브',
    rarity: 'NORMAL',
    price: 1200,
    statBonus: {
      expMult: 1.10,
      goldMult: 1.0,
      intFlat: 2
    },
    requiredStats: { INT: 12 },
    jobTitle: '지식의 탐구자',
    description: '지혜를 추구하는 자의 의복'
  },

  // ===== Rare (광고 시청) =====
  {
    id: 'mage_robe',
    name: '마법사의 로브',
    rarity: 'RARE',
    adRequired: true,
    statBonus: {
      expMult: 1.15,
      goldMult: 1.05,
      intFlat: 3,
      focusFlat: 1
    },
    requiredStats: { INT: 25 },
    jobTitle: '아케인 메이지',
    description: '마나의 흐름을 강화하는 로브'
  },
  {
    id: 'lucky_charm',
    name: '행운의 부적',
    rarity: 'RARE',
    adRequired: true,
    statBonus: {
      expMult: 1.12,
      goldMult: 1.10,
      lukFlat: 4
    },
    requiredStats: { LUK: 15 },
    jobTitle: '행운아',
    description: '신비로운 행운을 불러온다'
  },
  {
    id: 'assassin_gear',
    name: '암살자의 장구',
    rarity: 'RARE',
    adRequired: true,
    statBonus: {
      expMult: 1.18,
      goldMult: 1.05,
      focusFlat: 3,
      strFlat: 1
    },
    requiredStats: { FOCUS: 20, STR: 15 },
    jobTitle: '뇌명 사냥꾼',
    description: '그림자 속에서 번개처럼 움직인다'
  },

  // ===== Epic (이벤트/업적) =====
  {
    id: 'dragon_scale',
    name: '용린 갑주',
    rarity: 'EPIC',
    eventOnly: true,
    statBonus: {
      expMult: 1.25,
      goldMult: 1.15,
      strFlat: 3,
      wilFlat: 3
    },
    requiredStats: { STR: 30, WIL: 25 },
    jobTitle: '드래곤 슬레이어',
    description: '전설의 용에게서 얻은 비늘로 만든 갑옷'
  },
  {
    id: 'esper_suit',
    name: '초능력 슈트',
    rarity: 'EPIC',
    eventOnly: true,
    statBonus: {
      expMult: 1.30,
      goldMult: 1.10,
      intFlat: 4,
      focusFlat: 2
    },
    requiredStats: { INT: 50 },
    jobTitle: '초능력 소녀',
    description: '정신력으로 세상을 지배하는 자의 장비'
  },

  // ===== Legendary (특별 업적) =====
  {
    id: 'monarch_regalia',
    name: '군주의 예복',
    rarity: 'LEGENDARY',
    achievementOnly: true,
    statBonus: {
      expMult: 1.50,
      goldMult: 1.25,
      strFlat: 5,
      intFlat: 5,
      wilFlat: 5,
      focusFlat: 5,
      lukFlat: 5
    },
    requiredStats: { STR: 40, INT: 40, WIL: 40, FOCUS: 40, LUK: 40 },
    jobTitle: '무명의 히어로',
    description: '모든 것을 초월한 자만이 입을 수 있는 전설의 예복'
  }
];

// 코스튬 ID로 코스튬 정보 가져오기
export function getCostumeById(costumeId) {
  return COSTUMES.find(c => c.id === costumeId) || null;
}

/**
 * 장착 가능 여부 체크 (상세한 부족 스탯 정보 제공)
 * @returns {
 *   canEquip: boolean,
 *   reason?: string,
 *   missingStats?: Array<{ stat: string, required: number, current: number, shortage: number }>
 * }
 */
export function canEquipCostume(costumeId, hunterStats) {
  const costume = getCostumeById(costumeId);
  if (!costume) return { canEquip: false, reason: '코스튬을 찾을 수 없습니다' };
  if (!costume.requiredStats) return { canEquip: true };

  const missingStats = [];

  for (const [stat, required] of Object.entries(costume.requiredStats)) {
    const current = hunterStats[stat] || 0;
    if (current < required) {
      missingStats.push({
        stat,
        required,
        current,
        shortage: required - current
      });
    }
  }

  if (missingStats.length > 0) {
    // 부족한 스탯들을 한국어로 표시
    const reasonParts = missingStats.map(m =>
      `${m.stat} ${m.shortage} 부족 (${m.current}/${m.required})`
    );
    return {
      canEquip: false,
      reason: reasonParts.join(', '),
      missingStats
    };
  }

  return { canEquip: true };
}

/**
 * 코스튬의 statBonus에서 배율/플랫 보너스 가져오기
 * @returns { expMult, goldMult, strFlat, intFlat, wilFlat, focusFlat, lukFlat }
 */
export function getCostumeStatBonus(costumeId) {
  const costume = getCostumeById(costumeId);
  if (!costume || !costume.statBonus) {
    return {
      expMult: 1.0,
      goldMult: 1.0,
      strFlat: 0,
      intFlat: 0,
      wilFlat: 0,
      focusFlat: 0,
      lukFlat: 0
    };
  }

  return {
    expMult: costume.statBonus.expMult || 1.0,
    goldMult: costume.statBonus.goldMult || 1.0,
    strFlat: costume.statBonus.strFlat || 0,
    intFlat: costume.statBonus.intFlat || 0,
    wilFlat: costume.statBonus.wilFlat || 0,
    focusFlat: costume.statBonus.focusFlat || 0,
    lukFlat: costume.statBonus.lukFlat || 0
  };
}
