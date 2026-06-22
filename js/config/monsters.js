// 일반 몬스터 데이터
export const MONSTERS = {
  slime: {
    id: 'slime',
    name: '슬라임',
    description: '말랑말랑한 원시적인 몬스터',
    stats: {
      maxHp: 50,
      attack: 10,
      defense: 5,
    },
    skills: [{ id: 'body_slam', name: '몸통 박치기', multiplier: 1.0 }],
    rewards: { exp: 10 },
    image: 'slime',
  },
  goblin: {
    id: 'goblin',
    name: '고블린',
    description: '작고 교활한 몬스터. 떼를 지어 다닌다.',
    stats: {
      maxHp: 80,
      attack: 15,
      defense: 8,
    },
    skills: [{ id: 'club_attack', name: '몽둥이질', multiplier: 1.1 }],
    rewards: { exp: 15 },
    image: 'goblin',
  },
  wild_boar: {
    id: 'wild_boar',
    name: '사나운 멧돼지',
    description: '숲을 헤집고 다니는 난폭한 멧돼지.',
    stats: {
      maxHp: 120,
      attack: 20,
      defense: 10,
    },
    skills: [{ id: 'charge', name: '돌진', multiplier: 1.2 }],
    rewards: { exp: 20 },
    image: 'boar',
  },
  orc: {
    id: 'orc',
    name: '오크',
    description: '강력한 힘을 가진 몬스터',
    stats: {
      maxHp: 200,
      attack: 25,
      defense: 15
    },
    skills: [
        { id: 'axe_slash', name: '도끼 휘두르기', multiplier: 1.3 }
    ],
    rewards: { exp: 30 },
    image: 'orc'
  }
};

// 특정 레벨에 따라 무작위 몬스터 목록 반환
export function getRandomMonsters(characterLevel, count) {
  const suitableMonsters = Object.values(MONSTERS);
  const selectedMonsters = [];

  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * suitableMonsters.length);
    selectedMonsters.push(suitableMonsters[randomIndex]);
  }

  return selectedMonsters;
}