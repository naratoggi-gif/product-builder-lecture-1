// The Hunter System - 길드 헌터 데이터 (v6.1 Guild System)
// 고용 가능한 하급 헌터 목록 (E~C급)

/**
 * 헌터 데이터 구조:
 * - id: 고유 식별자
 * - name: 헌터 이름
 * - rank: 등급 (E, D, C)
 * - hireCost: 고용 비용 (Gold)
 * - gps: Gold Per Second (초당 골드 수급량)
 * - sprite: 아바타 이모지
 * - specialty: 전문 분야
 * - description: 설명 (현대 판타지 톤)
 */
export const GUILD_HUNTERS = [
  // ===== E급 헌터 (저렴, 낮은 GPS) =====
  {
    id: 'hunter_e_001',
    name: '김신입',
    rank: 'E',
    hireCost: 100,
    gps: 0.1,
    sprite: '👤',
    specialty: '잡몹 처리',
    description: '각성한 지 얼마 안 된 신입. 열정만은 S급이다.'
  },
  {
    id: 'hunter_e_002',
    name: '박초보',
    rank: 'E',
    hireCost: 120,
    gps: 0.12,
    sprite: '🧑',
    specialty: '저급 마석 수집',
    description: '아직 서툴지만 성실하게 임무를 수행한다.'
  },
  {
    id: 'hunter_e_003',
    name: '이루키',
    rank: 'E',
    hireCost: 150,
    gps: 0.15,
    sprite: '👦',
    specialty: '정찰',
    description: '눈치가 빠르고 발이 빠르다. 도주 성공률 100%.'
  },
  {
    id: 'hunter_e_004',
    name: '최견습',
    rank: 'E',
    hireCost: 130,
    gps: 0.13,
    sprite: '👧',
    specialty: '보조 힐링',
    description: '간호사 출신 각성자. 응급 처치에 능하다.'
  },
  {
    id: 'hunter_e_005',
    name: '정막내',
    rank: 'E',
    hireCost: 110,
    gps: 0.11,
    sprite: '🧒',
    specialty: '함정 해제',
    description: '손재주가 좋아 간단한 함정은 해제할 수 있다.'
  },

  // ===== D급 헌터 (중간 비용, 적당한 GPS) =====
  {
    id: 'hunter_d_001',
    name: '강철수',
    rank: 'D',
    hireCost: 500,
    gps: 0.5,
    sprite: '💪',
    specialty: '근접 전투',
    description: '전직 복서. 마수를 주먹으로 때려잡는 호쾌한 스타일.'
  },
  {
    id: 'hunter_d_002',
    name: '한지혜',
    rank: 'D',
    hireCost: 550,
    gps: 0.55,
    sprite: '🧙‍♀️',
    specialty: '마법 지원',
    description: '작은 화염구 정도는 쓸 수 있는 초급 마법사.'
  },
  {
    id: 'hunter_d_003',
    name: '윤사격',
    rank: 'D',
    hireCost: 600,
    gps: 0.6,
    sprite: '🏹',
    specialty: '원거리 공격',
    description: '군 저격수 출신. 마나 화살을 정확히 명중시킨다.'
  },
  {
    id: 'hunter_d_004',
    name: '서탱커',
    rank: 'D',
    hireCost: 650,
    gps: 0.55,
    sprite: '🛡️',
    specialty: '방어 담당',
    description: '두꺼운 방패로 팀원을 지키는 수호자.'
  },
  {
    id: 'hunter_d_005',
    name: '문도적',
    rank: 'D',
    hireCost: 580,
    gps: 0.58,
    sprite: '🗡️',
    specialty: '기습 공격',
    description: '그림자 속에서 튀어나와 급소를 노린다.'
  },
  {
    id: 'hunter_d_006',
    name: '배힐러',
    rank: 'D',
    hireCost: 700,
    gps: 0.5,
    sprite: '💚',
    specialty: '힐링',
    description: '중급 회복 마법을 사용하는 힐러.'
  },

  // ===== C급 헌터 (고비용, 높은 GPS) =====
  {
    id: 'hunter_c_001',
    name: '이검성',
    rank: 'C',
    hireCost: 2000,
    gps: 1.5,
    sprite: '⚔️',
    specialty: '검술',
    description: '검의 달인. 중급 게이트도 솔로 클리어 가능.'
  },
  {
    id: 'hunter_c_002',
    name: '박마도',
    rank: 'C',
    hireCost: 2200,
    gps: 1.6,
    sprite: '🔮',
    specialty: '마법 공격',
    description: '3서클 마법사. 파이어볼은 그의 시그니처.'
  },
  {
    id: 'hunter_c_003',
    name: '김철벽',
    rank: 'C',
    hireCost: 2500,
    gps: 1.4,
    sprite: '🏰',
    specialty: '방어 진형',
    description: '그가 막으면 S급 마수도 뚫지 못한다는 소문이...'
  },
  {
    id: 'hunter_c_004',
    name: '최암살',
    rank: 'C',
    hireCost: 2300,
    gps: 1.7,
    sprite: '🥷',
    specialty: '암살',
    description: '그림자 일체화 스킬 보유. 보스 급소 공격 전문.'
  },
  {
    id: 'hunter_c_005',
    name: '정성녀',
    rank: 'C',
    hireCost: 2800,
    gps: 1.3,
    sprite: '✨',
    specialty: '버프/힐링',
    description: '축복의 성녀. 팀 전체의 능력치를 상승시킨다.'
  }
];

/**
 * 랭크별 고용 가능 헌터 필터링
 */
export function getHuntersByRank(rank) {
  return GUILD_HUNTERS.filter(h => h.rank === rank);
}

/**
 * ID로 헌터 정보 가져오기
 */
export function getGuildHunterById(hunterId) {
  return GUILD_HUNTERS.find(h => h.id === hunterId) || null;
}

/**
 * 랭크별 색상
 */
export function getHunterRankColor(rank) {
  const colors = {
    'E': '#9ca3af',
    'D': '#10b981',
    'C': '#3b82f6'
  };
  return colors[rank] || '#9ca3af';
}

/**
 * 플레이어 랭크별 파견 슬롯 수
 */
export function getDispatchSlotsByPlayerRank(playerRank) {
  const slots = {
    'E': 1,
    'D': 2,
    'C': 3,
    'B': 4,
    'A': 5,
    'S': 6
  };
  return slots[playerRank] || 1;
}

/**
 * 파견 보고서 메시지 (현대 판타지 톤)
 */
export const DISPATCH_REPORT_MESSAGES = [
  "부하들이 저급 게이트를 소탕하고 돌아왔습니다.",
  "파견된 헌터들이 마석을 한 아름 가져왔습니다.",
  "길드원들의 토벌 작전이 성공적으로 완료되었습니다.",
  "그림자 병사들이 던전을 정화하고 귀환했습니다.",
  "부하 헌터들이 몬스터 코어를 수거해 왔습니다.",
  "파견대가 마정석 광맥을 발견했습니다!",
  "길드원들이 보스 레어를 급습하여 전리품을 획득했습니다."
];

export function getRandomDispatchMessage() {
  return DISPATCH_REPORT_MESSAGES[Math.floor(Math.random() * DISPATCH_REPORT_MESSAGES.length)];
}
