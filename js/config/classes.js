// 직업 시스템 설정
// 직업 트리: 기본 직업(1차) → 전문화 직업(2차) → 마스터 직업(3차)

// ===== 직업 계층 =====
export const CLASS_TIERS = {
  BASE: { tier: 1, name: '기본', requiredLevel: 1 },
  ADVANCED: { tier: 2, name: '전문화', requiredLevel: 30 },
  MASTER: { tier: 3, name: '마스터', requiredLevel: 70 }
};

// ===== 기본 직업 (1차) =====
export const BASE_CLASSES = {
  warrior: {
    id: 'warrior',
    name: '전사',
    tier: 1,
    description: '강인한 체력과 물리 공격력을 가진 근접 전투의 달인.',
    icon: '🛡️',
    statBonus: { strength: 3, vitality: 5, intelligence: 0, agility: 2 },
    growthWeights: { strength: 0.35, vitality: 0.35, intelligence: 0.1, agility: 0.2 },
    combatModifiers: { hpBonus: 1.2, defenseBonus: 1.15, attackBonus: 1.1 },
    startingSkills: ['basic_attack', 'defend', 'war_cry_basic'],
    advancedClasses: ['berserker', 'guardian', 'barbarian']
  },

  swordsman: {
    id: 'swordsman',
    name: '검사',
    tier: 1,
    description: '검술에 정통한 기술형 전투원. 크리티컬과 연속기에 특화.',
    icon: '⚔️',
    statBonus: { strength: 4, vitality: 2, intelligence: 1, agility: 3 },
    growthWeights: { strength: 0.3, vitality: 0.2, intelligence: 0.1, agility: 0.4 },
    combatModifiers: { critRateBonus: 1.3, critDamageBonus: 1.2, attackBonus: 1.05 },
    startingSkills: ['basic_attack', 'defend', 'quick_slash'],
    advancedClasses: ['knight', 'iaido_master']
  },

  mage: {
    id: 'mage',
    name: '마법사',
    tier: 1,
    description: '마나를 다루어 강력한 마법을 시전하는 지혜의 수호자.',
    icon: '🔮',
    statBonus: { strength: 0, vitality: 2, intelligence: 6, agility: 2 },
    growthWeights: { strength: 0.1, vitality: 0.2, intelligence: 0.5, agility: 0.2 },
    combatModifiers: { mpBonus: 1.3, magicAttackBonus: 1.25, hpBonus: 0.9 },
    startingSkills: ['basic_attack', 'defend', 'magic_bolt'],
    advancedClasses: ['pyromancer', 'hydromancer', 'aeromancer', 'geomancer',
                       'alchemist', 'dark_mage', 'light_mage', 'electromancer']
  },

  summoner: {
    id: 'summoner',
    name: '소환사',
    tier: 1,
    description: '다른 존재를 불러내어 싸우는 신비로운 계약자.',
    icon: '📜',
    statBonus: { strength: 1, vitality: 2, intelligence: 5, agility: 2 },
    growthWeights: { strength: 0.1, vitality: 0.25, intelligence: 0.45, agility: 0.2 },
    combatModifiers: { mpBonus: 1.2, summonBonus: 1.0, magicAttackBonus: 1.1 },
    startingSkills: ['basic_attack', 'defend', 'summon_sprite'],
    advancedClasses: ['elementalist', 'necromancer', 'weapon_summoner',
                       'beast_tamer', 'demon_contractor', 'celestial_summoner']
  }
};

// ===== 전문화 직업 (2차) =====
export const ADVANCED_CLASSES = {
  // === 전사 계열 ===
  berserker: {
    id: 'berserker',
    name: '광전사',
    tier: 2,
    baseClass: 'warrior',
    description: '분노를 힘으로 바꾸는 광폭한 전사. 피해를 입을수록 강해진다.',
    icon: '🔥',
    statBonus: { strength: 8, vitality: 3, intelligence: 0, agility: 4 },
    growthWeights: { strength: 0.45, vitality: 0.25, intelligence: 0.05, agility: 0.25 },
    combatModifiers: { attackBonus: 1.35, critDamageBonus: 1.25, defenseBonus: 0.85 },
    passive: { id: 'rage', name: '분노', description: 'HP가 낮을수록 공격력 증가 (최대 +50%)' },
    specialSkills: ['berserk_rage', 'blood_strike', 'rampage']
  },

  guardian: {
    id: 'guardian',
    name: '워리어',
    tier: 2,
    baseClass: 'warrior',
    description: '철벽 같은 방어력으로 아군을 수호하는 방패의 화신.',
    icon: '🛡️',
    statBonus: { strength: 4, vitality: 10, intelligence: 1, agility: 0 },
    growthWeights: { strength: 0.25, vitality: 0.5, intelligence: 0.1, agility: 0.15 },
    combatModifiers: { hpBonus: 1.4, defenseBonus: 1.35, attackBonus: 1.0 },
    passive: { id: 'iron_body', name: '강철 육체', description: '받는 피해 10% 감소' },
    specialSkills: ['shield_wall', 'taunt', 'fortress']
  },

  barbarian: {
    id: 'barbarian',
    name: '바바리안',
    tier: 2,
    baseClass: 'warrior',
    description: '야만적인 힘으로 적을 압도하는 거친 전사.',
    icon: '🪓',
    statBonus: { strength: 10, vitality: 5, intelligence: 0, agility: 0 },
    growthWeights: { strength: 0.5, vitality: 0.3, intelligence: 0.05, agility: 0.15 },
    combatModifiers: { attackBonus: 1.4, hpBonus: 1.15, critRateBonus: 1.1 },
    passive: { id: 'savage_power', name: '야만의 힘', description: '물리 공격 시 추가 고정 피해' },
    specialSkills: ['savage_blow', 'war_stomp', 'execute']
  },

  // === 검사 계열 ===
  knight: {
    id: 'knight',
    name: '기사',
    tier: 2,
    baseClass: 'swordsman',
    description: '명예와 의리를 중시하는 정통 기사. 균형 잡힌 능력치.',
    icon: '⚜️',
    statBonus: { strength: 5, vitality: 5, intelligence: 2, agility: 3 },
    growthWeights: { strength: 0.3, vitality: 0.3, intelligence: 0.1, agility: 0.3 },
    combatModifiers: { attackBonus: 1.2, defenseBonus: 1.2, critRateBonus: 1.15 },
    passive: { id: 'chivalry', name: '기사도', description: 'HP 50% 이상일 때 모든 능력치 +5%' },
    specialSkills: ['holy_slash', 'shield_bash', 'knights_honor']
  },

  iaido_master: {
    id: 'iaido_master',
    name: '발도술사',
    tier: 2,
    baseClass: 'swordsman',
    description: '순간의 발도로 적을 베는 일섬의 달인. 극한의 크리티컬.',
    icon: '🗡️',
    statBonus: { strength: 6, vitality: 1, intelligence: 2, agility: 6 },
    growthWeights: { strength: 0.3, vitality: 0.1, intelligence: 0.15, agility: 0.45 },
    combatModifiers: { critRateBonus: 1.5, critDamageBonus: 1.5, attackBonus: 1.1, hpBonus: 0.85 },
    passive: { id: 'flash_draw', name: '섬광 발도', description: '첫 공격이 반드시 크리티컬' },
    specialSkills: ['iaido_slash', 'zantetsuken', 'mugen_ryu']
  },

  // === 마법사 계열 (8속성) ===
  pyromancer: {
    id: 'pyromancer',
    name: '화염 마법사',
    tier: 2,
    baseClass: 'mage',
    element: 'fire',
    description: '불의 마력을 다루는 파괴의 마법사. 최고의 화력.',
    icon: '🔥',
    statBonus: { strength: 2, vitality: 2, intelligence: 10, agility: 1 },
    growthWeights: { strength: 0.1, vitality: 0.15, intelligence: 0.55, agility: 0.2 },
    combatModifiers: { magicAttackBonus: 1.4, mpBonus: 1.1, hpBonus: 0.9 },
    passive: { id: 'ignite', name: '점화', description: '화염 마법이 지속 피해를 입힌다' },
    specialSkills: ['inferno', 'fire_storm', 'phoenix_flame']
  },

  hydromancer: {
    id: 'hydromancer',
    name: '수(水) 마법사',
    tier: 2,
    baseClass: 'mage',
    element: 'water',
    description: '물의 흐름을 조종하는 치유의 마법사.',
    icon: '💧',
    statBonus: { strength: 0, vitality: 4, intelligence: 8, agility: 3 },
    growthWeights: { strength: 0.05, vitality: 0.25, intelligence: 0.5, agility: 0.2 },
    combatModifiers: { magicAttackBonus: 1.15, mpBonus: 1.25, healBonus: 1.4 },
    passive: { id: 'aqua_shield', name: '물의 보호막', description: '전투 시작 시 보호막 획득' },
    specialSkills: ['tidal_wave', 'healing_rain', 'ice_prison']
  },

  aeromancer: {
    id: 'aeromancer',
    name: '바람 마법사',
    tier: 2,
    baseClass: 'mage',
    element: 'wind',
    description: '바람을 자유자재로 다루는 속도의 마법사.',
    icon: '🌪️',
    statBonus: { strength: 1, vitality: 2, intelligence: 7, agility: 5 },
    growthWeights: { strength: 0.1, vitality: 0.15, intelligence: 0.4, agility: 0.35 },
    combatModifiers: { magicAttackBonus: 1.2, mpBonus: 1.15, dodgeBonus: 1.4 },
    passive: { id: 'wind_walker', name: '바람걸음', description: '회피율 크게 증가' },
    specialSkills: ['hurricane', 'air_slash', 'tempest']
  },

  geomancer: {
    id: 'geomancer',
    name: '대지 마법사',
    tier: 2,
    baseClass: 'mage',
    element: 'earth',
    description: '대지의 힘을 빌리는 견고한 마법사.',
    icon: '🪨',
    statBonus: { strength: 2, vitality: 6, intelligence: 6, agility: 1 },
    growthWeights: { strength: 0.15, vitality: 0.3, intelligence: 0.4, agility: 0.15 },
    combatModifiers: { magicAttackBonus: 1.2, mpBonus: 1.1, defenseBonus: 1.3, hpBonus: 1.15 },
    passive: { id: 'earth_armor', name: '대지의 갑옷', description: '마법 방어력 증가' },
    specialSkills: ['earthquake', 'stone_spear', 'gaia_blessing']
  },

  alchemist: {
    id: 'alchemist',
    name: '금(金) 마법사',
    tier: 2,
    baseClass: 'mage',
    element: 'metal',
    description: '금속과 연금술을 다루는 만능 마법사.',
    icon: '⚗️',
    statBonus: { strength: 2, vitality: 3, intelligence: 8, agility: 2 },
    growthWeights: { strength: 0.15, vitality: 0.2, intelligence: 0.45, agility: 0.2 },
    combatModifiers: { magicAttackBonus: 1.25, mpBonus: 1.2, itemEffectBonus: 1.5 },
    passive: { id: 'transmutation', name: '변환', description: '공격 시 확률로 HP/MP 회복' },
    specialSkills: ['metal_storm', 'golden_barrier', 'philosophers_stone']
  },

  dark_mage: {
    id: 'dark_mage',
    name: '암흑 마법사',
    tier: 2,
    baseClass: 'mage',
    element: 'dark',
    description: '어둠의 힘을 다루는 금지된 마법사. 흡수와 저주.',
    icon: '🌑',
    statBonus: { strength: 1, vitality: 3, intelligence: 9, agility: 2 },
    growthWeights: { strength: 0.1, vitality: 0.2, intelligence: 0.5, agility: 0.2 },
    combatModifiers: { magicAttackBonus: 1.35, mpBonus: 1.15, drainBonus: 1.4 },
    passive: { id: 'life_drain', name: '생명력 흡수', description: '피해량의 15%를 HP로 회복' },
    specialSkills: ['shadow_bolt', 'curse', 'dark_void']
  },

  light_mage: {
    id: 'light_mage',
    name: '빛 마법사',
    tier: 2,
    baseClass: 'mage',
    element: 'light',
    description: '성스러운 빛을 다루는 축복의 마법사.',
    icon: '✨',
    statBonus: { strength: 1, vitality: 4, intelligence: 8, agility: 2 },
    growthWeights: { strength: 0.1, vitality: 0.25, intelligence: 0.45, agility: 0.2 },
    combatModifiers: { magicAttackBonus: 1.2, mpBonus: 1.2, healBonus: 1.35 },
    passive: { id: 'divine_protection', name: '신성한 보호', description: '확률로 치명적 피해 무효화' },
    specialSkills: ['holy_light', 'blessing', 'judgment']
  },

  electromancer: {
    id: 'electromancer',
    name: '전기 마법사',
    tier: 2,
    baseClass: 'mage',
    element: 'lightning',
    description: '번개의 힘을 다루는 마비의 마법사.',
    icon: '⚡',
    statBonus: { strength: 1, vitality: 2, intelligence: 9, agility: 3 },
    growthWeights: { strength: 0.1, vitality: 0.15, intelligence: 0.5, agility: 0.25 },
    combatModifiers: { magicAttackBonus: 1.3, mpBonus: 1.15, stunChanceBonus: 1.5 },
    passive: { id: 'static_charge', name: '정전기', description: '높은 확률로 적을 마비' },
    specialSkills: ['thunder_strike', 'chain_lightning', 'plasma_storm']
  },

  // === 소환사 계열 ===
  elementalist: {
    id: 'elementalist',
    name: '정령사',
    tier: 2,
    baseClass: 'summoner',
    description: '자연의 정령들과 계약한 소환사. 다양한 원소 정령 소환.',
    icon: '🌿',
    statBonus: { strength: 1, vitality: 3, intelligence: 8, agility: 3 },
    growthWeights: { strength: 0.1, vitality: 0.2, intelligence: 0.45, agility: 0.25 },
    combatModifiers: { summonBonus: 1.4, mpBonus: 1.25, magicAttackBonus: 1.15 },
    passive: { id: 'elemental_bond', name: '정령과의 유대', description: '소환수 능력 증가, 지속시간 연장' },
    specialSkills: ['summon_fire_elemental', 'summon_water_elemental', 'elemental_fusion']
  },

  necromancer: {
    id: 'necromancer',
    name: '네크로맨서',
    tier: 2,
    baseClass: 'summoner',
    description: '죽음의 힘을 다루어 언데드를 부리는 금지된 소환사.',
    icon: '💀',
    statBonus: { strength: 0, vitality: 4, intelligence: 9, agility: 2 },
    growthWeights: { strength: 0.05, vitality: 0.25, intelligence: 0.5, agility: 0.2 },
    combatModifiers: { summonBonus: 1.35, mpBonus: 1.2, drainBonus: 1.3 },
    passive: { id: 'undead_army', name: '언데드 군단', description: '여러 체의 언데드 동시 소환' },
    specialSkills: ['raise_skeleton', 'summon_ghost', 'army_of_dead']
  },

  weapon_summoner: {
    id: 'weapon_summoner',
    name: '무기 소환사',
    tier: 2,
    baseClass: 'summoner',
    description: '마법 무기를 소환하여 싸우는 전투형 소환사.',
    icon: '🗡️',
    statBonus: { strength: 4, vitality: 2, intelligence: 6, agility: 3 },
    growthWeights: { strength: 0.25, vitality: 0.15, intelligence: 0.4, agility: 0.2 },
    combatModifiers: { summonBonus: 1.25, attackBonus: 1.2, magicAttackBonus: 1.2 },
    passive: { id: 'weapon_mastery', name: '무기의 달인', description: '소환 무기 공격력 증가' },
    specialSkills: ['summon_sword', 'blade_storm', 'legendary_armory']
  },

  beast_tamer: {
    id: 'beast_tamer',
    name: '몬스터 테이머',
    tier: 2,
    baseClass: 'summoner',
    description: '마물들을 길들여 동료로 삼는 야수의 친구.',
    icon: '🐉',
    statBonus: { strength: 2, vitality: 4, intelligence: 6, agility: 3 },
    growthWeights: { strength: 0.15, vitality: 0.25, intelligence: 0.4, agility: 0.2 },
    combatModifiers: { summonBonus: 1.45, hpBonus: 1.1, defenseBonus: 1.1 },
    passive: { id: 'beast_bond', name: '야수와의 유대', description: '소환 몬스터 지속시간/체력 증가' },
    specialSkills: ['summon_wolf', 'summon_drake', 'alpha_command']
  },

  demon_contractor: {
    id: 'demon_contractor',
    name: '악마 계약자',
    tier: 2,
    baseClass: 'summoner',
    description: '악마와 계약을 맺어 그 힘을 빌리는 위험한 소환사.',
    icon: '😈',
    statBonus: { strength: 2, vitality: 2, intelligence: 8, agility: 3 },
    growthWeights: { strength: 0.15, vitality: 0.15, intelligence: 0.5, agility: 0.2 },
    combatModifiers: { summonBonus: 1.5, magicAttackBonus: 1.25, hpBonus: 0.9 },
    passive: { id: 'demonic_pact', name: '악마의 계약', description: 'HP 대가로 강력한 소환수' },
    specialSkills: ['summon_imp', 'summon_demon', 'infernal_gate']
  },

  celestial_summoner: {
    id: 'celestial_summoner',
    name: '천사 소환사',
    tier: 2,
    baseClass: 'summoner',
    description: '천계의 존재들을 불러내는 성스러운 소환사.',
    icon: '👼',
    statBonus: { strength: 1, vitality: 4, intelligence: 7, agility: 3 },
    growthWeights: { strength: 0.1, vitality: 0.25, intelligence: 0.45, agility: 0.2 },
    combatModifiers: { summonBonus: 1.35, healBonus: 1.3, magicAttackBonus: 1.15 },
    passive: { id: 'divine_blessing', name: '천상의 축복', description: '소환수가 치유 및 버프 제공' },
    specialSkills: ['summon_cherub', 'summon_archangel', 'heavenly_chorus']
  }
};

// ===== 마스터 직업 (3차) =====
export const MASTER_CLASSES = {
  warlord: {
    id: 'warlord',
    name: '전쟁군주',
    tier: 3,
    baseClasses: ['berserker', 'guardian', 'barbarian'],
    description: '전장을 지배하는 궁극의 전사.',
    icon: '👑'
  },
  sword_saint: {
    id: 'sword_saint',
    name: '검성',
    tier: 3,
    baseClasses: ['knight', 'iaido_master'],
    description: '검의 극의에 도달한 전설의 검객.',
    icon: '🌟'
  },
  archmage: {
    id: 'archmage',
    name: '대마법사',
    tier: 3,
    baseClasses: ['pyromancer', 'hydromancer', 'aeromancer', 'geomancer',
                  'alchemist', 'dark_mage', 'light_mage', 'electromancer'],
    description: '모든 마법의 진리에 통달한 위대한 현자.',
    icon: '🌌'
  },
  high_summoner: {
    id: 'high_summoner',
    name: '대소환사',
    tier: 3,
    baseClasses: ['elementalist', 'necromancer', 'weapon_summoner',
                  'beast_tamer', 'demon_contractor', 'celestial_summoner'],
    description: '모든 영역의 존재를 불러낼 수 있는 소환술의 극치.',
    icon: '🔱'
  }
};

// ===== 유틸리티 함수 =====
export function getBaseClasses() {
  return Object.values(BASE_CLASSES);
}

export function getAdvancedClassesFor(baseClassId) {
  const baseClass = BASE_CLASSES[baseClassId];
  if (!baseClass) return [];
  return baseClass.advancedClasses.map(id => ADVANCED_CLASSES[id]);
}

export function getClassById(classId) {
  return BASE_CLASSES[classId] || ADVANCED_CLASSES[classId] || MASTER_CLASSES[classId] || null;
}

export function canAdvanceClass(character, targetClassId) {
  const targetClass = getClassById(targetClassId);
  if (!targetClass) return { canAdvance: false, reason: '존재하지 않는 직업입니다.' };

  if (targetClass.tier === 2) {
    if (character.level < CLASS_TIERS.ADVANCED.requiredLevel) {
      return { canAdvance: false, reason: `레벨 ${CLASS_TIERS.ADVANCED.requiredLevel} 이상이어야 합니다.` };
    }
    if (targetClass.baseClass !== character.classId) {
      return { canAdvance: false, reason: `${BASE_CLASSES[targetClass.baseClass].name} 계열만 전직할 수 있습니다.` };
    }
  }

  if (targetClass.tier === 3) {
    if (character.level < CLASS_TIERS.MASTER.requiredLevel) {
      return { canAdvance: false, reason: `레벨 ${CLASS_TIERS.MASTER.requiredLevel} 이상이어야 합니다.` };
    }
    if (!targetClass.baseClasses.includes(character.classId)) {
      return { canAdvance: false, reason: '현재 직업으로는 전직할 수 없습니다.' };
    }
  }

  return { canAdvance: true };
}

export function calculateClassStatBonus(character) {
  const currentClass = getClassById(character.classId);
  if (!currentClass) return { strength: 0, vitality: 0, intelligence: 0, agility: 0 };

  let bonus = { ...currentClass.statBonus };

  if (currentClass.baseClass) {
    const baseClass = BASE_CLASSES[currentClass.baseClass];
    if (baseClass) {
      bonus.strength += baseClass.statBonus.strength;
      bonus.vitality += baseClass.statBonus.vitality;
      bonus.intelligence += baseClass.statBonus.intelligence;
      bonus.agility += baseClass.statBonus.agility;
    }
  }

  return bonus;
}

export function getCombatModifiers(character) {
  const currentClass = getClassById(character.classId);
  if (!currentClass) return {};
  return currentClass.combatModifiers || {};
}
