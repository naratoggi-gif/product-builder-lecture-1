// 보스 데이터
export const BOSSES = {
  // Tier 1 (Lv 10~)
  goblin_king: {
    id: 'goblin_king',
    name: '고블린 왕',
    description: '고블린 부족의 잔인한 지배자',
    tier: 1,
    unlockRequirements: { level: 10 },
    stats: {
      maxHp: 500,
      attack: 25,
      magicAttack: 15,
      defense: 15,
      speed: 10
    },
    skills: [
      { id: 'slash', name: '할퀴기', multiplier: 1.0, weight: 50 },
      { id: 'roar', name: '포효', type: 'buff', effect: { stat: 'attack', value: 10, duration: 2 }, weight: 30 },
      { id: 'fury_strike', name: '광란의 일격', multiplier: 1.5, weight: 20 }
    ],
    rewards: { exp: 500, title: '고블린 정복자' },
    image: 'goblin'
  },

  forest_troll: {
    id: 'forest_troll',
    name: '숲의 트롤',
    description: '거대한 몸집의 숲 수호자',
    tier: 1,
    unlockRequirements: { level: 12, skills: ['heal'] },
    stats: {
      maxHp: 650,
      attack: 30,
      magicAttack: 10,
      defense: 20,
      speed: 8
    },
    skills: [
      { id: 'smash', name: '내려찍기', multiplier: 1.2, weight: 50 },
      { id: 'regenerate', name: '재생', type: 'heal', value: 50, weight: 30 },
      { id: 'ground_pound', name: '지면 강타', multiplier: 1.4, weight: 20 }
    ],
    rewards: { exp: 600, title: '트롤 사냥꾼' },
    image: 'troll'
  },

  // Tier 2 (Lv 20~)
  dark_knight: {
    id: 'dark_knight',
    name: '암흑 기사',
    description: '어둠에 타락한 전설의 기사',
    tier: 2,
    unlockRequirements: { level: 20 },
    stats: {
      maxHp: 1000,
      attack: 45,
      magicAttack: 25,
      defense: 30,
      speed: 15
    },
    skills: [
      { id: 'dark_slash', name: '암흑 베기', multiplier: 1.3, weight: 40 },
      { id: 'shadow_shield', name: '그림자 방패', type: 'buff', effect: { stat: 'defense', value: 20, duration: 2 }, weight: 25 },
      { id: 'soul_drain', name: '영혼 흡수', multiplier: 1.2, lifesteal: 30, weight: 20 },
      { id: 'dark_storm', name: '암흑의 폭풍', multiplier: 1.8, weight: 15 }
    ],
    rewards: { exp: 1000, title: '빛의 수호자' },
    image: 'dark_knight'
  },

  ice_witch: {
    id: 'ice_witch',
    name: '빙결 마녀',
    description: '얼음 마법을 다루는 마녀',
    tier: 2,
    unlockRequirements: { level: 22, skills: ['fireball', 'lightning'] },
    stats: {
      maxHp: 850,
      attack: 20,
      magicAttack: 55,
      defense: 20,
      speed: 18
    },
    skills: [
      { id: 'ice_shard', name: '얼음 파편', multiplier: 1.3, damageType: 'magical', weight: 40 },
      { id: 'blizzard', name: '눈보라', multiplier: 1.0, damageType: 'magical', effect: { stat: 'speed', value: -5, duration: 2 }, weight: 30 },
      { id: 'freeze_all', name: '완전 빙결', type: 'stun', chance: 40, duration: 1, weight: 15 },
      { id: 'ice_storm', name: '얼음 폭풍', multiplier: 2.0, damageType: 'magical', weight: 15 }
    ],
    rewards: { exp: 1100, title: '마녀 사냥꾼' },
    image: 'witch'
  },

  // Tier 3 (Lv 35~)
  fire_dragon: {
    id: 'fire_dragon',
    name: '화염 드래곤',
    description: '고대의 화염을 내뿜는 드래곤',
    tier: 3,
    unlockRequirements: { level: 35 },
    stats: {
      maxHp: 2000,
      attack: 70,
      magicAttack: 60,
      defense: 45,
      speed: 20
    },
    skills: [
      { id: 'claw', name: '발톱 할퀴기', multiplier: 1.3, weight: 35 },
      { id: 'fire_breath', name: '화염 브레스', multiplier: 1.5, damageType: 'magical', weight: 30 },
      { id: 'tail_sweep', name: '꼬리 휘두르기', multiplier: 1.2, effect: { type: 'stun', chance: 20, duration: 1 }, weight: 20 },
      { id: 'inferno', name: '인페르노', multiplier: 2.2, damageType: 'magical', weight: 15 }
    ],
    rewards: { exp: 1500, title: '용 사냥꾼' },
    image: 'dragon'
  },

  death_knight: {
    id: 'death_knight',
    name: '죽음의 기사',
    description: '죽음에서 부활한 전설의 기사',
    tier: 3,
    unlockRequirements: { level: 40, bossesDefeated: ['dark_knight', 'fire_dragon'] },
    stats: {
      maxHp: 2500,
      attack: 80,
      magicAttack: 40,
      defense: 50,
      speed: 18
    },
    skills: [
      { id: 'death_strike', name: '죽음의 일격', multiplier: 1.5, weight: 35 },
      { id: 'life_drain', name: '생명력 흡수', multiplier: 1.3, lifesteal: 50, weight: 25 },
      { id: 'undead_army', name: '언데드 소환', type: 'buff', effect: { stat: 'attack', value: 30, duration: 3 }, weight: 20 },
      { id: 'death_sentence', name: '사형 선고', multiplier: 2.5, weight: 20 }
    ],
    rewards: { exp: 1800, title: '죽음의 정복자' },
    image: 'death_knight'
  },

  // Tier 4 (Lv 50+) - 최종 보스
  demon_lord: {
    id: 'demon_lord',
    name: '마왕',
    description: '세상을 멸망시키려는 최종 보스',
    tier: 4,
    unlockRequirements: { level: 50, bossesDefeated: ['fire_dragon', 'death_knight'] },
    stats: {
      maxHp: 5000,
      attack: 100,
      magicAttack: 80,
      defense: 60,
      speed: 25
    },
    skills: [
      { id: 'demon_slash', name: '마왕의 일격', multiplier: 1.5, weight: 30 },
      { id: 'hellfire', name: '지옥불', multiplier: 1.8, damageType: 'magical', weight: 25 },
      { id: 'dark_barrier', name: '암흑 결계', type: 'buff', effect: { stat: 'defense', value: 40, duration: 2 }, weight: 15 },
      { id: 'soul_crush', name: '영혼 분쇄', multiplier: 2.0, effect: { stat: 'attack', value: -20, duration: 3 }, weight: 15 },
      { id: 'apocalypse', name: '아포칼립스', multiplier: 3.0, weight: 15 }
    ],
    rewards: { exp: 3000, title: '마왕 정복자' },
    image: 'demon'
  }
};

// 보스 해금 가능 여부 확인
export function canChallengeBoss(bossId, character, defeatedBosses = []) {
  const boss = BOSSES[bossId];
  if (!boss) return false;

  const req = boss.unlockRequirements;

  if (req.level && character.level < req.level) return false;

  if (req.skills) {
    for (const skillId of req.skills) {
      if (!character.unlockedSkills.includes(skillId)) return false;
    }
  }

  if (req.bossesDefeated) {
    for (const bId of req.bossesDefeated) {
      if (!defeatedBosses.includes(bId)) return false;
    }
  }

  return true;
}

// 티어별 보스 목록 반환
export function getBossesByTier(tier) {
  return Object.values(BOSSES).filter(boss => boss.tier === tier);
}
