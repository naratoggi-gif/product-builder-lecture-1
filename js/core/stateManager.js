// The Hunter System - 상태 관리자
import { GAME_CONSTANTS, getRequiredExp, calculateIdleGold } from '../config/constants.js';

const STORAGE_KEY = GAME_CONSTANTS.STORAGE_KEY;

export class StateManager {
  constructor() {
    this.state = this.getDefaultState();
    this.listeners = new Map();
    this.idleTimer = null;
    this.load();
    this.startIdleSystem();
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

      // 일일 데이터 (매일 리셋)
      daily: {
        date: new Date().toISOString().split('T')[0],
        stamina: GAME_CONSTANTS.DAILY_STAMINA,
        questsCompleted: 0,
        randomGateUsed: false,
        adWatched: {
          autoBattle: false,
          stamina: 0,
          gateRetry: false
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

  // 오늘 날짜 체크 및 일일 리셋
  checkDailyReset() {
    const today = new Date().toISOString().split('T')[0];
    if (this.state.daily.date !== today) {
      // 연속 기록 업데이트
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (this.state.daily.date === yesterdayStr && this.state.daily.questsCompleted > 0) {
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
        randomGateUsed: false,
        adWatched: {
          autoBattle: false,
          stamina: 0,
          gateRetry: false
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

  // 퀘스트 생성
  createQuest(questData) {
    const quest = {
      id: Date.now(),
      title: questData.title,
      category: questData.category,
      grade: questData.grade || 'D',
      staminaCost: GAME_CONSTANTS.QUEST_STAMINA_COST[questData.grade || 'D'],
      reward: GAME_CONSTANTS.QUEST_BASE_REWARDS[questData.grade || 'D'],
      createdAt: new Date().toISOString(),
      completeAvailableAt: null, // 완료 가능 시간 (FOCUS 기반 대기시간 후)
      status: 'pending' // pending, in_progress, completed
    };

    const quests = [...this.state.quests, quest];
    this.set('quests', quests);
    return quest;
  }

  // 퀘스트 시작 (스태미나 소모)
  startQuest(questId) {
    const quest = this.state.quests.find(q => q.id === questId);
    if (!quest) return { success: false, error: '퀘스트를 찾을 수 없습니다' };

    if (this.state.daily.stamina < quest.staminaCost) {
      return { success: false, error: '스태미나가 부족합니다' };
    }

    // 스태미나 소모
    this.state.daily.stamina -= quest.staminaCost;

    // 대기시간 계산 (FOCUS 기반)
    const hunter = this.state.hunter;
    const focus = hunter ? hunter.stats.FOCUS : 5;
    const waitMinutes = this.getQuestWaitTime(focus);
    const completeAvailableAt = new Date(Date.now() + waitMinutes * 60 * 1000).toISOString();

    quest.status = 'in_progress';
    quest.completeAvailableAt = completeAvailableAt;

    this.set('quests', this.state.quests);
    this.save();

    return { success: true, waitMinutes, completeAvailableAt };
  }

  // 퀘스트 대기시간 계산
  getQuestWaitTime(focus) {
    const tier = GAME_CONSTANTS.FOCUS_WAIT_TIME.find(t => focus >= t.min && focus <= t.max);
    return tier ? tier.minutes : 10;
  }

  // 퀘스트 완료
  completeQuest(questId) {
    const questIndex = this.state.quests.findIndex(q => q.id === questId);
    if (questIndex === -1) return { success: false, error: '퀘스트를 찾을 수 없습니다' };

    const quest = this.state.quests[questIndex];

    // 완료 가능 시간 체크
    if (quest.completeAvailableAt && new Date(quest.completeAvailableAt) > new Date()) {
      return { success: false, error: '아직 완료할 수 없습니다' };
    }

    // 보상 계산 (100% - 리얼 헌터)
    const hunter = this.state.hunter;
    const intBonus = hunter ? 1 + (hunter.stats.INT * 0.02) : 1;
    const expReward = Math.floor(quest.reward.exp * intBonus);
    const goldReward = Math.floor(quest.reward.gold * intBonus);

    // 카테고리에 따른 스탯 보너스
    const category = GAME_CONSTANTS.QUEST_CATEGORIES[quest.category];
    let statGain = null;
    if (category && category.stat !== 'STAMINA' && hunter) {
      // 10% 확률로 해당 스탯 +1
      if (Math.random() < 0.1) {
        hunter.stats[category.stat]++;
        statGain = category.stat;
      }
    } else if (category && category.stat === 'STAMINA') {
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

  // 오늘 실제 퀘스트를 완료했는지 확인
  isRealHunterToday() {
    return this.state.daily.questsCompleted > 0;
  }

  // 현재 보상 배율 가져오기
  getCurrentRewardMultiplier() {
    return this.isRealHunterToday()
      ? GAME_CONSTANTS.REWARD_MULTIPLIER.REAL_HUNTER
      : GAME_CONSTANTS.REWARD_MULTIPLIER.SIMULATION;
  }

  // ========== 아이들 시스템 ==========

  startIdleSystem() {
    // 1초마다 아이들 골드 계산
    this.idleTimer = setInterval(() => {
      this.updateIdleGold();
    }, 1000);
  }

  updateIdleGold() {
    const hunter = this.state.hunter;
    if (!hunter) return;

    const now = Date.now();
    const lastUpdate = this.state.idle.lastUpdate;
    const elapsedSeconds = Math.floor((now - lastUpdate) / 1000);

    if (elapsedSeconds > 0) {
      const str = hunter.stats.STR;
      const questsToday = this.state.daily.questsCompleted;
      let goldPerSecond = calculateIdleGold(str, questsToday);

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

      const goldEarned = Math.floor(goldPerSecond * elapsedSeconds);
      if (goldEarned > 0) {
        hunter.gold += goldEarned;
        this.state.idle.totalGoldEarned += goldEarned;
      }

      this.state.idle.lastUpdate = now;
      this.save();
      this.notify('idle', this.state.idle);
    }
  }

  // 오프라인 보상 계산
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
    let goldPerSecond = calculateIdleGold(str, 0); // 오프라인은 퀘스트 보너스 없음
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
