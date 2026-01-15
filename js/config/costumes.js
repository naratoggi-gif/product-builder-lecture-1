// The Hunter System - 코스튬 데이터 (직업 전직 시스템)
// v5.0 Dual Economy: Costumes are purchased with Essence (not Gold)

/**
 * 코스튬 데이터 모델:
 * - id: 고유 식별자
 * - name: 코스튬 이름
 * - rarity: NORMAL | RARE | EPIC | LEGENDARY
 * - essencePrice: 에센스 가격 (v5.0: Gold → Essence)
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
 * - battleSpeedMult: 전투 속도 배율 (optional, default 1.0)
 * - spriteKey: 스프라이트 이미지 키 (필수)
 * - skillOverrides: { (Layer 2 - Skill Override System)
 *     [baseSkillKey]: {
 *       name: "변경된 스킬명",
 *       vfx: "new_vfx_effect",
 *       damageMult: 1.5,  // 기본 대비 배율
 *       icon?: "새 아이콘"
 *     }
 *   }
 * - jobTitle: 직업 명칭 (오마주)
 *
 * RULES (v5.0 Dual Economy):
 * - Costumes are purchased with Essence ONLY (earned from real-life quests)
 * - Gold is for idle growth (stat refinement) ONLY
 * - Only ONE costume can be equipped at a time
 * - Skill overrides do NOT stack
 * - Costume replaces base skill's name, VFX, and damage multiplier
 * - requiredStats must be met before equipping
 */
export const COSTUMES = [
  // ===== Normal (에센스 구매 - v5.0) =====
  {
    id: 'hunter_basic',
    name: '기본 헌터복',
    rarity: 'NORMAL',
    essencePrice: 50, // v5.0: Essence instead of Gold
    statBonus: {
      expMult: 1.0,
      goldMult: 1.0,
      strFlat: 1
    },
    battleSpeedMult: 1.0,
    spriteKey: 'hunter_default',
    skillOverrides: null, // 기본 코스튬은 스킬 변경 없음
    requiredStats: null,
    jobTitle: '초보 헌터',
    description: '초보 헌터의 기본 장비'
  },
  {
    id: 'shadow_cloak',
    name: '그림자 망토',
    rarity: 'NORMAL',
    essencePrice: 100, // v5.0: Essence instead of Gold
    statBonus: {
      expMult: 1.05,
      goldMult: 1.0,
      focusFlat: 2
    },
    battleSpeedMult: 1.0,
    spriteKey: 'hunter_shadow',
    skillOverrides: {
      basicSlash: {
        name: '그림자 베기',
        vfx: 'slash_shadow',
        damageMult: 1.15,
        icon: '🌑'
      }
    },
    requiredStats: { FOCUS: 10 },
    jobTitle: '그림자 추적자',
    description: '어둠 속에서 집중력을 높여준다'
  },
  {
    id: 'warrior_armor',
    name: '전사의 갑옷',
    rarity: 'NORMAL',
    essencePrice: 150, // v5.0: Essence instead of Gold
    statBonus: {
      expMult: 1.08,
      goldMult: 1.02,
      strFlat: 2,
      wilFlat: 1
    },
    battleSpeedMult: 1.0,
    spriteKey: 'hunter_warrior',
    skillOverrides: {
      basicSlash: {
        name: '강철 참격',
        vfx: 'slash_steel',
        damageMult: 1.25,
        icon: '🗡️'
      },
      basicPunch: {
        name: '철권',
        vfx: 'punch_steel',
        damageMult: 1.20,
        icon: '🛡️'
      }
    },
    requiredStats: { STR: 15 },
    jobTitle: '강철의 전사',
    description: '전장의 베테랑이 입던 갑옷'
  },
  {
    id: 'scholar_robe',
    name: '학자의 로브',
    rarity: 'NORMAL',
    essencePrice: 120, // v5.0: Essence instead of Gold
    statBonus: {
      expMult: 1.10,
      goldMult: 1.0,
      intFlat: 2
    },
    battleSpeedMult: 1.0,
    spriteKey: 'hunter_scholar',
    skillOverrides: {
      basicBolt: {
        name: '지식의 화살',
        vfx: 'bolt_arcane',
        damageMult: 1.20,
        icon: '📖'
      }
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
    battleSpeedMult: 1.1,
    spriteKey: 'hunter_mage',
    skillOverrides: {
      basicBolt: {
        name: '아케인 볼트',
        vfx: 'bolt_arcane_purple',
        damageMult: 1.40,
        icon: '🔮'
      },
      focusStrike: {
        name: '마력 집중',
        vfx: 'focus_arcane',
        damageMult: 1.30,
        icon: '✨'
      }
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
    battleSpeedMult: 1.0,
    spriteKey: 'hunter_lucky',
    skillOverrides: {
      luckyStrike: {
        name: '대박 타격',
        vfx: 'lucky_jackpot',
        damageMult: 1.50,
        icon: '🎰'
      }
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
    battleSpeedMult: 1.2,
    spriteKey: 'hunter_assassin',
    skillOverrides: {
      basicSlash: {
        name: '암살 베기',
        vfx: 'slash_assassin',
        damageMult: 1.45,
        icon: '🗡️'
      },
      focusStrike: {
        name: '급소 찌르기',
        vfx: 'focus_critical',
        damageMult: 1.60,
        icon: '💀'
      }
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
    battleSpeedMult: 1.1,
    spriteKey: 'hunter_dragon',
    skillOverrides: {
      basicSlash: {
        name: '용염 참격',
        vfx: 'slash_dragonfire',
        damageMult: 1.60,
        icon: '🔥'
      },
      basicPunch: {
        name: '용권',
        vfx: 'punch_dragon',
        damageMult: 1.50,
        icon: '🐉'
      },
      basicBolt: {
        name: '용의 숨결',
        vfx: 'bolt_dragonbreath',
        damageMult: 1.55,
        icon: '🐲'
      }
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
    battleSpeedMult: 1.3,
    spriteKey: 'hunter_esper',
    skillOverrides: {
      basicBolt: {
        name: '염동력',
        vfx: 'bolt_psychic',
        damageMult: 1.70,
        icon: '🧠'
      },
      focusStrike: {
        name: '정신 파괴',
        vfx: 'focus_mindbreak',
        damageMult: 1.80,
        icon: '💫'
      }
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
    battleSpeedMult: 1.5,
    spriteKey: 'hunter_monarch',
    skillOverrides: {
      basicBolt: {
        name: '군주의 천벌',
        vfx: 'bolt_monarch',
        damageMult: 2.0,
        icon: '👑'
      },
      basicSlash: {
        name: '군주의 단죄',
        vfx: 'slash_monarch',
        damageMult: 2.0,
        icon: '⚜️'
      },
      basicPunch: {
        name: '군주의 철권',
        vfx: 'punch_monarch',
        damageMult: 2.0,
        icon: '🦁'
      },
      focusStrike: {
        name: '섭리',
        vfx: 'focus_providence',
        damageMult: 2.5,
        icon: '✝️'
      },
      luckyStrike: {
        name: '운명',
        vfx: 'lucky_destiny',
        damageMult: 2.5,
        icon: '⭐'
      }
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

// ========== Two-Layer Skill System ==========

/**
 * 코스튬의 스킬 오버라이드 가져오기
 * @param {string} costumeId
 * @param {string} baseSkillKey - 기본 스킬 ID (예: 'basicBolt')
 * @returns {Object|null} 오버라이드 정보 또는 null
 */
export function getSkillOverride(costumeId, baseSkillKey) {
  const costume = getCostumeById(costumeId);
  if (!costume || !costume.skillOverrides) return null;
  return costume.skillOverrides[baseSkillKey] || null;
}

/**
 * 유효 스킬 계산 (Layer 1 + Layer 2)
 * 코스튬이 장착되어 있으면 오버라이드 적용, 아니면 기본 스킬 반환
 *
 * @param {Object} baseSkill - 기본 스킬 데이터
 * @param {string|null} equippedCostumeId - 장착된 코스튬 ID
 * @returns {Object} 최종 유효 스킬 (name, vfx, icon, damageMult 적용됨)
 */
export function getEffectiveSkill(baseSkill, equippedCostumeId) {
  if (!baseSkill) return null;

  // 기본 스킬 복사 (원본 보존)
  const effectiveSkill = { ...baseSkill, damageMult: 1.0 };

  // 코스튬이 없으면 기본 스킬 그대로 반환
  if (!equippedCostumeId) {
    return effectiveSkill;
  }

  // 코스튬 오버라이드 확인
  const override = getSkillOverride(equippedCostumeId, baseSkill.id);
  if (!override) {
    return effectiveSkill;
  }

  // 오버라이드 적용 (name, vfx, icon, damageMult)
  return {
    ...effectiveSkill,
    name: override.name || effectiveSkill.name,
    vfx: override.vfx || effectiveSkill.vfx,
    icon: override.icon || effectiveSkill.icon,
    damageMult: override.damageMult || 1.0,
    isOverridden: true,
    originalName: baseSkill.name
  };
}

/**
 * 헌터의 모든 유효 스킬 목록 가져오기
 * @param {Array} baseSkills - 해금된 기본 스킬 목록
 * @param {string|null} equippedCostumeId - 장착된 코스튬 ID
 * @returns {Array} 유효 스킬 목록
 */
export function getAllEffectiveSkills(baseSkills, equippedCostumeId) {
  return baseSkills.map(skill => getEffectiveSkill(skill, equippedCostumeId));
}

/**
 * 코스튬이 변경하는 스킬 목록 미리보기
 * @param {string} costumeId
 * @returns {Array} 변경되는 스킬 목록 [{ baseSkillId, override }]
 */
export function previewCostumeSkillChanges(costumeId) {
  const costume = getCostumeById(costumeId);
  if (!costume || !costume.skillOverrides) return [];

  return Object.entries(costume.skillOverrides).map(([skillId, override]) => ({
    baseSkillId: skillId,
    override
  }));
}
