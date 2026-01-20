// The Hunter System - 길드 헌터 데이터 (v6.5 Enhanced Guild System)
// F~S급 헌터 목록 + 패시브 스킬 시스템

/**
 * 헌터 데이터 구조:
 * - id: 고유 식별자
 * - name: 헌터 이름
 * - rank: 등급 (F, E, D, C, B, A, S)
 * - hireCost: 고용 비용 (Gold)
 * - gps: Gold Per Second (초당 골드 수급량)
 * - sprite: 아바타 이모지
 * - specialty: 전문 분야
 * - description: 설명 (현대 판타지 톤)
 * - passive: A급 이상 헌터의 패시브 스킬 (optional)
 */

/**
 * 등급별 확률 (고용 시 랜덤 등장)
 * F: 15%, E: 30%, D: 25%, C: 18%, B: 8%, A: 3.5%, S: 0.5%
 */
export const HUNTER_RANK_RATES = {
  'F': 0.15,
  'E': 0.30,
  'D': 0.25,
  'C': 0.18,
  'B': 0.08,
  'A': 0.035,
  'S': 0.005
};

/**
 * 등급별 색상 정보
 */
export const HUNTER_RANK_COLORS = {
  'F': { bg: '#4a4a4a', border: '#6b6b6b', text: '#9ca3af', glow: 'none' },
  'E': { bg: '#374151', border: '#6b7280', text: '#9ca3af', glow: 'none' },
  'D': { bg: '#047857', border: '#10b981', text: '#10b981', glow: 'rgba(16, 185, 129, 0.3)' },
  'C': { bg: '#1d4ed8', border: '#3b82f6', text: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  'B': { bg: '#7c3aed', border: '#8b5cf6', text: '#a855f7', glow: 'rgba(139, 92, 246, 0.5)' },
  'A': { bg: '#b45309', border: '#f59e0b', text: '#f59e0b', glow: 'rgba(245, 158, 11, 0.6)' },
  'S': { bg: '#dc2626', border: '#ef4444', text: '#ef4444', glow: 'rgba(239, 68, 68, 0.8)' }
};

/**
 * 패시브 스킬 타입
 */
export const PASSIVE_TYPES = {
  REFINE_COST_REDUCTION: 'refineCostReduction',      // Refine 비용 감소
  QUEST_REWARD_BOOST: 'questRewardBoost',            // Quest 보상 증가
  GPS_BOOST: 'gpsBoost',                              // GPS 증가
  EXP_BOOST: 'expBoost',                              // 경험치 증가
  CRIT_RATE_BOOST: 'critRateBoost',                  // 크리티컬 확률 증가
  ESSENCE_BOOST: 'essenceBoost'                       // 에센스 획득 증가
};

export const GUILD_HUNTERS = [
  // ===== F급 헌터 (최저렴, 매우 낮은 GPS) =====
  {
    id: 'hunter_f_001',
    name: '김각성',
    rank: 'F',
    hireCost: 30,
    gps: 0.03,
    sprite: '👤',
    specialty: '허드렛일',
    description: '이제 막 각성했지만... 능력이 거의 없다.'
  },
  {
    id: 'hunter_f_002',
    name: '박아무개',
    rank: 'F',
    hireCost: 35,
    gps: 0.035,
    sprite: '🧑',
    specialty: '잡일',
    description: '각성은 했는데 뭘 해야 할지 모르겠다.'
  },
  {
    id: 'hunter_f_003',
    name: '이무능',
    rank: 'F',
    hireCost: 40,
    gps: 0.04,
    sprite: '👦',
    specialty: '청소',
    description: '던전 청소는 잘한다. 그것뿐이지만.'
  },

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
  },

  // ===== B급 헌터 (프리미엄 비용, 높은 GPS) =====
  {
    id: 'hunter_b_001',
    name: '차무진',
    rank: 'B',
    hireCost: 8000,
    gps: 4.0,
    sprite: '🔥',
    specialty: '화염 마법',
    description: '대형 길드 소속 A급 후보. 화염 속성을 지배한다.'
  },
  {
    id: 'hunter_b_002',
    name: '송빙결',
    rank: 'B',
    hireCost: 8500,
    gps: 4.2,
    sprite: '❄️',
    specialty: '빙결 마법',
    description: '얼음 여제라 불리는 냉기 마법사. 광역 제어 전문.'
  },
  {
    id: 'hunter_b_003',
    name: '황금창',
    rank: 'B',
    hireCost: 9000,
    gps: 4.5,
    sprite: '🔱',
    specialty: '창술',
    description: '국가 대표 창술사. 일섬에 보스 몬스터가 쓰러진다.'
  },
  {
    id: 'hunter_b_004',
    name: '백은검',
    rank: 'B',
    hireCost: 7500,
    gps: 3.8,
    sprite: '⚡',
    specialty: '번개 검술',
    description: '빛의 속도로 적을 베는 번개 검사.'
  },

  // ===== A급 헌터 (초프리미엄, 패시브 보유) =====
  {
    id: 'hunter_a_001',
    name: '류진',
    rank: 'A',
    hireCost: 30000,
    gps: 12.0,
    sprite: '🐉',
    specialty: '용언 마법',
    description: 'S급 직전의 실력자. 용의 언어로 마법을 부린다.',
    passive: {
      type: PASSIVE_TYPES.REFINE_COST_REDUCTION,
      value: 0.10,
      name: '용의 축복',
      description: '스탯 연마 비용 10% 감소'
    }
  },
  {
    id: 'hunter_a_002',
    name: '강예린',
    rank: 'A',
    hireCost: 32000,
    gps: 13.0,
    sprite: '🌙',
    specialty: '그림자 마법',
    description: '그림자 군주의 계약자. 어둠 속에서 무적이다.',
    passive: {
      type: PASSIVE_TYPES.QUEST_REWARD_BOOST,
      value: 0.15,
      name: '그림자 수확',
      description: '퀘스트 EXP 보상 15% 증가'
    }
  },
  {
    id: 'hunter_a_003',
    name: '한태양',
    rank: 'A',
    hireCost: 35000,
    gps: 14.0,
    sprite: '☀️',
    specialty: '성광 마법',
    description: '성기사단 단장. 빛의 힘으로 악을 심판한다.',
    passive: {
      type: PASSIVE_TYPES.GPS_BOOST,
      value: 0.20,
      name: '태양의 가호',
      description: '길드 전체 GPS 20% 증가'
    }
  },
  {
    id: 'hunter_a_004',
    name: '조은하',
    rank: 'A',
    hireCost: 28000,
    gps: 11.0,
    sprite: '💫',
    specialty: '회복 특화',
    description: '국가급 힐러. 그녀가 있으면 팀원은 죽지 않는다.',
    passive: {
      type: PASSIVE_TYPES.EXP_BOOST,
      value: 0.12,
      name: '생명의 축복',
      description: '경험치 획득량 12% 증가'
    }
  },

  // ===== S급 헌터 (전설급, 0.5% 확률, 강력한 패시브) =====
  {
    id: 'hunter_s_001',
    name: '성진우',
    rank: 'S',
    hireCost: 150000,
    gps: 50.0,
    sprite: '👑',
    specialty: '그림자 군주',
    description: '세계 최강의 헌터. 그의 그림자 군단은 무적이다.',
    passive: {
      type: PASSIVE_TYPES.REFINE_COST_REDUCTION,
      value: 0.25,
      name: '그림자 군주의 권능',
      description: '스탯 연마 비용 25% 감소'
    }
  },
  {
    id: 'hunter_s_002',
    name: '최병관',
    rank: 'S',
    hireCost: 180000,
    gps: 55.0,
    sprite: '🗡️',
    specialty: '절대검',
    description: '검황. 일검에 S급 게이트를 클리어한 전설.',
    passive: {
      type: PASSIVE_TYPES.GPS_BOOST,
      value: 0.35,
      name: '검황의 위엄',
      description: '길드 전체 GPS 35% 증가'
    }
  },
  {
    id: 'hunter_s_003',
    name: '안상훈',
    rank: 'S',
    hireCost: 200000,
    gps: 60.0,
    sprite: '⚡',
    specialty: '뇌제',
    description: '번개를 지배하는 자. 그의 일격에 하늘이 갈라진다.',
    passive: {
      type: PASSIVE_TYPES.QUEST_REWARD_BOOST,
      value: 0.25,
      name: '뇌신의 축복',
      description: '퀘스트 EXP 보상 25% 증가'
    }
  },
  {
    id: 'hunter_s_004',
    name: '백유리',
    rank: 'S',
    hireCost: 170000,
    gps: 52.0,
    sprite: '🌸',
    specialty: '치유의 성녀',
    description: '세계 최고의 힐러. 사망 직전도 되살린다는 소문.',
    passive: {
      type: PASSIVE_TYPES.ESSENCE_BOOST,
      value: 0.20,
      name: '생명의 꽃',
      description: '에센스 획득량 20% 증가'
    }
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
  return HUNTER_RANK_COLORS[rank]?.text || '#9ca3af';
}

/**
 * 랭크별 전체 색상 정보
 */
export function getHunterRankColorInfo(rank) {
  return HUNTER_RANK_COLORS[rank] || HUNTER_RANK_COLORS['E'];
}

/**
 * 랭크 순서 (정렬용)
 */
export function getRankOrder(rank) {
  const order = { 'F': 0, 'E': 1, 'D': 2, 'C': 3, 'B': 4, 'A': 5, 'S': 6 };
  return order[rank] || 0;
}

/**
 * 플레이어 랭크별 파견 슬롯 수
 */
export function getDispatchSlotsByPlayerRank(playerRank) {
  const slots = {
    'E': 2,
    'D': 3,
    'C': 4,
    'B': 5,
    'A': 6,
    'S': 8
  };
  return slots[playerRank] || 2;
}

/**
 * 랜덤 헌터 뽑기 (확률 기반)
 * @returns {Object} 랜덤하게 선택된 헌터
 */
export function getRandomHunter() {
  const rand = Math.random();
  let cumulative = 0;
  let selectedRank = 'E';

  for (const [rank, rate] of Object.entries(HUNTER_RANK_RATES)) {
    cumulative += rate;
    if (rand <= cumulative) {
      selectedRank = rank;
      break;
    }
  }

  const huntersOfRank = GUILD_HUNTERS.filter(h => h.rank === selectedRank);
  if (huntersOfRank.length === 0) {
    // Fallback to E급
    const eHunters = GUILD_HUNTERS.filter(h => h.rank === 'E');
    return eHunters[Math.floor(Math.random() * eHunters.length)];
  }

  return huntersOfRank[Math.floor(Math.random() * huntersOfRank.length)];
}

/**
 * 방출 시 반환 골드 계산 (고용가의 30%)
 */
export function getDismissRefund(hunterId) {
  const hunter = getGuildHunterById(hunterId);
  if (!hunter) return 0;
  return Math.floor(hunter.hireCost * 0.3);
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
