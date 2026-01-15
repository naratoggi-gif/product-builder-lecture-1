// The Hunter System - 스킬 시스템
// Two-Layer System:
// Layer 1: Base Skills (기본 스킬)
// Layer 2: Costume Overrides (코스튬이 스킬을 변형)

// ========== BASE SKILLS (Layer 1) ==========
// 모든 헌터가 기본으로 사용하는 스킬
export const BASE_SKILLS = {
  basicBolt: {
    id: 'basicBolt',
    name: '마력탄',
    description: '기본적인 마력 공격',
    type: 'magic',
    damageType: 'magical',
    baseDamage: 10,
    statScaling: { INT: 2.0 },
    mpCost: 5,
    vfx: 'bolt_blue',
    icon: '⚡',
    unlockLevel: 1
  },
  basicSlash: {
    id: 'basicSlash',
    name: '베기',
    description: '기본적인 물리 베기',
    type: 'attack',
    damageType: 'physical',
    baseDamage: 15,
    statScaling: { STR: 2.5 },
    mpCost: 3,
    vfx: 'slash_white',
    icon: '⚔️',
    unlockLevel: 1
  },
  basicPunch: {
    id: 'basicPunch',
    name: '주먹',
    description: '기본적인 물리 타격',
    type: 'attack',
    damageType: 'physical',
    baseDamage: 12,
    statScaling: { STR: 2.0, WIL: 1.0 },
    mpCost: 2,
    vfx: 'punch_impact',
    icon: '👊',
    unlockLevel: 1
  },
  focusStrike: {
    id: 'focusStrike',
    name: '집중 일격',
    description: '집중력을 모아 정밀한 공격',
    type: 'attack',
    damageType: 'physical',
    baseDamage: 20,
    statScaling: { FOCUS: 3.0 },
    mpCost: 8,
    vfx: 'focus_slash',
    icon: '🎯',
    unlockLevel: 10
  },
  luckyStrike: {
    id: 'luckyStrike',
    name: '행운의 일격',
    description: '운에 따라 크리티컬 확률이 증가',
    type: 'attack',
    damageType: 'physical',
    baseDamage: 8,
    statScaling: { LUK: 2.5 },
    critBonus: 25,
    mpCost: 6,
    vfx: 'lucky_sparkle',
    icon: '🍀',
    unlockLevel: 10
  }
};

// 기본 스킬 가져오기
export function getBaseSkill(skillId) {
  return BASE_SKILLS[skillId] || null;
}

// 해금된 기본 스킬 목록
export function getUnlockedBaseSkills(hunterLevel) {
  return Object.values(BASE_SKILLS).filter(skill => hunterLevel >= skill.unlockLevel);
}

// 스킬 데미지 계산 (기본)
export function calculateSkillDamage(skill, hunterStats) {
  let damage = skill.baseDamage || 0;

  if (skill.statScaling) {
    for (const [stat, multiplier] of Object.entries(skill.statScaling)) {
      const statValue = hunterStats[stat] || 0;
      damage += statValue * multiplier;
    }
  }

  return Math.floor(damage);
}

// ========== EXTENDED SKILLS (기존 직업별 스킬) ==========
// 직업별 세분화된 스킬 (추후 확장용)
// classRequired: 해당 직업(들)만 배울 수 있음

export const SKILLS = {
  // ========================================
  // 공용 기본 스킬 (모든 직업)
  // ========================================
  basic_attack: {
    id: 'basic_attack',
    name: '기본 공격',
    description: '기본 공격으로 적을 공격한다.',
    type: 'attack',
    damageType: 'physical',
    multiplier: 1.0,
    mpCost: 0,
    unlockRequirements: { level: 1 },
    icon: 'sword'
  },

  defend: {
    id: 'defend',
    name: '방어 태세',
    description: '방어 자세를 취해 다음 턴 피해 50% 감소.',
    type: 'buff',
    mpCost: 5,
    effect: { type: 'buff', stat: 'damageReduction', value: 50, duration: 1 },
    unlockRequirements: { level: 1 },
    icon: 'shield'
  },

  // ========================================
  // 전사 계열 스킬
  // ========================================

  // --- 전사 기본 스킬 (1차) ---
  war_cry_basic: {
    id: 'war_cry_basic',
    name: '전투 함성',
    description: '기합을 질러 2턴간 공격력 +10%.',
    type: 'buff',
    mpCost: 8,
    effect: { type: 'buff', stat: 'attack', value: 10, duration: 2, isPercent: true },
    unlockRequirements: { level: 1, classRequired: ['warrior', 'berserker', 'guardian', 'barbarian'] },
    icon: 'megaphone'
  },

  shield_strike: {
    id: 'shield_strike',
    name: '방패 가격',
    description: '방패로 적을 가격해 120% 피해.',
    type: 'attack',
    damageType: 'physical',
    multiplier: 1.2,
    mpCost: 8,
    unlockRequirements: { level: 5, classRequired: ['warrior', 'berserker', 'guardian', 'barbarian'] },
    icon: 'shield'
  },

  power_strike: {
    id: 'power_strike',
    name: '강타',
    description: '강력한 일격으로 150% 피해.',
    type: 'attack',
    damageType: 'physical',
    multiplier: 1.5,
    mpCost: 12,
    unlockRequirements: { level: 8, strength: 15, classRequired: ['warrior', 'berserker', 'guardian', 'barbarian'] },
    icon: 'fist'
  },

  iron_will: {
    id: 'iron_will',
    name: '강철 의지',
    description: '3턴간 방어력 +30%.',
    type: 'buff',
    mpCost: 15,
    effect: { type: 'buff', stat: 'defense', value: 30, duration: 3, isPercent: true },
    unlockRequirements: { level: 12, vitality: 18, classRequired: ['warrior', 'berserker', 'guardian', 'barbarian'] },
    icon: 'castle'
  },

  war_cry: {
    id: 'war_cry',
    name: '전사의 함성',
    description: '3턴간 공격력 +25%.',
    type: 'buff',
    mpCost: 20,
    effect: { type: 'buff', stat: 'attack', value: 25, duration: 3, isPercent: true },
    unlockRequirements: { level: 20, strength: 25, classRequired: ['warrior', 'berserker', 'guardian', 'barbarian'] },
    icon: 'megaphone'
  },

  // --- 광전사 전용 스킬 (2차) ---
  berserk_rage: {
    id: 'berserk_rage',
    name: '광전사의 분노',
    description: 'HP 20% 소모, 3턴간 공격력 +50%.',
    type: 'buff',
    mpCost: 0,
    hpCost: 0.2,
    effect: { type: 'buff', stat: 'attack', value: 50, duration: 3, isPercent: true },
    unlockRequirements: { level: 30, classRequired: ['berserker'] },
    icon: 'fire'
  },

  blood_strike: {
    id: 'blood_strike',
    name: '피의 일격',
    description: 'HP 10% 소모, 200% 피해.',
    type: 'attack',
    damageType: 'physical',
    multiplier: 2.0,
    mpCost: 15,
    hpCost: 0.1,
    unlockRequirements: { level: 35, strength: 35, classRequired: ['berserker'] },
    icon: 'blood'
  },

  rampage: {
    id: 'rampage',
    name: '광란',
    description: '5회 연속 공격, 각 60% 피해.',
    type: 'attack',
    damageType: 'physical',
    multiplier: 0.6,
    hits: 5,
    mpCost: 30,
    unlockRequirements: { level: 45, strength: 45, classRequired: ['berserker'] },
    icon: 'swords'
  },

  // --- 워리어(가디언) 전용 스킬 (2차) ---
  shield_wall: {
    id: 'shield_wall',
    name: '방패의 벽',
    description: '3턴간 받는 피해 40% 감소.',
    type: 'buff',
    mpCost: 20,
    effect: { type: 'buff', stat: 'damageReduction', value: 40, duration: 3 },
    unlockRequirements: { level: 30, classRequired: ['guardian'] },
    icon: 'shield-wall'
  },

  taunt: {
    id: 'taunt',
    name: '도발',
    description: '적의 공격력을 20% 감소시킨다.',
    type: 'debuff',
    mpCost: 12,
    effect: { type: 'debuff', stat: 'attack', value: -20, duration: 3, isPercent: true },
    unlockRequirements: { level: 35, vitality: 35, classRequired: ['guardian'] },
    icon: 'angry'
  },

  fortress: {
    id: 'fortress',
    name: '요새화',
    description: '3턴간 방어력 +50%, 이동 불가.',
    type: 'buff',
    mpCost: 25,
    effect: { type: 'buff', stat: 'defense', value: 50, duration: 3, isPercent: true },
    unlockRequirements: { level: 45, vitality: 50, classRequired: ['guardian'] },
    icon: 'fortress'
  },

  // --- 바바리안 전용 스킬 (2차) ---
  savage_blow: {
    id: 'savage_blow',
    name: '야만의 일격',
    description: '180% 피해 + 고정 피해 30.',
    type: 'attack',
    damageType: 'physical',
    multiplier: 1.8,
    flatDamage: 30,
    mpCost: 18,
    unlockRequirements: { level: 30, classRequired: ['barbarian'] },
    icon: 'axe'
  },

  war_stomp: {
    id: 'war_stomp',
    name: '전쟁의 발구르기',
    description: '130% 피해, 20% 확률로 기절.',
    type: 'attack',
    damageType: 'physical',
    multiplier: 1.3,
    mpCost: 20,
    effect: { type: 'stun', chance: 20, duration: 1 },
    unlockRequirements: { level: 35, strength: 40, classRequired: ['barbarian'] },
    icon: 'stomp'
  },

  execute: {
    id: 'execute',
    name: '처형',
    description: '적 HP 30% 이하일 때 300% 피해.',
    type: 'attack',
    damageType: 'physical',
    multiplier: 3.0,
    executeThreshold: 0.3,
    mpCost: 35,
    unlockRequirements: { level: 45, strength: 50, classRequired: ['barbarian'] },
    icon: 'skull'
  },

  // ========================================
  // 검사 계열 스킬
  // ========================================

  // --- 검사 기본 스킬 (1차) ---
  quick_slash: {
    id: 'quick_slash',
    name: '속공',
    description: '빠른 베기로 110% 피해.',
    type: 'attack',
    damageType: 'physical',
    multiplier: 1.1,
    mpCost: 5,
    unlockRequirements: { level: 1, classRequired: ['swordsman', 'knight', 'iaido_master'] },
    icon: 'wind'
  },

  double_slash: {
    id: 'double_slash',
    name: '이연격',
    description: '2회 연속 베기, 각 90% 피해.',
    type: 'attack',
    damageType: 'physical',
    multiplier: 0.9,
    hits: 2,
    mpCost: 10,
    unlockRequirements: { level: 5, classRequired: ['swordsman', 'knight', 'iaido_master'] },
    icon: 'swords'
  },

  focus: {
    id: 'focus',
    name: '집중',
    description: '3턴간 크리티컬률 +15%.',
    type: 'buff',
    mpCost: 8,
    effect: { type: 'buff', stat: 'critRate', value: 15, duration: 3 },
    unlockRequirements: { level: 7, agility: 15, classRequired: ['swordsman', 'knight', 'iaido_master'] },
    icon: 'eye'
  },

  triple_slash: {
    id: 'triple_slash',
    name: '삼연격',
    description: '3회 연속 베기, 각 85% 피해.',
    type: 'attack',
    damageType: 'physical',
    multiplier: 0.85,
    hits: 3,
    mpCost: 18,
    unlockRequirements: { level: 12, agility: 20, classRequired: ['swordsman', 'knight', 'iaido_master'] },
    icon: 'swords'
  },

  blade_dance: {
    id: 'blade_dance',
    name: '검무',
    description: '4회 연속 공격, 각 75% 피해. 크리티컬률 +10%.',
    type: 'attack',
    damageType: 'physical',
    multiplier: 0.75,
    hits: 4,
    mpCost: 25,
    critBonus: 10,
    unlockRequirements: { level: 20, agility: 28, classRequired: ['swordsman', 'knight', 'iaido_master'] },
    icon: 'dance'
  },

  // --- 기사 전용 스킬 (2차) ---
  holy_slash: {
    id: 'holy_slash',
    name: '성스러운 일격',
    description: '신성한 힘을 담은 160% 피해.',
    type: 'attack',
    damageType: 'physical',
    multiplier: 1.6,
    mpCost: 15,
    unlockRequirements: { level: 30, classRequired: ['knight'] },
    icon: 'holy'
  },

  shield_bash: {
    id: 'shield_bash',
    name: '방패 강타',
    description: '130% 피해, 30% 확률로 기절.',
    type: 'attack',
    damageType: 'physical',
    multiplier: 1.3,
    mpCost: 18,
    effect: { type: 'stun', chance: 30, duration: 1 },
    unlockRequirements: { level: 35, strength: 30, classRequired: ['knight'] },
    icon: 'shield'
  },

  knights_honor: {
    id: 'knights_honor',
    name: '기사의 명예',
    description: '3턴간 공격력, 방어력 +20%.',
    type: 'buff',
    mpCost: 25,
    effect: [
      { type: 'buff', stat: 'attack', value: 20, duration: 3, isPercent: true },
      { type: 'buff', stat: 'defense', value: 20, duration: 3, isPercent: true }
    ],
    unlockRequirements: { level: 40, classRequired: ['knight'] },
    icon: 'crown'
  },

  holy_judgment: {
    id: 'holy_judgment',
    name: '성스러운 심판',
    description: '220% 피해, 언데드에게 추가 피해.',
    type: 'attack',
    damageType: 'physical',
    multiplier: 2.2,
    bonusVsUndead: 1.5,
    mpCost: 35,
    unlockRequirements: { level: 50, strength: 40, classRequired: ['knight'] },
    icon: 'judgment'
  },

  // --- 발도술사 전용 스킬 (2차) ---
  iaido_slash: {
    id: 'iaido_slash',
    name: '발도 일섬',
    description: '순간 발도로 180% 피해. 반드시 크리티컬.',
    type: 'attack',
    damageType: 'physical',
    multiplier: 1.8,
    guaranteedCrit: true,
    mpCost: 20,
    unlockRequirements: { level: 30, classRequired: ['iaido_master'] },
    icon: 'katana'
  },

  zantetsuken: {
    id: 'zantetsuken',
    name: '참철검',
    description: '적의 방어력을 무시하고 200% 피해.',
    type: 'attack',
    damageType: 'physical',
    multiplier: 2.0,
    ignoreDefense: true,
    mpCost: 28,
    unlockRequirements: { level: 38, agility: 40, classRequired: ['iaido_master'] },
    icon: 'blade'
  },

  flash_step: {
    id: 'flash_step',
    name: '섬광보',
    description: '3턴간 회피율 +30%, 크리티컬률 +20%.',
    type: 'buff',
    mpCost: 22,
    effect: [
      { type: 'buff', stat: 'dodgeRate', value: 30, duration: 3 },
      { type: 'buff', stat: 'critRate', value: 20, duration: 3 }
    ],
    unlockRequirements: { level: 42, agility: 45, classRequired: ['iaido_master'] },
    icon: 'lightning'
  },

  mugen_ryu: {
    id: 'mugen_ryu',
    name: '무겐류 오의',
    description: '7회 연속 베기, 각 70% 피해. 모두 크리티컬.',
    type: 'attack',
    damageType: 'physical',
    multiplier: 0.7,
    hits: 7,
    guaranteedCrit: true,
    mpCost: 50,
    unlockRequirements: { level: 55, agility: 55, classRequired: ['iaido_master'] },
    icon: 'ultimate'
  },

  // ========================================
  // 마법사 계열 스킬
  // ========================================

  // --- 마법사 기본 스킬 (1차) ---
  magic_bolt: {
    id: 'magic_bolt',
    name: '마력탄',
    description: '마력을 집중해 120% 마법 피해.',
    type: 'magic',
    damageType: 'magical',
    multiplier: 1.2,
    mpCost: 6,
    unlockRequirements: { level: 1, classRequired: ['mage', 'pyromancer', 'hydromancer', 'aeromancer', 'geomancer', 'alchemist', 'dark_mage', 'light_mage', 'electromancer'] },
    icon: 'sparkle'
  },

  mana_shield: {
    id: 'mana_shield',
    name: '마나 보호막',
    description: 'MP를 소모해 피해를 흡수하는 보호막 생성.',
    type: 'buff',
    mpCost: 15,
    effect: { type: 'shield', value: 50, duration: 3 },
    unlockRequirements: { level: 5, classRequired: ['mage', 'pyromancer', 'hydromancer', 'aeromancer', 'geomancer', 'alchemist', 'dark_mage', 'light_mage', 'electromancer'] },
    icon: 'shield-magic'
  },

  meditation: {
    id: 'meditation',
    name: '명상',
    description: '3턴간 매 턴 MP 10% 회복.',
    type: 'buff',
    mpCost: 5,
    effect: { type: 'mpRegen', value: 10, duration: 3, isPercent: true },
    unlockRequirements: { level: 8, intelligence: 15, classRequired: ['mage', 'pyromancer', 'hydromancer', 'aeromancer', 'geomancer', 'alchemist', 'dark_mage', 'light_mage', 'electromancer'] },
    icon: 'meditation'
  },

  arcane_blast: {
    id: 'arcane_blast',
    name: '비전 폭발',
    description: '순수 마력으로 160% 마법 피해.',
    type: 'magic',
    damageType: 'magical',
    multiplier: 1.6,
    mpCost: 18,
    unlockRequirements: { level: 15, intelligence: 22, classRequired: ['mage', 'pyromancer', 'hydromancer', 'aeromancer', 'geomancer', 'alchemist', 'dark_mage', 'light_mage', 'electromancer'] },
    icon: 'explosion'
  },

  // --- 화염 마법사 전용 스킬 (2차) ---
  fireball: {
    id: 'fireball',
    name: '화염구',
    description: '불덩이를 던져 150% 화염 피해.',
    type: 'magic',
    damageType: 'magical',
    element: 'fire',
    multiplier: 1.5,
    mpCost: 14,
    unlockRequirements: { level: 30, classRequired: ['pyromancer'] },
    icon: 'fire'
  },

  inferno: {
    id: 'inferno',
    name: '인페르노',
    description: '180% 화염 피해 + 3턴 화상 (매 턴 20 피해).',
    type: 'magic',
    damageType: 'magical',
    element: 'fire',
    multiplier: 1.8,
    mpCost: 22,
    effect: { type: 'dot', damage: 20, duration: 3 },
    unlockRequirements: { level: 38, intelligence: 40, classRequired: ['pyromancer'] },
    icon: 'inferno'
  },

  fire_storm: {
    id: 'fire_storm',
    name: '화염 폭풍',
    description: '220% 화염 피해.',
    type: 'magic',
    damageType: 'magical',
    element: 'fire',
    multiplier: 2.2,
    mpCost: 35,
    unlockRequirements: { level: 45, intelligence: 48, classRequired: ['pyromancer'] },
    icon: 'firestorm'
  },

  phoenix_flame: {
    id: 'phoenix_flame',
    name: '불사조의 화염',
    description: '300% 화염 피해. HP 30% 이하시 자신도 회복.',
    type: 'magic',
    damageType: 'magical',
    element: 'fire',
    multiplier: 3.0,
    mpCost: 50,
    selfHealThreshold: 0.3,
    unlockRequirements: { level: 55, intelligence: 58, classRequired: ['pyromancer'] },
    icon: 'phoenix'
  },

  // --- 수(水) 마법사 전용 스킬 (2차) ---
  water_bolt: {
    id: 'water_bolt',
    name: '물의 화살',
    description: '140% 수속성 마법 피해.',
    type: 'magic',
    damageType: 'magical',
    element: 'water',
    multiplier: 1.4,
    mpCost: 12,
    unlockRequirements: { level: 30, classRequired: ['hydromancer'] },
    icon: 'water'
  },

  healing_rain: {
    id: 'healing_rain',
    name: '치유의 비',
    description: '3턴간 매 턴 HP 15% 회복.',
    type: 'buff',
    mpCost: 25,
    effect: { type: 'regen', value: 15, duration: 3, isPercent: true },
    unlockRequirements: { level: 35, intelligence: 35, classRequired: ['hydromancer'] },
    icon: 'rain'
  },

  tidal_wave: {
    id: 'tidal_wave',
    name: '해일',
    description: '200% 수속성 피해, 적 공격력 -15%.',
    type: 'magic',
    damageType: 'magical',
    element: 'water',
    multiplier: 2.0,
    mpCost: 30,
    effect: { type: 'debuff', stat: 'attack', value: -15, duration: 2, isPercent: true },
    unlockRequirements: { level: 42, intelligence: 45, classRequired: ['hydromancer'] },
    icon: 'wave'
  },

  ice_prison: {
    id: 'ice_prison',
    name: '얼음 감옥',
    description: '150% 피해, 50% 확률로 2턴 빙결.',
    type: 'magic',
    damageType: 'magical',
    element: 'water',
    multiplier: 1.5,
    mpCost: 35,
    effect: { type: 'freeze', chance: 50, duration: 2 },
    unlockRequirements: { level: 50, intelligence: 52, classRequired: ['hydromancer'] },
    icon: 'ice'
  },

  // --- 바람 마법사 전용 스킬 (2차) ---
  air_slash: {
    id: 'air_slash',
    name: '풍인참',
    description: '바람의 칼날로 145% 피해.',
    type: 'magic',
    damageType: 'magical',
    element: 'wind',
    multiplier: 1.45,
    mpCost: 12,
    unlockRequirements: { level: 30, classRequired: ['aeromancer'] },
    icon: 'wind'
  },

  wind_barrier: {
    id: 'wind_barrier',
    name: '바람의 장벽',
    description: '3턴간 회피율 +25%.',
    type: 'buff',
    mpCost: 18,
    effect: { type: 'buff', stat: 'dodgeRate', value: 25, duration: 3 },
    unlockRequirements: { level: 35, agility: 35, classRequired: ['aeromancer'] },
    icon: 'barrier'
  },

  hurricane: {
    id: 'hurricane',
    name: '허리케인',
    description: '190% 풍속성 피해, 적 회피율 -20%.',
    type: 'magic',
    damageType: 'magical',
    element: 'wind',
    multiplier: 1.9,
    mpCost: 28,
    effect: { type: 'debuff', stat: 'dodgeRate', value: -20, duration: 2 },
    unlockRequirements: { level: 42, intelligence: 42, classRequired: ['aeromancer'] },
    icon: 'hurricane'
  },

  tempest: {
    id: 'tempest',
    name: '템페스트',
    description: '5회 공격, 각 60% 피해. 빠른 연속 공격.',
    type: 'magic',
    damageType: 'magical',
    element: 'wind',
    multiplier: 0.6,
    hits: 5,
    mpCost: 40,
    unlockRequirements: { level: 50, intelligence: 50, agility: 45, classRequired: ['aeromancer'] },
    icon: 'tempest'
  },

  // --- 대지 마법사 전용 스킬 (2차) ---
  stone_spear: {
    id: 'stone_spear',
    name: '암석 창',
    description: '대지에서 돌창을 소환해 155% 피해.',
    type: 'magic',
    damageType: 'magical',
    element: 'earth',
    multiplier: 1.55,
    mpCost: 14,
    unlockRequirements: { level: 30, classRequired: ['geomancer'] },
    icon: 'stone'
  },

  earth_armor: {
    id: 'earth_armor',
    name: '대지의 갑옷',
    description: '3턴간 방어력 +40%.',
    type: 'buff',
    mpCost: 20,
    effect: { type: 'buff', stat: 'defense', value: 40, duration: 3, isPercent: true },
    unlockRequirements: { level: 35, vitality: 30, classRequired: ['geomancer'] },
    icon: 'armor'
  },

  earthquake: {
    id: 'earthquake',
    name: '지진',
    description: '200% 지속성 피해, 25% 확률로 기절.',
    type: 'magic',
    damageType: 'magical',
    element: 'earth',
    multiplier: 2.0,
    mpCost: 32,
    effect: { type: 'stun', chance: 25, duration: 1 },
    unlockRequirements: { level: 45, intelligence: 45, classRequired: ['geomancer'] },
    icon: 'earthquake'
  },

  gaia_blessing: {
    id: 'gaia_blessing',
    name: '가이아의 축복',
    description: 'HP 30% 회복, 방어력 +30% (3턴).',
    type: 'heal',
    mpCost: 40,
    healPercent: 0.3,
    effect: { type: 'buff', stat: 'defense', value: 30, duration: 3, isPercent: true },
    unlockRequirements: { level: 52, intelligence: 50, classRequired: ['geomancer'] },
    icon: 'gaia'
  },

  // --- 금(金) 마법사/연금술사 전용 스킬 (2차) ---
  metal_shard: {
    id: 'metal_shard',
    name: '금속 파편',
    description: '금속 파편을 발사해 140% 피해.',
    type: 'magic',
    damageType: 'magical',
    element: 'metal',
    multiplier: 1.4,
    mpCost: 12,
    unlockRequirements: { level: 30, classRequired: ['alchemist'] },
    icon: 'metal'
  },

  transmute: {
    id: 'transmute',
    name: '연성',
    description: 'MP 20 소모, HP 25% 회복.',
    type: 'heal',
    mpCost: 20,
    healPercent: 0.25,
    unlockRequirements: { level: 35, classRequired: ['alchemist'] },
    icon: 'alchemy'
  },

  metal_storm: {
    id: 'metal_storm',
    name: '금속 폭풍',
    description: '무수한 금속 파편으로 190% 피해.',
    type: 'magic',
    damageType: 'magical',
    element: 'metal',
    multiplier: 1.9,
    mpCost: 28,
    unlockRequirements: { level: 42, intelligence: 42, classRequired: ['alchemist'] },
    icon: 'storm'
  },

  golden_barrier: {
    id: 'golden_barrier',
    name: '황금 방벽',
    description: '순금 방벽으로 3턴간 피해 35% 감소.',
    type: 'buff',
    mpCost: 30,
    effect: { type: 'buff', stat: 'damageReduction', value: 35, duration: 3 },
    unlockRequirements: { level: 48, classRequired: ['alchemist'] },
    icon: 'gold'
  },

  philosophers_stone: {
    id: 'philosophers_stone',
    name: '현자의 돌',
    description: 'HP와 MP 모두 40% 회복.',
    type: 'heal',
    mpCost: 50,
    healPercent: 0.4,
    mpHealPercent: 0.4,
    unlockRequirements: { level: 55, intelligence: 55, classRequired: ['alchemist'] },
    icon: 'philosopher'
  },

  // --- 암흑 마법사 전용 스킬 (2차) ---
  shadow_bolt: {
    id: 'shadow_bolt',
    name: '암흑탄',
    description: '어둠의 힘으로 150% 암속성 피해.',
    type: 'magic',
    damageType: 'magical',
    element: 'dark',
    multiplier: 1.5,
    mpCost: 14,
    unlockRequirements: { level: 30, classRequired: ['dark_mage'] },
    icon: 'shadow'
  },

  life_drain: {
    id: 'life_drain',
    name: '생명력 흡수',
    description: '130% 피해, 피해량의 50%를 HP로 회복.',
    type: 'magic',
    damageType: 'magical',
    element: 'dark',
    multiplier: 1.3,
    mpCost: 18,
    lifesteal: 0.5,
    unlockRequirements: { level: 35, intelligence: 35, classRequired: ['dark_mage'] },
    icon: 'drain'
  },

  curse: {
    id: 'curse',
    name: '저주',
    description: '적의 모든 스탯 -15% (3턴).',
    type: 'debuff',
    mpCost: 25,
    effect: { type: 'curse', value: -15, duration: 3, isPercent: true },
    unlockRequirements: { level: 42, intelligence: 45, classRequired: ['dark_mage'] },
    icon: 'curse'
  },

  dark_void: {
    id: 'dark_void',
    name: '암흑 공허',
    description: '250% 암속성 피해, 적 HP 10% 추가 감소.',
    type: 'magic',
    damageType: 'magical',
    element: 'dark',
    multiplier: 2.5,
    percentDamage: 0.1,
    mpCost: 45,
    unlockRequirements: { level: 52, intelligence: 55, classRequired: ['dark_mage'] },
    icon: 'void'
  },

  // --- 빛 마법사 전용 스킬 (2차) ---
  holy_light: {
    id: 'holy_light',
    name: '성광',
    description: '성스러운 빛으로 145% 광속성 피해.',
    type: 'magic',
    damageType: 'magical',
    element: 'light',
    multiplier: 1.45,
    mpCost: 14,
    unlockRequirements: { level: 30, classRequired: ['light_mage'] },
    icon: 'light'
  },

  heal: {
    id: 'heal',
    name: '치유',
    description: 'HP를 (지능 x 3) 만큼 회복.',
    type: 'heal',
    mpCost: 15,
    healFormula: (stats) => stats.intelligence * 3,
    unlockRequirements: { level: 32, classRequired: ['light_mage'] },
    icon: 'heart'
  },

  blessing: {
    id: 'blessing',
    name: '축복',
    description: '3턴간 모든 스탯 +10%.',
    type: 'buff',
    mpCost: 28,
    effect: { type: 'bless', value: 10, duration: 3, isPercent: true },
    unlockRequirements: { level: 40, intelligence: 42, classRequired: ['light_mage'] },
    icon: 'bless'
  },

  greater_heal: {
    id: 'greater_heal',
    name: '대치유',
    description: 'HP를 (지능 x 5) 만큼 회복.',
    type: 'heal',
    mpCost: 35,
    healFormula: (stats) => stats.intelligence * 5,
    unlockRequirements: { level: 45, intelligence: 48, classRequired: ['light_mage'] },
    icon: 'heart-pulse'
  },

  judgment: {
    id: 'judgment',
    name: '심판',
    description: '240% 광속성 피해, 언데드에게 2배.',
    type: 'magic',
    damageType: 'magical',
    element: 'light',
    multiplier: 2.4,
    bonusVsUndead: 2.0,
    mpCost: 42,
    unlockRequirements: { level: 52, intelligence: 55, classRequired: ['light_mage'] },
    icon: 'judgment'
  },

  // --- 전기 마법사 전용 스킬 (2차) ---
  thunder_strike: {
    id: 'thunder_strike',
    name: '낙뢰',
    description: '번개를 내려 160% 뇌속성 피해.',
    type: 'magic',
    damageType: 'magical',
    element: 'lightning',
    multiplier: 1.6,
    mpCost: 15,
    unlockRequirements: { level: 30, classRequired: ['electromancer'] },
    icon: 'lightning'
  },

  static_shock: {
    id: 'static_shock',
    name: '정전기 충격',
    description: '120% 피해, 40% 확률로 마비.',
    type: 'magic',
    damageType: 'magical',
    element: 'lightning',
    multiplier: 1.2,
    mpCost: 18,
    effect: { type: 'stun', chance: 40, duration: 1 },
    unlockRequirements: { level: 36, intelligence: 38, classRequired: ['electromancer'] },
    icon: 'shock'
  },

  chain_lightning: {
    id: 'chain_lightning',
    name: '연쇄 번개',
    description: '3회 연속 번개, 각 80% 피해.',
    type: 'magic',
    damageType: 'magical',
    element: 'lightning',
    multiplier: 0.8,
    hits: 3,
    mpCost: 28,
    unlockRequirements: { level: 42, intelligence: 45, classRequired: ['electromancer'] },
    icon: 'chain'
  },

  plasma_storm: {
    id: 'plasma_storm',
    name: '플라즈마 폭풍',
    description: '270% 뇌속성 피해, 60% 확률로 마비.',
    type: 'magic',
    damageType: 'magical',
    element: 'lightning',
    multiplier: 2.7,
    mpCost: 48,
    effect: { type: 'stun', chance: 60, duration: 1 },
    unlockRequirements: { level: 55, intelligence: 58, classRequired: ['electromancer'] },
    icon: 'plasma'
  },

  // ========================================
  // 소환사 계열 스킬
  // ========================================

  // --- 소환사 기본 스킬 (1차) ---
  summon_sprite: {
    id: 'summon_sprite',
    name: '요정 소환',
    description: '작은 요정을 소환해 3턴간 매 턴 70% 추가 피해.',
    type: 'summon',
    damageType: 'magical',
    multiplier: 0.7,
    duration: 3,
    mpCost: 12,
    unlockRequirements: { level: 1, classRequired: ['summoner', 'elementalist', 'necromancer', 'weapon_summoner', 'beast_tamer', 'demon_contractor', 'celestial_summoner'] },
    icon: 'fairy'
  },

  spirit_bond: {
    id: 'spirit_bond',
    name: '영혼의 유대',
    description: '소환수 공격력 +20% (3턴).',
    type: 'buff',
    mpCost: 10,
    effect: { type: 'buff', stat: 'summonDamage', value: 20, duration: 3, isPercent: true },
    unlockRequirements: { level: 5, classRequired: ['summoner', 'elementalist', 'necromancer', 'weapon_summoner', 'beast_tamer', 'demon_contractor', 'celestial_summoner'] },
    icon: 'bond'
  },

  summon_golem: {
    id: 'summon_golem',
    name: '골렘 소환',
    description: '돌 골렘을 소환해 3턴간 피해 흡수.',
    type: 'summon',
    summonType: 'tank',
    duration: 3,
    mpCost: 20,
    unlockRequirements: { level: 12, intelligence: 18, classRequired: ['summoner', 'elementalist', 'necromancer', 'weapon_summoner', 'beast_tamer', 'demon_contractor', 'celestial_summoner'] },
    icon: 'golem'
  },

  // --- 정령사 전용 스킬 (2차) ---
  summon_fire_elemental: {
    id: 'summon_fire_elemental',
    name: '화염 정령 소환',
    description: '화염 정령 소환. 4턴간 매 턴 100% 화염 피해.',
    type: 'summon',
    damageType: 'magical',
    element: 'fire',
    multiplier: 1.0,
    duration: 4,
    mpCost: 25,
    unlockRequirements: { level: 30, classRequired: ['elementalist'] },
    icon: 'fire-elemental'
  },

  summon_water_elemental: {
    id: 'summon_water_elemental',
    name: '물 정령 소환',
    description: '물 정령 소환. 4턴간 매 턴 HP 10% 회복.',
    type: 'summon',
    summonType: 'healer',
    healPercent: 0.1,
    duration: 4,
    mpCost: 25,
    unlockRequirements: { level: 35, classRequired: ['elementalist'] },
    icon: 'water-elemental'
  },

  elemental_fusion: {
    id: 'elemental_fusion',
    name: '정령 융합',
    description: '모든 정령을 융합해 280% 원소 피해.',
    type: 'magic',
    damageType: 'magical',
    multiplier: 2.8,
    mpCost: 45,
    unlockRequirements: { level: 50, intelligence: 52, classRequired: ['elementalist'] },
    icon: 'fusion'
  },

  // --- 네크로맨서 전용 스킬 (2차) ---
  raise_skeleton: {
    id: 'raise_skeleton',
    name: '해골 소환',
    description: '해골 전사 소환. 4턴간 매 턴 90% 물리 피해.',
    type: 'summon',
    damageType: 'physical',
    multiplier: 0.9,
    duration: 4,
    mpCost: 20,
    unlockRequirements: { level: 30, classRequired: ['necromancer'] },
    icon: 'skeleton'
  },

  summon_ghost: {
    id: 'summon_ghost',
    name: '유령 소환',
    description: '유령 소환. 3턴간 적 공격력 -20%.',
    type: 'summon',
    summonType: 'debuffer',
    effect: { type: 'debuff', stat: 'attack', value: -20, duration: 3, isPercent: true },
    mpCost: 22,
    unlockRequirements: { level: 38, classRequired: ['necromancer'] },
    icon: 'ghost'
  },

  soul_drain: {
    id: 'soul_drain',
    name: '영혼 흡수',
    description: '150% 암속성 피해, 피해량의 40% HP 회복.',
    type: 'magic',
    damageType: 'magical',
    element: 'dark',
    multiplier: 1.5,
    lifesteal: 0.4,
    mpCost: 28,
    unlockRequirements: { level: 42, classRequired: ['necromancer'] },
    icon: 'soul'
  },

  army_of_dead: {
    id: 'army_of_dead',
    name: '죽은 자의 군단',
    description: '언데드 군단 소환. 5턴간 매 턴 150% 피해.',
    type: 'summon',
    damageType: 'physical',
    multiplier: 1.5,
    duration: 5,
    mpCost: 50,
    unlockRequirements: { level: 55, intelligence: 55, classRequired: ['necromancer'] },
    icon: 'army'
  },

  // --- 무기 소환사 전용 스킬 (2차) ---
  summon_sword: {
    id: 'summon_sword',
    name: '마검 소환',
    description: '마법 검을 소환해 4턴간 매 턴 95% 피해.',
    type: 'summon',
    damageType: 'physical',
    multiplier: 0.95,
    duration: 4,
    mpCost: 18,
    unlockRequirements: { level: 30, classRequired: ['weapon_summoner'] },
    icon: 'magic-sword'
  },

  summon_spear: {
    id: 'summon_spear',
    name: '마창 소환',
    description: '마법 창을 소환해 130% 관통 피해.',
    type: 'summon',
    damageType: 'physical',
    multiplier: 1.3,
    ignoreDefense: true,
    duration: 1,
    mpCost: 22,
    unlockRequirements: { level: 38, classRequired: ['weapon_summoner'] },
    icon: 'spear'
  },

  blade_storm: {
    id: 'blade_storm',
    name: '검의 폭풍',
    description: '무수한 검을 소환해 6회 공격, 각 50% 피해.',
    type: 'summon',
    damageType: 'physical',
    multiplier: 0.5,
    hits: 6,
    mpCost: 35,
    unlockRequirements: { level: 45, classRequired: ['weapon_summoner'] },
    icon: 'blade-storm'
  },

  legendary_armory: {
    id: 'legendary_armory',
    name: '전설의 무기고',
    description: '전설 무기들을 소환. 5턴간 매 턴 180% 피해.',
    type: 'summon',
    damageType: 'physical',
    multiplier: 1.8,
    duration: 5,
    mpCost: 55,
    unlockRequirements: { level: 55, strength: 40, intelligence: 50, classRequired: ['weapon_summoner'] },
    icon: 'armory'
  },

  // --- 몬스터 테이머 전용 스킬 (2차) ---
  summon_wolf: {
    id: 'summon_wolf',
    name: '늑대 소환',
    description: '전투 늑대 소환. 4턴간 매 턴 85% 피해.',
    type: 'summon',
    damageType: 'physical',
    multiplier: 0.85,
    duration: 4,
    mpCost: 18,
    unlockRequirements: { level: 30, classRequired: ['beast_tamer'] },
    icon: 'wolf'
  },

  beast_rage: {
    id: 'beast_rage',
    name: '야수의 분노',
    description: '소환수 공격력 +40% (3턴).',
    type: 'buff',
    mpCost: 20,
    effect: { type: 'buff', stat: 'summonDamage', value: 40, duration: 3, isPercent: true },
    unlockRequirements: { level: 36, classRequired: ['beast_tamer'] },
    icon: 'rage'
  },

  summon_drake: {
    id: 'summon_drake',
    name: '드레이크 소환',
    description: '어린 용 소환. 4턴간 매 턴 120% 화염 피해.',
    type: 'summon',
    damageType: 'magical',
    element: 'fire',
    multiplier: 1.2,
    duration: 4,
    mpCost: 35,
    unlockRequirements: { level: 45, classRequired: ['beast_tamer'] },
    icon: 'drake'
  },

  alpha_command: {
    id: 'alpha_command',
    name: '군주의 명령',
    description: '모든 소환수가 동시 공격. 250% 피해.',
    type: 'summon',
    damageType: 'physical',
    multiplier: 2.5,
    mpCost: 50,
    unlockRequirements: { level: 55, classRequired: ['beast_tamer'] },
    icon: 'alpha'
  },

  // --- 악마 계약자 전용 스킬 (2차) ---
  summon_imp: {
    id: 'summon_imp',
    name: '임프 소환',
    description: '작은 악마 소환. 3턴간 매 턴 100% 암속성 피해.',
    type: 'summon',
    damageType: 'magical',
    element: 'dark',
    multiplier: 1.0,
    duration: 3,
    mpCost: 18,
    unlockRequirements: { level: 30, classRequired: ['demon_contractor'] },
    icon: 'imp'
  },

  demonic_pact: {
    id: 'demonic_pact',
    name: '악마의 계약',
    description: 'HP 15% 소모, 4턴간 공격력 +50%.',
    type: 'buff',
    hpCost: 0.15,
    mpCost: 10,
    effect: { type: 'buff', stat: 'attack', value: 50, duration: 4, isPercent: true },
    unlockRequirements: { level: 38, classRequired: ['demon_contractor'] },
    icon: 'pact'
  },

  summon_demon: {
    id: 'summon_demon',
    name: '악마 소환',
    description: '상급 악마 소환. 4턴간 매 턴 150% 암속성 피해.',
    type: 'summon',
    damageType: 'magical',
    element: 'dark',
    multiplier: 1.5,
    duration: 4,
    mpCost: 40,
    unlockRequirements: { level: 48, classRequired: ['demon_contractor'] },
    icon: 'demon'
  },

  infernal_gate: {
    id: 'infernal_gate',
    name: '지옥문',
    description: 'HP 25% 소모, 마왕 소환. 300% 암속성 피해.',
    type: 'summon',
    damageType: 'magical',
    element: 'dark',
    multiplier: 3.0,
    hpCost: 0.25,
    mpCost: 50,
    unlockRequirements: { level: 58, classRequired: ['demon_contractor'] },
    icon: 'gate'
  },

  // --- 천사 소환사 전용 스킬 (2차) ---
  summon_cherub: {
    id: 'summon_cherub',
    name: '케루빔 소환',
    description: '작은 천사 소환. 3턴간 매 턴 HP 12% 회복.',
    type: 'summon',
    summonType: 'healer',
    healPercent: 0.12,
    duration: 3,
    mpCost: 20,
    unlockRequirements: { level: 30, classRequired: ['celestial_summoner'] },
    icon: 'cherub'
  },

  divine_shield: {
    id: 'divine_shield',
    name: '신성한 보호막',
    description: '3턴간 피해 30% 감소, HP 5% 회복.',
    type: 'buff',
    mpCost: 25,
    effect: [
      { type: 'buff', stat: 'damageReduction', value: 30, duration: 3 },
      { type: 'regen', value: 5, duration: 3, isPercent: true }
    ],
    unlockRequirements: { level: 38, classRequired: ['celestial_summoner'] },
    icon: 'divine-shield'
  },

  summon_archangel: {
    id: 'summon_archangel',
    name: '대천사 소환',
    description: '대천사 소환. 4턴간 매 턴 130% 광속성 피해 + 회복.',
    type: 'summon',
    damageType: 'magical',
    element: 'light',
    multiplier: 1.3,
    healPercent: 0.08,
    duration: 4,
    mpCost: 42,
    unlockRequirements: { level: 48, classRequired: ['celestial_summoner'] },
    icon: 'archangel'
  },

  heavenly_chorus: {
    id: 'heavenly_chorus',
    name: '천상의 합창',
    description: '천사 군단 소환. 260% 광속성 피해 + HP 전체 회복.',
    type: 'summon',
    damageType: 'magical',
    element: 'light',
    multiplier: 2.6,
    fullHeal: true,
    mpCost: 60,
    unlockRequirements: { level: 58, classRequired: ['celestial_summoner'] },
    icon: 'chorus'
  }
};

// 스킬 해금 가능 여부 확인
export function canUnlockSkill(skillId, character) {
  const skill = SKILLS[skillId];
  if (!skill) return false;

  const req = skill.unlockRequirements;

  // 레벨 확인
  if (req.level && character.level < req.level) return false;

  // 스탯 확인
  if (req.strength && character.stats.strength < req.strength) return false;
  if (req.vitality && character.stats.vitality < req.vitality) return false;
  if (req.intelligence && character.stats.intelligence < req.intelligence) return false;
  if (req.agility && character.stats.agility < req.agility) return false;

  // 직업 요구사항 확인 (필수)
  if (req.classRequired && req.classRequired.length > 0) {
    const characterClasses = getCharacterClassTree(character);
    const hasRequiredClass = req.classRequired.some(cls => characterClasses.includes(cls));
    if (!hasRequiredClass) return false;
  }

  return true;
}

// 캐릭터의 직업 계열 확인 (현재 직업 + 이전 직업들)
function getCharacterClassTree(character) {
  if (!character.classId) return [];

  const classes = [character.classId];

  // 직업 히스토리가 있으면 추가 (1차 직업 포함)
  if (character.classHistory && character.classHistory.length > 0) {
    classes.push(...character.classHistory);
  }

  return classes;
}

// 해금 가능한 모든 스킬 반환 (해당 직업만)
export function getUnlockableSkills(character) {
  return Object.values(SKILLS).filter(skill =>
    canUnlockSkill(skill.id, character) &&
    !character.unlockedSkills.includes(skill.id)
  );
}

// 해당 직업이 배울 수 있는 모든 스킬 반환
export function getSkillsForClass(classId) {
  return Object.values(SKILLS).filter(skill => {
    const req = skill.unlockRequirements;
    // 공용 스킬 (classRequired 없음)
    if (!req.classRequired) return true;
    // 해당 직업용 스킬
    return req.classRequired.includes(classId);
  });
}

// 직업별 스킬 트리 반환 (UI용)
export function getSkillTreeForCharacter(character) {
  const characterClasses = getCharacterClassTree(character);

  return Object.values(SKILLS).filter(skill => {
    const req = skill.unlockRequirements;
    // 공용 스킬
    if (!req.classRequired) return true;
    // 캐릭터 직업 계열 스킬
    return req.classRequired.some(cls => characterClasses.includes(cls));
  });
}
