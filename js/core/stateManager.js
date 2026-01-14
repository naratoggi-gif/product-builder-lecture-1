// The Hunter System - 상태 관리자
import { GAME_CONSTANTS, getRequiredExp, calculateIdleGold, getAutoBattleCritRate } from '../config/constants.js';
import { getCostumeById, getCostumeStatBonus } from '../config/costumes.js';

const STORAGE_KEY = GAME_CONSTANTS.STORAGE_KEY;

export class StateManager {
  constructor() {
    this.state = this.getDefaultState();
    this.listeners = new Map();
    this.idleTimer = null;
    this.load();
    this.startIdleSystem();
  }

  // 로컬 타임존 기준 오늘 날짜 키 (YYYY-MM-DD)
  getLocalDayKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getDefaultState() {
    return {
      // 헌터 정보
      hunter: null,

      // 퀘스트 (실생활 목표)
      quests: [],

      // 게이트 (던전) 기록
      gateHistory: [],
      clearedGates: [],

      // 코스튬
      costumes: [],
      equippedCostume: null,

      // 일일 데이터 (매일 리셋) - 로컬 타임존 YYYY-MM-DD
      daily: {
        date: this.getLocalDayKey(),
        stamina: GAME_CONSTANTS.DAILY_STAMINA,
        questsCompleted: 0,
        restQuestsCompleted: 0, // 휴식 퀘스트 카운트 (Real Hunter 판정 시 1개만 인정)
        randomGateUsed: false,
        adWatched: {
          autoBattle: false,
          stamina: 0,
          gateRetry: false
        },
        suddenGate: {
          triggered: false,
          endTime: null
        }
      },

      // 아이들 시스템
      idle: {
        lastUpdate: Date.now(),
        totalGoldEarned: 0,
        autoBattleBoost: null // { endTime: timestamp }
      },

      // 통계
      statistics: {
        totalQuestsCompleted: 0,
        totalGatesCleared: 0,
        totalPlayTime: 0,
        longestStreak: 0,
        currentStreak: 0
      },

      // 설정
      settings: {
        theme: 'dark',
        soundEnabled: true,
        notifications: true
      }
    };
  }

  // 오늘 날짜 체크 및 일일 리셋 (로컬 타임존 기준)
  checkDailyReset() {
    const today = this.getLocalDayKey();
    if (this.state.daily.date !== today) {
      // 연속 기록 업데이트
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = this.getLocalDayKey(yesterday);

      // Real Hunter로 퀘스트를 완료했는지 확인 (휴식 퀘스트 1개만 인정)
      const { questsCompleted, restQuestsCompleted } = this.state.daily;
      const nonRestQuests = questsCompleted - restQuestsCompleted;
      const eligibleQuests = nonRestQuests + Math.min(restQuestsCompleted, 1);
      const wasRealHunter = eligibleQuests >= 1;

      if (this.state.daily.date === yesterdayStr && wasRealHunter) {
        this.state.statistics.currentStreak++;
        if (this.state.statistics.currentStreak > this.state.statistics.longestStreak) {
          this.state.statistics.longestStreak = this.state.statistics.currentStreak;
        }
      } else {
        this.state.statistics.currentStreak = 0;
      }

      // 일일 데이터 리셋
      this.state.daily = {
        date: today,
        stamina: GAME_CONSTANTS.DAILY_STAMINA,
        questsCompleted: 0,
        restQuestsCompleted: 0,
        randomGateUsed: false,
        adWatched: {
          autoBattle: false,
          stamina: 0,
          gateRetry: false
        },
        suddenGate: {
          triggered: false,
          endTime: null
        }
      };
      this.save();
    }
  }

  // 로컬 스토리지에서 불러오기
  load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        this.state = { ...this.getDefaultState(), ...data };
      }
      this.checkDailyReset();
    } catch (e) {
      console.error('상태 로드 실패:', e);
    }
  }

  // 로컬 스토리지에 저장
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('상태 저장 실패:', e);
    }
  }

  // 상태 가져오기
  get(key) {
    this.checkDailyReset();
    return key ? this.state[key] : this.state;
  }

  // 상태 설정
  set(key, value) {
    this.state[key] = value;
    this.save();
    this.notify(key, value);
  }

  // 상태 업데이트 (부분 업데이트)
  update(key, updates) {
    if (typeof this.state[key] === 'object' && !Array.isArray(this.state[key])) {
      this.state[key] = { ...this.state[key], ...updates };
    } else {
      this.state[key] = updates;
    }
    this.save();
    this.notify(key, this.state[key]);
  }

  // ========== 헌터 관련 ==========

  // 헌터 생성
  createHunter(name) {
    const hunter = {
      id: Date.now(),
      name,
      level: 1,
      exp: 0,
      gold: 0,
      stats: { ...GAME_CONSTANTS.INITIAL_STATS },
      statPoints: 0,
      rank: 'E', // 헌터 랭크
      title: '각성한 자',
      createdAt: new Date().toISOString()
    };
    this.set('hunter', hunter);
    return hunter;
  }

  // 경험치 획득
  gainExp(amount) {
    const hunter = this.state.hunter;
    if (!hunter) return;

    hunter.exp += amount;

    // 레벨업 체크
    let leveledUp = false;
    while (hunter.exp >= getRequiredExp(hunter.level)) {
      hunter.exp -= getRequiredExp(hunter.level);
      hunter.level++;
      hunter.statPoints += GAME_CONSTANTS.STAT_POINTS_PER_LEVEL;

      // 10레벨마다 보너스 스탯 포인트
      if (hunter.level % GAME_CONSTANTS.BONUS_STAT_POINTS_INTERVAL === 0) {
        hunter.statPoints += GAME_CONSTANTS.BONUS_STAT_POINTS;
      }

      leveledUp = true;
    }

    this.set('hunter', hunter);
    return leveledUp;
  }

  // 골드 획득
  gainGold(amount) {
    const hunter = this.state.hunter;
    if (!hunter) return;
    hunter.gold += amount;
    this.set('hunter', hunter);
  }

  // 스탯 증가
  increaseStat(statName) {
    const hunter = this.state.hunter;
    if (!hunter || hunter.statPoints <= 0) return false;
    if (!hunter.stats.hasOwnProperty(statName)) return false;

    hunter.stats[statName]++;
    hunter.statPoints--;
    this.set('hunter', hunter);
    return true;
  }

  // ========== 퀘스트 관련 ==========

  // 퀘스트 생성 (Design v3.0: completeAvailableAt = createdAt + waitMinutes(FOCUS))
  createQuest(questData) {
    const hunter = this.state.hunter;
    const focus = hunter ? hunter.stats.FOCUS : 5;
    const waitMinutes = this.getQuestWaitTime(focus);
    const createdAt = new Date();
    const completeAvailableAt = new Date(createdAt.getTime() + waitMinutes * 60 * 1000);

    const quest = {
      id: Date.now(),
      title: questData.title,
      category: questData.category,
      grade: questData.grade || 'D',
      staminaCost: GAME_CONSTANTS.QUEST_STAMINA_COST[questData.grade || 'D'],
      reward: GAME_CONSTANTS.QUEST_BASE_REWARDS[questData.grade || 'D'],
      createdAt: createdAt.toISOString(),
      completeAvailableAt: completeAvailableAt.toISOString(), // Design v3.0: 생성 시 대기시간 설정
      status: 'pending' // pending, in_progress, completed
    };

    const quests = [...this.state.quests, quest];
    this.set('quests', quests);
    return quest;
  }

  // 퀘스트 시작 (스태미나 소모) - Design v3.0: completeAvailableAt은 생성 시 설정됨
  startQuest(questId) {
    const quest = this.state.quests.find(q => q.id === questId);
    if (!quest) return { success: false, error: '퀘스트를 찾을 수 없습니다' };

    if (this.state.daily.stamina < quest.staminaCost) {
      return { success: false, error: '스태미나가 부족합니다' };
    }

    // 스태미나 소모
    this.state.daily.stamina -= quest.staminaCost;

    quest.status = 'in_progress';
    // completeAvailableAt은 createQuest에서 이미 설정됨

    this.set('quests', this.state.quests);
    this.save();

    return { success: true, completeAvailableAt: quest.completeAvailableAt };
  }

  // 퀘스트 대기시간 계산
  getQuestWaitTime(focus) {
    const tier = GAME_CONSTANTS.FOCUS_WAIT_TIME.find(t => focus >= t.min && focus <= t.max);
    return tier ? tier.minutes : 10;
  }

  // 퀘스트 완료 - 퀘스트 보상은 항상 100% 지급 (Real Hunter가 되는 행위)
  completeQuest(questId) {
    const questIndex = this.state.quests.findIndex(q => q.id === questId);
    if (questIndex === -1) return { success: false, error: '퀘스트를 찾을 수 없습니다' };

    const quest = this.state.quests[questIndex];

    // 완료 가능 시간 체크
    if (quest.completeAvailableAt && new Date(quest.completeAvailableAt) > new Date()) {
      return { success: false, error: '아직 완료할 수 없습니다' };
    }

    // 보상 계산 (퀘스트 보상은 항상 100% - 실생활 퀘스트이므로)
    const hunter = this.state.hunter;
    const effectiveStats = this.getEffectiveStats() || hunter.stats;
    const intBonus = hunter ? 1 + (effectiveStats.INT * 0.02) : 1;
    const costumeBonus = this.getCostumeBonus();
    const expReward = Math.floor(quest.reward.exp * intBonus * costumeBonus.expMult);
    const goldReward = Math.floor(quest.reward.gold * intBonus * costumeBonus.goldMult);

    // 카테고리에 따른 스탯 보너스
    const category = GAME_CONSTANTS.QUEST_CATEGORIES[quest.category];
    const isRestQuest = category && category.stat === 'STAMINA';
    let statGain = null;

    if (category && !isRestQuest && hunter) {
      // 10% 확률로 해당 스탯 +1
      if (Math.random() < 0.1) {
        hunter.stats[category.stat]++;
        statGain = category.stat;
      }
    } else if (isRestQuest) {
      // 휴식 카테고리: 스태미나 회복
      this.state.daily.stamina = Math.min(
        this.state.daily.stamina + 20,
        GAME_CONSTANTS.DAILY_STAMINA
      );
    }

    // 보상 적용
    this.gainExp(expReward);
    this.gainGold(goldReward);

    // 퀘스트 완료 처리
    quest.status = 'completed';
    quest.completedAt = new Date().toISOString();

    // 일일 퀘스트 카운트 증가
    this.state.daily.questsCompleted++;
    if (isRestQuest) {
      this.state.daily.restQuestsCompleted++; // 휴식 퀘스트 별도 카운트 (anti-abuse)
    }
    this.state.statistics.totalQuestsCompleted++;

    this.save();

    return {
      success: true,
      rewards: { exp: expReward, gold: goldReward, statGain }
    };
  }

  // 퀘스트 삭제
  deleteQuest(questId) {
    const quests = this.state.quests.filter(q => q.id !== questId);
    this.set('quests', quests);
  }

  // 진행 중인 퀘스트 가져오기
  getActiveQuests() {
    return this.state.quests.filter(q => q.status !== 'completed');
  }

  // 오늘 완료한 퀘스트 수
  getTodayCompletedCount() {
    this.checkDailyReset();
    return this.state.daily.questsCompleted;
  }

  // ========== 헌터 모드 체크 ==========

  /**
   * Real Hunter 판정 로직:
   * - 오늘 >= 1개의 실생활 퀘스트를 완료했는가?
   * - 휴식 퀘스트는 1개까지만 Real 자격에 인정 (anti-abuse)
   *
   * 예: 휴식 퀘스트만 3개 완료 → 1개만 인정 → Real Hunter
   * 예: 휴식 퀘스트만 0개 완료 → Simulation
   * 예: 운동 1개 + 휴식 5개 → 운동 1개 + 휴식 1개 = 2개 인정 → Real Hunter
   */
  isRealHunterToday() {
    this.checkDailyReset();
    const { questsCompleted, restQuestsCompleted } = this.state.daily;

    // 비휴식 퀘스트 수 = 전체 - 휴식
    const nonRestQuests = questsCompleted - restQuestsCompleted;

    // Real 자격 인정 퀘스트 수 = 비휴식 + min(휴식, 1)
    const eligibleQuests = nonRestQuests + Math.min(restQuestsCompleted, 1);

    return eligibleQuests >= 1;
  }

  // 현재 헌터 타입 가져오기 ("Real" 또는 "Simulation")
  getHunterType() {
    return this.isRealHunterToday() ? 'Real' : 'Simulation';
  }

  // 현재 보상 배율 가져오기 (Real: 1.0, Simulation: 0.35)
  getCurrentRewardMultiplier() {
    return this.isRealHunterToday()
      ? GAME_CONSTANTS.REWARD_MULTIPLIER.REAL_HUNTER
      : GAME_CONSTANTS.REWARD_MULTIPLIER.SIMULATION;
  }

  // 장착된 코스튬의 EXP 배율 가져오기
  getCostumeExpBonus() {
    const bonus = this.getCostumeBonus();
    return bonus.expMult;
  }

  // 장착된 코스튬의 골드 배율 가져오기
  getCostumeGoldBonus() {
    const bonus = this.getCostumeBonus();
    return bonus.goldMult;
  }

  /**
   * 장착된 코스튬의 전체 statBonus 가져오기
   * @returns { expMult, goldMult, strFlat, intFlat, wilFlat, focusFlat, lukFlat }
   */
  getCostumeBonus() {
    const equippedCostume = this.state.equippedCostume;
    return getCostumeStatBonus(equippedCostume);
  }

  /**
   * 코스튬 플랫 보너스가 적용된 효과 스탯 계산
   * 기본 스탯 + 코스튬 플랫 보너스
   */
  getEffectiveStats() {
    const hunter = this.state.hunter;
    if (!hunter) return null;

    const bonus = this.getCostumeBonus();
    return {
      STR: hunter.stats.STR + bonus.strFlat,
      INT: hunter.stats.INT + bonus.intFlat,
      WIL: hunter.stats.WIL + bonus.wilFlat,
      FOCUS: hunter.stats.FOCUS + bonus.focusFlat,
      LUK: hunter.stats.LUK + bonus.lukFlat
    };
  }

  // 장착된 코스튬 정보 가져오기
  getEquippedCostume() {
    const equippedCostume = this.state.equippedCostume;
    if (!equippedCostume) return null;
    return getCostumeById(equippedCostume);
  }

  // 현재 직업 이름 가져오기
  getCurrentJobName() {
    const costume = this.getEquippedCostume();
    return costume ? costume.jobTitle : '각성한 자';
  }

  // ========== 아이들 시스템 ==========

  startIdleSystem() {
    // 크리티컬 애니메이션 쿨다운 타임스탬프 초기화
    this.lastCriticalAnimationTime = 0;

    // 1초마다 아이들 골드 계산
    this.idleTimer = setInterval(() => {
      this.updateIdleGold();
    }, 1000);
  }

  // Design v3.0: 크리티컬 히트 시스템 (매 틱마다 5% + FOCUS*0.3% 확률로 2배 골드)
  updateIdleGold() {
    const hunter = this.state.hunter;
    if (!hunter) return;

    const now = Date.now();
    const lastUpdate = this.state.idle.lastUpdate;
    const elapsedSeconds = Math.floor((now - lastUpdate) / 1000);

    if (elapsedSeconds > 0) {
      const str = hunter.stats.STR;
      const focus = hunter.stats.FOCUS;

      // Design v3.0: goldPerSecond = baseGold * (1 + STR * 0.05)
      let goldPerSecond = calculateIdleGold(str);

      // 자동전투 부스트 체크
      if (this.state.idle.autoBattleBoost) {
        if (now < this.state.idle.autoBattleBoost.endTime) {
          goldPerSecond *= GAME_CONSTANTS.AD_REWARDS.AUTO_BATTLE_BOOST.multiplier;
        } else {
          this.state.idle.autoBattleBoost = null;
        }
      }

      // 시뮬레이션 모드 패널티
      if (!this.isRealHunterToday()) {
        goldPerSecond *= GAME_CONSTANTS.REWARD_MULTIPLIER.SIMULATION;
      }

      let goldEarned = Math.floor(goldPerSecond * elapsedSeconds);

      // Design v3.0: 크리티컬 히트 체크 (매 틱마다 critChance = 0.05 + FOCUS * 0.003)
      let isCritical = false;
      if (goldEarned > 0) {
        const critChance = 0.05 + (focus * 0.003); // 5% + FOCUS당 0.3%
        if (Math.random() < critChance) {
          goldEarned *= 2; // 크리티컬 시 골드 2배
          isCritical = true;
        }
      }

      if (goldEarned > 0) {
        hunter.gold += goldEarned;
        this.state.idle.totalGoldEarned += goldEarned;
      }

      this.state.idle.lastUpdate = now;
      this.save();
      this.notify('idle', this.state.idle);

      // Design v3.0: 크리티컬 발생 시 애니메이션 (1.5초 쿨다운 적용)
      if (isCritical) {
        const cooldown = GAME_CONSTANTS.CRITICAL_ANIMATION_COOLDOWN || 1500;
        if (now - this.lastCriticalAnimationTime >= cooldown) {
          this.lastCriticalAnimationTime = now;
          this.notify('critical', { gold: goldEarned });
        }
        // 쿨다운 중이라도 골드는 이미 2배 적용됨
      }
    }
  }

  // 오프라인 보상 계산 (Design v3.0)
  calculateOfflineReward() {
    const hunter = this.state.hunter;
    if (!hunter) return 0;

    const now = Date.now();
    const lastUpdate = this.state.idle.lastUpdate;
    const elapsedSeconds = Math.min(
      Math.floor((now - lastUpdate) / 1000),
      8 * 60 * 60 // 최대 8시간
    );

    const str = hunter.stats.STR;
    let goldPerSecond = calculateIdleGold(str); // Design v3.0: 단순화된 공식
    goldPerSecond *= GAME_CONSTANTS.REWARD_MULTIPLIER.SIMULATION; // 오프라인은 시뮬레이션 배율

    return Math.floor(goldPerSecond * elapsedSeconds);
  }

  // ========== 광고 보상 ==========

  activateAutoBattleBoost() {
    const duration = GAME_CONSTANTS.AD_REWARDS.AUTO_BATTLE_BOOST.duration * 60 * 1000;
    this.state.idle.autoBattleBoost = {
      endTime: Date.now() + duration
    };
    this.state.daily.adWatched.autoBattle = true;
    this.save();
  }

  recoverStaminaByAd() {
    if (this.state.daily.adWatched.stamina >= 3) return false; // 하루 3회 제한

    this.state.daily.stamina = Math.min(
      this.state.daily.stamina + GAME_CONSTANTS.AD_REWARDS.STAMINA_RECOVERY,
      GAME_CONSTANTS.DAILY_STAMINA
    );
    this.state.daily.adWatched.stamina++;
    this.save();
    return true;
  }

  // ========== 변경 리스너 ==========

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    return () => {
      this.listeners.get(key).delete(callback);
    };
  }

  notify(key, value) {
    const keyListeners = this.listeners.get(key);
    if (keyListeners) {
      keyListeners.forEach(callback => callback(value));
    }
    const allListeners = this.listeners.get('*');
    if (allListeners) {
      allListeners.forEach(callback => callback(this.state));
    }
  }

  // 데이터 초기화
  reset() {
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
    }
    localStorage.removeItem(STORAGE_KEY);
    this.state = this.getDefaultState();
    this.notify('*', this.state);
    this.startIdleSystem();
  }
}

// 싱글톤 인스턴스
export const stateManager = new StateManager();
