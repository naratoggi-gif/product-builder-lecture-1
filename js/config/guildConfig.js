// The Hunter System - Guild Configuration (v6.3 Guild Management System)
// Guild Office, Research Center Tech Tree, and related configurations

/**
 * Guild Office Levels
 * - Upgraded with Gold to increase passive Gold per second (GPS)
 * - Max level limited by player's rank
 */
export const GUILD_OFFICE_LEVELS = [
  { level: 1, name: 'E급 사무실', gps: 0.5, upgradeCost: 0, requiredRank: 'E', description: '낡은 창고를 개조한 길드 사무실' },
  { level: 2, name: 'E급 사무실+', gps: 1.0, upgradeCost: 500, requiredRank: 'E', description: '기본 집기가 갖춰진 사무실' },
  { level: 3, name: 'D급 사무실', gps: 2.0, upgradeCost: 1500, requiredRank: 'D', description: '소형 회의실이 있는 사무실' },
  { level: 4, name: 'D급 사무실+', gps: 3.5, upgradeCost: 3500, requiredRank: 'D', description: '헌터 협회 인증 D급 시설' },
  { level: 5, name: 'C급 사무실', gps: 5.5, upgradeCost: 7000, requiredRank: 'C', description: '중규모 길드 운영 시설' },
  { level: 6, name: 'C급 사무실+', gps: 8.0, upgradeCost: 12000, requiredRank: 'C', description: '훈련실을 갖춘 복합 시설' },
  { level: 7, name: 'B급 사무실', gps: 12.0, upgradeCost: 20000, requiredRank: 'B', description: '최첨단 장비를 갖춘 본부' },
  { level: 8, name: 'B급 사무실+', gps: 17.0, upgradeCost: 35000, requiredRank: 'B', description: '의료 시설을 포함한 대형 본부' },
  { level: 9, name: 'A급 사무실', gps: 25.0, upgradeCost: 60000, requiredRank: 'A', description: '국가 인증 대형 길드 시설' },
  { level: 10, name: 'S급 사무실', gps: 40.0, upgradeCost: 100000, requiredRank: 'S', description: '전설의 길드 본부' }
];

/**
 * Research Center Tech Tree
 * Permanent passive buffs that take time to research
 */
export const RESEARCH_TREE = {
  // Category 1: Gold & Economy
  economy: {
    name: '경제 연구',
    icon: '💰',
    techs: [
      {
        id: 'gold_boost_1',
        name: '금맥 탐사 I',
        description: '골드 획득량 +5%',
        effect: { goldMult: 0.05 },
        researchTime: 30, // seconds
        cost: 200,
        requiredRank: 'E',
        prerequisites: []
      },
      {
        id: 'gold_boost_2',
        name: '금맥 탐사 II',
        description: '골드 획득량 +10%',
        effect: { goldMult: 0.10 },
        researchTime: 120,
        cost: 800,
        requiredRank: 'D',
        prerequisites: ['gold_boost_1']
      },
      {
        id: 'gold_boost_3',
        name: '금맥 탐사 III',
        description: '골드 획득량 +15%',
        effect: { goldMult: 0.15 },
        researchTime: 300,
        cost: 2500,
        requiredRank: 'C',
        prerequisites: ['gold_boost_2']
      },
      {
        id: 'dispatch_efficiency',
        name: '파견 효율화',
        description: '파견 헌터 GPS +20%',
        effect: { dispatchGpsMult: 0.20 },
        researchTime: 180,
        cost: 1200,
        requiredRank: 'D',
        prerequisites: ['gold_boost_1']
      }
    ]
  },

  // Category 2: Experience
  training: {
    name: '훈련 연구',
    icon: '📚',
    techs: [
      {
        id: 'exp_boost_1',
        name: '훈련 교본 I',
        description: '경험치 획득량 +5%',
        effect: { expMult: 0.05 },
        researchTime: 45,
        cost: 300,
        requiredRank: 'E',
        prerequisites: []
      },
      {
        id: 'exp_boost_2',
        name: '훈련 교본 II',
        description: '경험치 획득량 +10%',
        effect: { expMult: 0.10 },
        researchTime: 150,
        cost: 1000,
        requiredRank: 'D',
        prerequisites: ['exp_boost_1']
      },
      {
        id: 'exp_boost_3',
        name: '훈련 교본 III',
        description: '경험치 획득량 +15%',
        effect: { expMult: 0.15 },
        researchTime: 360,
        cost: 3000,
        requiredRank: 'C',
        prerequisites: ['exp_boost_2']
      },
      {
        id: 'stat_training_boost',
        name: '스탯 연마 효율',
        description: '스탯 연마 비용 -10%',
        effect: { refineCostReduction: 0.10 },
        researchTime: 240,
        cost: 1500,
        requiredRank: 'D',
        prerequisites: ['exp_boost_1']
      }
    ]
  },

  // Category 3: Combat
  combat: {
    name: '전투 연구',
    icon: '⚔️',
    techs: [
      {
        id: 'crit_boost_1',
        name: '급소 공략 I',
        description: '크리티컬 확률 +2%',
        effect: { critRate: 0.02 },
        researchTime: 60,
        cost: 400,
        requiredRank: 'E',
        prerequisites: []
      },
      {
        id: 'crit_boost_2',
        name: '급소 공략 II',
        description: '크리티컬 확률 +3%',
        effect: { critRate: 0.03 },
        researchTime: 180,
        cost: 1200,
        requiredRank: 'D',
        prerequisites: ['crit_boost_1']
      },
      {
        id: 'drop_boost_1',
        name: '전리품 수집 I',
        description: '드롭률 +5%',
        effect: { dropRate: 0.05 },
        researchTime: 90,
        cost: 500,
        requiredRank: 'E',
        prerequisites: []
      },
      {
        id: 'drop_boost_2',
        name: '전리품 수집 II',
        description: '드롭률 +10%',
        effect: { dropRate: 0.10 },
        researchTime: 240,
        cost: 1800,
        requiredRank: 'C',
        prerequisites: ['drop_boost_1']
      }
    ]
  },

  // Category 4: Guild Management
  management: {
    name: '길드 관리',
    icon: '🏢',
    techs: [
      {
        id: 'dispatch_slot_1',
        name: '파견 확장 I',
        description: '파견 슬롯 +1',
        effect: { extraDispatchSlots: 1 },
        researchTime: 300,
        cost: 2000,
        requiredRank: 'D',
        prerequisites: []
      },
      {
        id: 'dispatch_slot_2',
        name: '파견 확장 II',
        description: '파견 슬롯 +1',
        effect: { extraDispatchSlots: 1 },
        researchTime: 600,
        cost: 5000,
        requiredRank: 'C',
        prerequisites: ['dispatch_slot_1']
      },
      {
        id: 'office_discount',
        name: '시설 유지비 절감',
        description: '사무실 업그레이드 비용 -15%',
        effect: { officeUpgradeDiscount: 0.15 },
        researchTime: 200,
        cost: 1000,
        requiredRank: 'D',
        prerequisites: []
      }
    ]
  }
};

/**
 * Dispatch Materials earned by hunters
 * Based on hunter rank
 */
export const DISPATCH_MATERIALS = {
  'F': [
    { id: 'trash_mana_stone', name: '찌꺼기 마나석', dropRate: 0.9, icon: '🪨' },
    { id: 'goblin_tooth', name: '고블린 이빨', dropRate: 0.7, icon: '🦷' }
  ],
  'E': [
    { id: 'low_mana_stone', name: '저급 마나석', dropRate: 0.8, icon: '💎' },
    { id: 'monster_bone', name: '마물 뼈', dropRate: 0.5, icon: '🦴' }
  ],
  'D': [
    { id: 'mid_mana_stone', name: '중급 마나석', dropRate: 0.6, icon: '💠' },
    { id: 'monster_core', name: '마물 코어', dropRate: 0.4, icon: '🔮' },
    { id: 'iron_ore', name: '마철 광석', dropRate: 0.5, icon: '🪨' }
  ],
  'C': [
    { id: 'high_mana_stone', name: '고급 마나석', dropRate: 0.4, icon: '🌟' },
    { id: 'boss_fragment', name: '보스 파편', dropRate: 0.2, icon: '⚡' },
    { id: 'enchant_crystal', name: '강화 결정', dropRate: 0.3, icon: '✨' }
  ],
  'B': [
    { id: 'elite_mana_stone', name: '정예 마나석', dropRate: 0.35, icon: '💫' },
    { id: 'dragon_scale', name: '용린 조각', dropRate: 0.15, icon: '🐉' },
    { id: 'magic_essence', name: '마력 정수', dropRate: 0.25, icon: '🔮' }
  ],
  'A': [
    { id: 'legendary_mana_stone', name: '전설 마나석', dropRate: 0.25, icon: '👑' },
    { id: 'dragon_heart', name: '용의 심장', dropRate: 0.08, icon: '❤️‍🔥' },
    { id: 'void_crystal', name: '공허의 결정', dropRate: 0.12, icon: '🌑' }
  ],
  'S': [
    { id: 'mythic_mana_stone', name: '신화급 마나석', dropRate: 0.15, icon: '🌈' },
    { id: 'world_tree_fragment', name: '세계수 파편', dropRate: 0.05, icon: '🌳' },
    { id: 'shadow_monarch_essence', name: '군주의 정수', dropRate: 0.03, icon: '👤' }
  ]
};

/**
 * Helper Functions
 */

// Get office level info by level number
export function getOfficeLevelInfo(level) {
  return GUILD_OFFICE_LEVELS.find(o => o.level === level) || GUILD_OFFICE_LEVELS[0];
}

// Get max office level for a given player rank
export function getMaxOfficeLevelForRank(playerRank) {
  const rankOrder = { 'E': 1, 'D': 2, 'C': 3, 'B': 4, 'A': 5, 'S': 6 };
  const playerRankOrder = rankOrder[playerRank] || 1;

  let maxLevel = 1;
  for (const office of GUILD_OFFICE_LEVELS) {
    const requiredOrder = rankOrder[office.requiredRank] || 1;
    if (requiredOrder <= playerRankOrder) {
      maxLevel = Math.max(maxLevel, office.level);
    }
  }
  return maxLevel;
}

// Get next office level info
export function getNextOfficeLevelInfo(currentLevel) {
  return GUILD_OFFICE_LEVELS.find(o => o.level === currentLevel + 1) || null;
}

// Get research by ID
export function getResearchById(researchId) {
  for (const category of Object.values(RESEARCH_TREE)) {
    const tech = category.techs.find(t => t.id === researchId);
    if (tech) return tech;
  }
  return null;
}

// Check if research prerequisites are met
export function canStartResearch(researchId, completedResearch = []) {
  const research = getResearchById(researchId);
  if (!research) return false;

  return research.prerequisites.every(prereq => completedResearch.includes(prereq));
}

// Get all available research (not completed, prerequisites met)
export function getAvailableResearch(completedResearch = [], playerRank = 'E') {
  const rankOrder = { 'E': 1, 'D': 2, 'C': 3, 'B': 4, 'A': 5, 'S': 6 };
  const playerRankOrder = rankOrder[playerRank] || 1;
  const available = [];

  for (const category of Object.values(RESEARCH_TREE)) {
    for (const tech of category.techs) {
      // Skip if already completed
      if (completedResearch.includes(tech.id)) continue;

      // Check rank requirement
      const requiredOrder = rankOrder[tech.requiredRank] || 1;
      if (requiredOrder > playerRankOrder) continue;

      // Check prerequisites
      if (canStartResearch(tech.id, completedResearch)) {
        available.push(tech);
      }
    }
  }

  return available;
}

// Calculate total research bonuses from completed research
export function calculateResearchBonuses(completedResearch = []) {
  const bonuses = {
    goldMult: 0,
    expMult: 0,
    critRate: 0,
    dropRate: 0,
    dispatchGpsMult: 0,
    refineCostReduction: 0,
    extraDispatchSlots: 0,
    officeUpgradeDiscount: 0
  };

  for (const researchId of completedResearch) {
    const research = getResearchById(researchId);
    if (research && research.effect) {
      for (const [key, value] of Object.entries(research.effect)) {
        if (bonuses.hasOwnProperty(key)) {
          bonuses[key] += value;
        }
      }
    }
  }

  return bonuses;
}

// Get materials that can drop from dispatched hunters
export function getDispatchMaterials(hunterRank) {
  return DISPATCH_MATERIALS[hunterRank] || DISPATCH_MATERIALS['E'];
}

// Format time remaining for research
export function formatResearchTime(seconds) {
  if (seconds < 60) return `${seconds}초`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}분`;
  return `${Math.floor(seconds / 3600)}시간 ${Math.ceil((seconds % 3600) / 60)}분`;
}
