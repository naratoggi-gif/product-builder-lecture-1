// The Hunter System - 상태 관리자
import { GAME_CONSTANTS, getRequiredExp, calculateIdleGold, getAutoBattleCritRate, calculateRefineCost, getUnlocksAtLevel, UNLOCK_DETAILS } from '../config/constants.js';
import { getCostumeById, getCostumeStatBonus, canEquipCostume } from '../config/costumes.js';

const STORAGE_KEY = GAME_CONSTANTS.STORAGE_KEY;

export class StateManager {
  constructor() {
    this.state = this.getDefaultState();
    this.listeners = new Map();
    this.idleTimer = null;
    this.load();
    this.startIdleSystem();
  }

  // 로컬 타임존 기준 오늘 날짜 키 (YYYY-MM-DD) - ISO 형식
  getTodayKey(date = new Date()) {
    return date.toLocaleDateString('en-CA'); // YYYY-MM-DD 형식
  }

  // 레거시 호환성
  getLocalDayKey(date = new Date()) {
    return this.getTodayKey(date);
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

      // 일일 데이터 (매일 리셋) - v5.0 Dual Economy
      // todayKey = new Date().toLocaleDateString('en-CA') → YYYY-MM-DD
      daily: {
        date: this.getTodayKey(),
        stamina: GAME_CONSTANTS.DAILY_STAMINA,
        questsCompleted: 0,
        restQuestsCompleted: 0,
        restCountForRealHunter: 0, // v5.0: 휴식 퀘스트 중 Real Hunter에 인정된 횟수 (max 1)
        randomGateUsed: false,
        adWatched: {
          autoBattle: false,
          stamina: 0,
          gateRetry: false
        },
        suddenGate: {
          triggered: false,
          endTime: null
        },
        // v5.0 Daily Essence Tracking
        questEssenceEarned: 0,     // 오늘 퀘스트에서 얻은 에센스
        condenserEssenceEarned: 0, // 오늘 컨덴서에서 얻은 에센스
        condenserLastTick: null    // 마지막 컨덴서 틱 시간
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

      // v5.0: Real Hunter 판정 (휴식 퀘스트는 restCountForRealHunter로 추적)
      const { questsCompleted, restQuestsCompleted, restCountForRealHunter } = this.state.daily;
      const nonRestQuests = questsCompleted - restQuestsCompleted;
      const restContribution = restCountForRealHunter || 0;
      const eligibleQuests = nonRestQuests + restContribution;
      const wasRealHunter = eligibleQuests >= 1;

      if (this.state.daily.date === yesterdayStr && wasRealHunter) {
        this.state.statistics.currentStreak++;
        if (this.state.statistics.currentStreak > this.state.statistics.longestStreak) {
          this.state.statistics.longestStreak = this.state.statistics.currentStreak;
        }
      } else {
        this.state.statistics.currentStreak = 0;
      }

      // 일일 데이터 리셋 - v5.0 Dual Economy
      this.state.daily = {
        date: today,
        stamina: GAME_CONSTANTS.DAILY_STAMINA,
        questsCompleted: 0,
        restQuestsCompleted: 0,
        restCountForRealHunter: 0,
        randomGateUsed: false,
        adWatched: {
          autoBattle: false,
          stamina: 0,
          gateRetry: false
        },
        suddenGate: {
          triggered: false,
          endTime: null
        },
        // v5.0 Daily Essence Tracking reset
        questEssenceEarned: 0,
        condenserEssenceEarned: 0,
        condenserLastTick: null
      };
      this.save();
    }
  }

  // 로컬 스토리지에서 불러오기 (v5.0 Dual Economy Migration)
  load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        this.state = { ...this.getDefaultState(), ...data };

        // ========== Hunter Migration ==========
        if (this.state.hunter) {
          // v5.0: Ensure gold field exists (default 0)
          if (typeof this.state.hunter.gold === 'undefined') {
            this.state.hunter.gold = 0;
          }

          // v5.0: Ensure essence field exists (default 0)
          if (typeof this.state.hunter.essence === 'undefined') {
            this.state.hunter.essence = 0;
          }

          // Legacy cleanup: Remove old statExp system
          if (this.state.hunter.statExp) delete this.state.hunter.statExp;

          // Ensure statTraining exists for refine system
          if (!this.state.hunter.statTraining) {
            this.state.hunter.statTraining = { STR: 0, INT: 0, WIL: 0, FOCUS: 0, LUK: 0 };
          }

          // Migration: Gender (default for existing users)
          if (!this.state.hunter.gender) {
            this.state.hunter.gender = 'male';
          }

          // Migration: Unlocked Features (process unlocks based on level)
          if (!this.state.hunter.unlockedFeatures) {
            this.state.hunter.unlockedFeatures = [];
            for (let lvl = 1; lvl <= this.state.hunter.level; lvl++) {
              const unlocks = getUnlocksAtLevel(lvl);
              for (const unlockId of unlocks) {
                if (!this.state.hunter.unlockedFeatures.includes(unlockId)) {
                  this.state.hunter.unlockedFeatures.push(unlockId);
                }
              }
            }
          }
        }

        // ========== Daily Data Migration (v5.0) ==========
        if (this.state.daily) {
          // v5.0: Ensure questEssenceEarned exists (default 0)
          if (typeof this.state.daily.questEssenceEarned === 'undefined') {
            // Migrate from old field name if exists
            this.state.daily.questEssenceEarned = this.state.daily.essenceFromQuests || 0;
          }

          // v5.0: Ensure condenserEssenceEarned exists (default 0)
          if (typeof this.state.daily.condenserEssenceEarned === 'undefined') {
            // Migrate from old field name if exists
            this.state.daily.condenserEssenceEarned = this.state.daily.condenserEarned || 0;
          }

          // v5.0: Ensure restCountForRealHunter exists (default 0)
          if (typeof this.state.daily.restCountForRealHunter === 'undefined') {
            // Migrate from old boolean to count
            this.state.daily.restCountForRealHunter =
              this.state.daily.restQuestCountedForRealHunter ? 1 : 0;
          }

          // Cleanup old field names
          delete this.state.daily.essenceFromQuests;
          delete this.state.daily.condenserEarned;
          delete this.state.daily.restQuestCountedForRealHunter;
        }

        // Save migrated data
        this.save();
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

  // 기능 해금 여부 확인
  isFeatureUnlocked(featureId) {
    const hunter = this.state.hunter;
    if (!hunter || !hunter.unlockedFeatures) return false;
    return hunter.unlockedFeatures.includes(featureId);
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

  // 헌터 생성 (v5.0 Dual Economy)
  createHunter(name, gender = 'male') {
    const hunter = {
      id: Date.now(),
      name,
      gender, // 성별 (male/female) - UI/아바타 전용
      level: 1,
      exp: 0,
      // v5.0 Dual Economy currencies
      gold: 0,    // Gold: earned via idle, spent on stat refinement
      essence: 0, // Essence: earned via quests, spent on costumes/skills
      stats: { ...GAME_CONSTANTS.INITIAL_STATS },
      statTraining: { STR: 0, INT: 0, WIL: 0, FOCUS: 0, LUK: 0 }, // 연마 진행도
      statPoints: 0, // 레거시 유지
      unlockedFeatures: [], // 해금된 기능들
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
    if (!hunter) return { leveledUp: false, newUnlocks: [] };

    hunter.exp += amount;

    // 레벨업 체크
    let leveledUp = false;
    let startLevel = hunter.level;
    const newUnlocks = [];

    while (hunter.exp >= getRequiredExp(hunter.level)) {
      hunter.exp -= getRequiredExp(hunter.level);
      hunter.level++;
      leveledUp = true;

      // 해당 레벨에서 해금되는 기능들 처리
      const unlocks = getUnlocksAtLevel(hunter.level);
      for (const unlockId of unlocks) {
        if (!hunter.unlockedFeatures.includes(unlockId)) {
          hunter.unlockedFeatures.push(unlockId);
          newUnlocks.push({
            id: unlockId,
            ...UNLOCK_DETAILS[unlockId]
          });

          // 랭크 업 처리
          if (unlockId === 'RANK_UP_D') hunter.rank = 'D';
          if (unlockId === 'RANK_UP_C') hunter.rank = 'C';
          if (unlockId === 'RANK_UP_B') hunter.rank = 'B';
        }
      }
    }

    this.set('hunter', hunter);

    // 새 해금이 있으면 알림
    if (newUnlocks.length > 0) {
      this.notify('levelUnlock', {
        oldLevel: startLevel,
        newLevel: hunter.level,
        unlocks: newUnlocks
      });
    }

    return { leveledUp, newLevel: hunter.level, newUnlocks };
  }

  // 골드 획득
  gainGold(amount) {
    const hunter = this.state.hunter;
    if (!hunter) return;
    hunter.gold += amount;
    this.set('hunter', hunter);
  }

  // 스탯 연마 (v5.0 Dual Economy: Gold is used for idle growth/stat refinement)
  // Alias for legacy support, but prefers upgradeStatWithGold
  refineStat(statName, amount) {
    return this.upgradeStatWithGold(statName, amount);
  }

  // v5.0: Upgrade Stat using Gold Only
  upgradeStatWithGold(statName, amount) {
    const hunter = this.state.hunter;
    if (!hunter) return { success: false, error: '헌터 정보가 없습니다' };

    // v5.0: Use gold instead of essence for stat refinement (idle growth)
    if (hunter.gold < amount) return { success: false, error: '골드가 부족합니다' };

    hunter.gold -= amount;
    hunter.statTraining[statName] = (hunter.statTraining[statName] || 0) + amount;

    let levelUp = false;
    let cost = calculateRefineCost(hunter.stats[statName]);

    while (hunter.statTraining[statName] >= cost) {
      hunter.statTraining[statName] -= cost;
      hunter.stats[statName]++;
      levelUp = true;
      cost = calculateRefineCost(hunter.stats[statName]); // 다음 레벨 비용 재계산
    }

    this.save();
    this.notify('hunter', hunter);

    return { success: true, levelUp, newStatValue: hunter.stats[statName] };
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

  /**
   * 퀘스트 완료 - v5.0 Dual Economy
   *
   * Rewards:
   * - EXP: grade-based, affected by INT bonus & costume
   * - Essence: grade-based (E:5, D:10, C:15, B:20, A:30, S:40)
   * - Gold: NONE (earned via idle only)
   *
   * Rest/Recovery quests:
   * - Grant stamina recovery (+20)
   * - Count toward Real Hunter only ONCE per day
   * - Do NOT grant essence
   */
  completeQuest(questId) {
    const questIndex = this.state.quests.findIndex(q => q.id === questId);
    if (questIndex === -1) return { success: false, error: '퀘스트를 찾을 수 없습니다' };

    const quest = this.state.quests[questIndex];

    // 완료 가능 시간 체크
    if (quest.completeAvailableAt && new Date(quest.completeAvailableAt) > new Date()) {
      return { success: false, error: '아직 완료할 수 없습니다' };
    }

    const hunter = this.state.hunter;
    if (!hunter) return { success: false, error: '헌터 정보가 없습니다' };

    // Calculate EXP reward (with INT & costume bonuses)
    const effectiveStats = this.getEffectiveStats() || hunter.stats;
    const intBonus = 1 + (effectiveStats.INT * 0.02);
    const costumeBonus = this.getCostumeBonus();
    const expReward = Math.floor(quest.reward.exp * intBonus * costumeBonus.expMult);

    // Determine quest category
    const category = GAME_CONSTANTS.QUEST_CATEGORIES[quest.category];
    const isRestQuest = category && category.stat === 'STAMINA';

    let essenceGained = 0;
    let countsForRealHunter = false;

    // Ensure daily tracking fields exist
    if (typeof this.state.daily.questEssenceEarned === 'undefined') {
      this.state.daily.questEssenceEarned = 0;
    }
    if (typeof this.state.daily.restCountForRealHunter === 'undefined') {
      this.state.daily.restCountForRealHunter = 0;
    }

    if (isRestQuest) {
      // ===== REST/RECOVERY QUEST =====
      // Stamina recovery
      this.state.daily.stamina = Math.min(
        this.state.daily.stamina + 20,
        GAME_CONSTANTS.DAILY_STAMINA
      );

      // Rest quest counts toward Real Hunter only ONCE per day
      if (this.state.daily.restCountForRealHunter < 1) {
        this.state.daily.restCountForRealHunter = 1;
        countsForRealHunter = true;
      }
      // No essence for rest quests

    } else {
      // ===== REGULAR QUEST =====
      // Calculate essence reward (grade-based: E:5, D:10, C:15, B:20, A:30, S:40)
      const baseEssence = GAME_CONSTANTS.ESSENCE_GAIN[quest.grade] || 5;

      // v5.0: Essence is "proof currency" - NO multipliers applied
      // Hunter multiplier does NOT affect essence (only affects gold/idle)
      essenceGained = baseEssence;

      // Grant essence
      if (typeof hunter.essence === 'undefined') hunter.essence = 0;
      hunter.essence += essenceGained;

      // Track daily essence earned (todayKey scoped)
      this.state.daily.questEssenceEarned += essenceGained;

      // Regular quests always count for Real Hunter
      countsForRealHunter = true;
    }

    // Grant EXP reward
    this.gainExp(expReward);

    // Mark quest completed
    quest.status = 'completed';
    quest.completedAt = new Date().toISOString();

    // Update daily counters
    this.state.daily.questsCompleted++;
    if (isRestQuest) {
      this.state.daily.restQuestsCompleted++;
    }
    this.state.statistics.totalQuestsCompleted++;

    this.save();

    return {
      success: true,
      rewards: { exp: expReward, essenceGained },
      countsForRealHunter
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

  // ========== 헌터 모드 체크 (v5.0) ==========

  /**
   * Real Hunter 판정 로직 (v5.0):
   * - Real Hunter: >= 1 non-rest quest completed today
   * - Rest/Recovery quest counts toward Real Hunter ONCE per day only
   * - Otherwise: Simulation Hunter
   *
   * 계산:
   *   nonRestQuests = questsCompleted - restQuestsCompleted
   *   eligibleQuests = nonRestQuests + restCountForRealHunter (max 1)
   *
   * @param {string} [todayKey] - Optional date key (YYYY-MM-DD), defaults to today
   * @returns {boolean} true if Real Hunter, false if Simulation
   */
  isRealHunterToday(todayKey = null) {
    this.checkDailyReset();

    // Verify todayKey matches current daily data
    const currentKey = this.getTodayKey();
    if (todayKey && todayKey !== currentKey) {
      // If checking a different day, they're not Real Hunter for that day
      return false;
    }

    const { questsCompleted, restQuestsCompleted, restCountForRealHunter } = this.state.daily;

    // Non-rest quests always count toward Real Hunter
    const nonRestQuests = questsCompleted - restQuestsCompleted;

    // Rest quests count only once per day (tracked by restCountForRealHunter, max 1)
    const restContribution = restCountForRealHunter || 0;

    // Total eligible quests for Real Hunter status
    const eligibleQuests = nonRestQuests + restContribution;

    return eligibleQuests >= 1;
  }

  /**
   * Get Hunter Type for today (v5.0)
   * @param {string} [todayKey] - Optional date key (YYYY-MM-DD)
   * @returns {'Real' | 'Simulation'} Hunter type string
   */
  getHunterType(todayKey = null) {
    return this.isRealHunterToday(todayKey) ? 'Real' : 'Simulation';
  }

  /**
   * Get Hunter Multiplier for GOLD/IDLE rewards only (v5.0)
   *
   * IMPORTANT: This multiplier applies ONLY to:
   * - Idle gold generation
   * - Offline gold rewards
   * - Ad boost gold
   *
   * This multiplier does NOT apply to:
   * - Essence (proof currency - earned from real-life quests)
   * - EXP rewards
   *
   * @returns {number} 1.0 for Real Hunter, 0.35 for Simulation
   */
  getHunterMultiplier() {
    return this.isRealHunterToday()
      ? GAME_CONSTANTS.REWARD_MULTIPLIER.REAL_HUNTER   // 1.0
      : GAME_CONSTANTS.REWARD_MULTIPLIER.SIMULATION;  // 0.35
  }

  // Legacy alias for backwards compatibility
  getCurrentRewardMultiplier() {
    return this.getHunterMultiplier();
  }

  // 장착된 코스튬의 EXP 배율 가져오기
  getCostumeExpBonus() {
    const bonus = this.getCostumeBonus();
    return bonus.expMult;
  }

  // 장착된 코스튬의 골드 배율 가져오기
  // v5.1: 코스튬 장착 시 무조건 2배 골드 적용 (시너지 효과)
  getCostumeGoldBonus() {
    const equippedCostume = this.state.equippedCostume;
    // 코스튬이 장착되어 있으면 2x, 아니면 1x
    return equippedCostume ? 2.0 : 1.0;
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

  // ========== 코스튬 관리 (v5.0 Hunter Growth) ==========

  /**
   * Purchase Costume with Essence
   * @param {string} costumeId
   * @returns {Object} result { success, error }
   */
  purchaseCostume(costumeId) {
    const hunter = this.state.hunter;
    if (!hunter) return { success: false, error: '헌터 정보가 없습니다' };

    // Check if already owned
    if (this.state.costumes.includes(costumeId)) {
      return { success: false, error: '이미 보유한 코스튬입니다' };
    }

    const costume = getCostumeById(costumeId);
    if (!costume) return { success: false, error: '존재하지 않는 코스튬입니다' };

    // Check price (Essence)
    if (hunter.essence < costume.essencePrice) {
      return { success: false, error: '에센스가 부족합니다' };
    }

    // Deduct Essence
    hunter.essence -= costume.essencePrice;
    
    // Add to owned costumes
    this.state.costumes.push(costumeId);
    
    this.save();
    this.notify('hunter', hunter);
    this.notify('costumes', this.state.costumes);

    return { success: true };
  }

  /**
   * Equip Costume
   * @param {string} costumeId
   * @returns {Object} result { success, error }
   */
  equipCostume(costumeId) {
    const hunter = this.state.hunter;
    if (!hunter) return { success: false, error: '헌터 정보가 없습니다' };

    // Check ownership (Basic hunter is always available if ID is 'hunter_basic')
    if (costumeId !== 'hunter_basic' && !this.state.costumes.includes(costumeId)) {
       return { success: false, error: '보유하지 않은 코스튬입니다' };
    }

    // Update equipped costume
    this.state.equippedCostume = costumeId === 'hunter_basic' ? null : costumeId;
    
    this.save();
    this.notify('hunter', hunter); // Notify hunter update for stat changes

    return { success: true };
  }

  // ========== 상점 시스템 (v5.0) ==========

  /**
   * Purchase Generic Item (Consumables, etc.)
   * @param {Object} item - Shop item object { id, name, price, currency, ... }
   * @returns {Object} result { success, error }
   */
  purchaseItem(item) {
    const hunter = this.state.hunter;
    if (!hunter) return { success: false, error: '헌터 정보가 없습니다' };

    // v5.0: Dual Economy Check
    if (item.currency === 'essence') {
        if (hunter.essence < item.price) {
            return { success: false, error: '에센스가 부족합니다' };
        }
        hunter.essence -= item.price;
    } else if (item.currency === 'gold') {
        if (hunter.gold < item.price) {
            return { success: false, error: '골드가 부족합니다' };
        }
        hunter.gold -= item.price;
    } else {
        return { success: false, error: '알 수 없는 화폐입니다' };
    }

    // TODO: Add to inventory (Inventory system implementation)
    // For now, we assume immediate use or just successful transaction for the shop demo
    
    this.save();
    this.notify('hunter', hunter);

    return { success: true };
  }

  // ========== 아이들 시스템 ==========

  startIdleSystem() {
    // 크리티컬 애니메이션쿨다운 타임스탬프 초기화
    this.lastCriticalAnimationTime = 0;

    // 1초마다 아이들 골드 계산
    this.idleTimer = setInterval(() => {
      this.updateIdleGold();
    }, 1000);
  }

  /**
   * Update Idle Gold (v5.0 Dual Economy)
   *
   * Gold calculation: goldPerSecond = baseGold * (1 + STR * 0.05)
   *
   * Multipliers applied to GOLD ONLY:
   * - Hunter Multiplier: Real=1.0, Simulation=0.35
   * - Auto Battle Boost: x2 (from ads)
   * - Critical Hit: x2 (5% + FOCUS*0.3% chance)
   * - Costume Multiplier: x(1.0 ~ 3.0) (v5.0)
   *
   * NOTE: Essence is NOT affected by hunter multiplier (proof currency)
   */
  updateIdleGold() {
    const hunter = this.state.hunter;
    if (!hunter) return;

    const now = Date.now();
    const lastUpdate = this.state.idle.lastUpdate;
    const elapsedSeconds = Math.floor((now - lastUpdate) / 1000);

    if (elapsedSeconds > 0) {
      // --- GOLD CALCULATION ---
      const str = hunter.stats.STR;
      const focus = hunter.stats.FOCUS;

      // Base gold per second: baseGold * (1 + STR * 0.05)
      let goldPerSecond = calculateIdleGold(str);

      // Auto Battle Boost (from ads): x2 multiplier
      if (this.state.idle.autoBattleBoost) {
        if (now < this.state.idle.autoBattleBoost.endTime) {
          goldPerSecond *= GAME_CONSTANTS.AD_REWARDS.AUTO_BATTLE_BOOST.multiplier;
        } else {
          this.state.idle.autoBattleBoost = null;
        }
      }

      // v5.0: Hunter Multiplier applies to GOLD ONLY (not Essence)
      // Real Hunter: 1.0x, Simulation: 0.35x
      goldPerSecond *= this.getHunterMultiplier();

      // v5.0: Apply Costume Gold Multiplier
      goldPerSecond *= this.getCostumeGoldBonus();

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

      // --- ESSENCE CONDENSER (v5.0) ---
      // While app is open, generate passive Essence slowly.
      // Rule: Multiplier = min(5, 1 + completedQuests)
      // Cap: dailyQuestEssence * 0.4
      
      const dailyQuestEssence = this.state.daily.questEssenceEarned || 0;
      const condenserCap = dailyQuestEssence * 0.4;
      const currentCondenserEarned = this.state.daily.condenserEssenceEarned || 0;
      
      let essenceGained = 0;

      if (condenserCap > 0 && currentCondenserEarned < condenserCap) {
         const BASE_ESSENCE_RATE = 0.01; // Base essence per second (slow)
         const questsCompleted = this.state.daily.questsCompleted || 0;
         const multiplier = Math.min(5, 1 + questsCompleted);
         
         const essenceToGenerate = BASE_ESSENCE_RATE * multiplier * elapsedSeconds;
         const remainingCap = condenserCap - currentCondenserEarned;
         
         const actualGain = Math.min(essenceToGenerate, remainingCap);
         
         if (actualGain > 0) {
            // Update daily tracker (float precision)
            this.state.daily.condenserEssenceEarned = currentCondenserEarned + actualGain;
            
            // Add integer part to hunter essence
            const previousInt = Math.floor(currentCondenserEarned);
            const newInt = Math.floor(this.state.daily.condenserEssenceEarned);
            const deltaInt = newInt - previousInt;
            
            if (deltaInt > 0) {
                hunter.essence += deltaInt;
                essenceGained = deltaInt;
            }
         }
      }

      this.state.idle.lastUpdate = now;
      this.save();
      
      this.notify('idle', this.state.idle);
      if (essenceGained > 0) {
         this.notify('hunter', hunter);
      }

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

  /**
   * Calculate Offline Gold Reward (v5.0)
   *
   * Offline rewards use Simulation multiplier (0.35x) always
   * because we can't verify real-life activity while offline.
   *
   * This is GOLD ONLY - Essence cannot be earned offline.
   *
   * @returns {number} Gold earned while offline (max 8 hours)
   */
  calculateOfflineReward() {
    const hunter = this.state.hunter;
    if (!hunter) return 0;

    const now = Date.now();
    const lastUpdate = this.state.idle.lastUpdate;
    const elapsedSeconds = Math.min(
      Math.floor((now - lastUpdate) / 1000),
      8 * 60 * 60 // Max 8 hours
    );

    const str = hunter.stats.STR;
    let goldPerSecond = calculateIdleGold(str);

    // v5.0: Offline always uses Simulation multiplier (0.35x)
    // Hunter multiplier only applies to GOLD, not Essence
    goldPerSecond *= GAME_CONSTANTS.REWARD_MULTIPLIER.SIMULATION;

    return Math.floor(goldPerSecond * elapsedSeconds);
  }

  // ========== 광고 보상 (v5.0: Gold Only, Never Essence) ==========

  /**
   * Activate Auto Battle Boost (v5.0)
   *
   * IMPORTANT: Ads grant GOLD boosts only, NEVER Essence.
   * Essence is "proof currency" earned only through real-life quests.
   *
   * Effect: x2 gold for 30 minutes
   * State: idle.autoBattleBoost = { endTime: timestamp }
   */
  activateAutoBattleBoost() {
    const duration = GAME_CONSTANTS.AD_REWARDS.AUTO_BATTLE_BOOST.duration * 60 * 1000; // 30 min
    this.state.idle.autoBattleBoost = {
      endTime: Date.now() + duration
    };
    this.state.daily.adWatched.autoBattle = true;
    this.save();
  }

  /**
   * Check if Auto Battle Boost is active
   * @returns {{ active: boolean, remainingMs: number, remainingMin: number }}
   */
  getAutoBattleBoostStatus() {
    const boost = this.state.idle.autoBattleBoost;
    if (!boost || !boost.endTime) {
      return { active: false, remainingMs: 0, remainingMin: 0 };
    }

    const remainingMs = Math.max(0, boost.endTime - Date.now());
    if (remainingMs <= 0) {
      return { active: false, remainingMs: 0, remainingMin: 0 };
    }

    return {
      active: true,
      remainingMs,
      remainingMin: Math.ceil(remainingMs / 60000)
    };
  }

  /**
   * Recover stamina by watching ad (v5.0)
   *
   * This grants STAMINA, not Gold or Essence.
   * Limit: 3x per day, +20 stamina each
   */
  recoverStaminaByAd() {
    if (this.state.daily.adWatched.stamina >= 3) return false; // 3x daily limit

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