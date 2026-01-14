// The Hunter System - 게이트 시스템 관리자
import { stateManager } from './stateManager.js';
import { GAME_CONSTANTS, calculateIdleGold } from '../config/constants.js';

// 게이트 타입 상수
const GATE_TYPES = {
  WEEKDAY: {
    id: 'weekday',
    name: '평일 게이트',
    bgClass: 'gate-weekday',
    rewardMultiplier: 1.0
  },
  WEEKEND: {
    id: 'weekend',
    name: '주말 레이드',
    bgClass: 'gate-weekend',
    rewardMultiplier: 5.0
  },
  SUDDEN: {
    id: 'sudden',
    name: '돌발 게이트',
    bgClass: 'gate-sudden',
    rewardMultiplier: 1.0, // 돌발 게이트는 별도 보상 (10분 gps)
    duration: 60 * 60 * 1000 // 1시간
  }
};

class GateSystem {
  constructor() {
    this.currentGate = null;
    this.suddenGateStartTime = null;
    this.suddenGateEndTime = null;
    this.checkInterval = null;
    this.listeners = new Set();
  }

  // 게이트 시스템 초기화
  init() {
    this.initializeDailySuddenGate();
    this.updateCurrentGate();

    // 1분마다 상태 체크
    this.checkInterval = setInterval(() => {
      this.updateCurrentGate();
    }, 60000);
  }

  /**
   * 매일 앱 시작 시 돌발 게이트 시간 생성 및 저장
   * - randomGateStartTime: 오늘 랜덤 시간
   * - randomGateEndTime: start + 1시간
   */
  initializeDailySuddenGate() {
    const daily = stateManager.get('daily');
    const today = stateManager.getLocalDayKey();

    // 이미 오늘 생성된 시간이 있는지 확인
    if (daily?.suddenGate?.date === today && daily?.suddenGate?.startTime) {
      this.suddenGateStartTime = daily.suddenGate.startTime;
      this.suddenGateEndTime = daily.suddenGate.endTime;
      return;
    }

    // 새로운 랜덤 시간 생성 (9:00 ~ 21:00 사이)
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0); // 9AM
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 21, 0, 0);   // 9PM

    // 랜덤 시작 시간 (9시 ~ 20시 사이, 최대 1시간 활성 보장)
    const randomMs = Math.random() * (dayEnd.getTime() - dayStart.getTime() - GATE_TYPES.SUDDEN.duration);
    const startTime = dayStart.getTime() + randomMs;
    const endTime = startTime + GATE_TYPES.SUDDEN.duration;

    this.suddenGateStartTime = startTime;
    this.suddenGateEndTime = endTime;

    // 상태 저장
    stateManager.update('daily', {
      suddenGate: {
        date: today,
        startTime: this.suddenGateStartTime,
        endTime: this.suddenGateEndTime,
        triggered: false,
        cleared: false
      }
    });
  }

  // 현재 게이트 상태 업데이트
  updateCurrentGate() {
    const now = Date.now();

    // 돌발 게이트 활성 시간 체크
    if (this.suddenGateStartTime && this.suddenGateEndTime) {
      if (now >= this.suddenGateStartTime && now < this.suddenGateEndTime) {
        // 처음 진입 시 WARNING 표시
        const daily = stateManager.get('daily');
        if (!daily?.suddenGate?.triggered) {
          this.showSuddenGateWarning();
          stateManager.update('daily', {
            suddenGate: {
              ...daily.suddenGate,
              triggered: true
            }
          });
        }
        this.setCurrentGate(GATE_TYPES.SUDDEN);
        return;
      }
    }

    // 요일 체크
    const day = new Date().getDay();
    const isWeekend = day === 0 || day === 6;

    if (isWeekend) {
      this.setCurrentGate(GATE_TYPES.WEEKEND);
    } else {
      this.setCurrentGate(GATE_TYPES.WEEKDAY);
    }
  }

  // 현재 게이트 설정
  setCurrentGate(gateType) {
    if (this.currentGate?.id !== gateType.id) {
      this.currentGate = gateType;
      this.applyGateBackground();
      this.notifyListeners();
    }
  }

  // 게이트 배경 적용
  applyGateBackground() {
    const body = document.body;

    // 기존 게이트 클래스 제거
    body.classList.remove('gate-weekday', 'gate-weekend', 'gate-sudden');

    // 새 게이트 클래스 추가
    if (this.currentGate) {
      body.classList.add(this.currentGate.bgClass);
    }
  }

  // 현재 게이트 정보 가져오기
  getCurrentGate() {
    return this.currentGate || GATE_TYPES.WEEKDAY;
  }

  // 보상 배율 가져오기
  getGateRewardMultiplier() {
    return this.currentGate?.rewardMultiplier || 1.0;
  }

  /**
   * 돌발 게이트 클리어 보상 계산
   * X = 10분 worth of current gps * multipliers
   */
  calculateSuddenGateReward() {
    const hunter = stateManager.get('hunter');
    if (!hunter) return { exp: 0, gold: 0 };

    const str = hunter.stats.STR;
    const gps = calculateIdleGold(str); // 초당 골드

    // 10분 = 600초
    const baseGold = Math.floor(gps * 600);

    // 헌터 배율 적용
    const hunterMultiplier = stateManager.getCurrentRewardMultiplier();

    // 코스튬 배율 적용
    const costumeMultiplier = stateManager.getCostumeExpBonus();

    return {
      exp: Math.floor(200 * hunterMultiplier * costumeMultiplier), // 기본 EXP 200
      gold: Math.floor(baseGold * hunterMultiplier)
    };
  }

  // 돌발 게이트 클리어 처리
  clearSuddenGate() {
    const daily = stateManager.get('daily');
    if (daily?.suddenGate?.cleared) {
      return { success: false, error: '이미 클리어했습니다' };
    }

    const reward = this.calculateSuddenGateReward();
    stateManager.gainExp(reward.exp);
    stateManager.gainGold(reward.gold);

    stateManager.update('daily', {
      suddenGate: {
        ...daily.suddenGate,
        cleared: true
      }
    });

    return { success: true, reward };
  }

  // 돌발 게이트 WARNING 표시
  showSuddenGateWarning() {
    // 기존 경고 제거
    const existing = document.getElementById('sudden-gate-warning');
    if (existing) existing.remove();

    // 경고 컨테이너 생성
    const warning = document.createElement('div');
    warning.id = 'sudden-gate-warning';
    warning.className = 'sudden-gate-warning';
    warning.innerHTML = `
      <div class="warning-content">
        <div class="warning-noise"></div>
        <div class="warning-text">WARNING</div>
        <div class="warning-subtext">돌발 게이트 출현!</div>
        <div class="warning-timer">1시간 동안 유지</div>
      </div>
    `;

    document.body.appendChild(warning);

    // 3초 후 제거
    setTimeout(() => {
      warning.classList.add('fade-out');
      setTimeout(() => warning.remove(), 500);
    }, 3000);

    // 알림
    if (window.showNotification) {
      window.showNotification('돌발 게이트가 출현했습니다! (1시간)', 'warning');
    }
  }

  // 돌발 게이트 남은 시간
  getSuddenGateRemainingTime() {
    if (!this.suddenGateEndTime) return null;
    const now = Date.now();
    if (now < this.suddenGateStartTime) return null; // 아직 시작 전
    const remaining = this.suddenGateEndTime - now;
    return remaining > 0 ? remaining : null;
  }

  // 돌발 게이트 활성 여부
  isSuddenGateActive() {
    const now = Date.now();
    return this.suddenGateStartTime && this.suddenGateEndTime &&
           now >= this.suddenGateStartTime && now < this.suddenGateEndTime;
  }

  // 돌발 게이트 클리어 여부
  isSuddenGateCleared() {
    const daily = stateManager.get('daily');
    return daily?.suddenGate?.cleared || false;
  }

  // 리스너 등록
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // 리스너 알림
  notifyListeners() {
    this.listeners.forEach(callback => callback(this.currentGate));
  }

  // 정리
  destroy() {
    if (this.checkInterval) clearInterval(this.checkInterval);
  }
}

// 싱글톤 인스턴스
export const gateSystem = new GateSystem();
