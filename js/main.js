// The Hunter System - 메인 앱 (v6.1)
// v6.1 Features:
// - Progress Refining: 게이지 기반 스탯 연마 시스템
// - Hunter ID Card: 헌터 자격증 UI (랭크/칭호 실시간 반영)
// - Costume Synergy: 코스튬 장착 시 외형 변화 + 골드 x2
// - Dual Economy: Gold(스탯 연마) / Essence(코스튬 구매) 완전 분리
// - Code Stability: en-CA 로캘, localStorage 백업
import { router } from './ui/router.js';
import { stateManager } from './core/stateManager.js';
import { gateSystem } from './core/gateSystem.js';
import { renderDashboard } from './ui/screens/dashboard.js';
import { renderQuests } from './ui/screens/quests.js';
import { renderHunter } from './ui/screens/hunter.js';
import { renderIdleGrowth } from './ui/screens/idleGrowth.js';
import { renderHunterGrowth } from './ui/screens/hunterGrowth.js';
import { renderGates } from './ui/screens/gates.js';
import { renderShop } from './ui/screens/shop.js';
import { renderAwakening } from './ui/screens/awakening.js';
import { renderGuild } from './ui/screens/guild.js';
import { GAME_CONSTANTS, getNextUnlockInfo } from './config/constants.js';

const APP_VERSION = '6.3.0';

// 앱 초기화
function initApp() {
  // 라우트 등록
  router.register('dashboard', renderDashboard);
  router.register('quests', renderQuests);
  router.register('hunter', renderHunter);
  router.register('idle-growth', renderIdleGrowth);
  router.register('hunter-growth', renderHunterGrowth);
  router.register('gates', renderGates);
  router.register('shop', renderShop);
  router.register('guild', renderGuild);
  router.register('awakening', renderAwakening);

  // 네비게이션 바 렌더링
  renderNavbar();

  // 테마 적용
  applyTheme();

  // 헌터가 없으면 각성 화면으로
  const hunter = stateManager.get('hunter');
  if (!hunter) {
    window.location.hash = 'awakening';
  }

  // 초기 라우트 실행
  router.init();

  // 상태 변경 구독
  stateManager.subscribe('settings', () => {
    applyTheme();
  });

  // 헌터 상태 표시 업데이트
  stateManager.subscribe('hunter', updateHunterStatus);
  stateManager.subscribe('hunter', updateGpsDisplay);
  stateManager.subscribe('guild', updateGpsDisplay);
  updateHunterStatus();
  updateGpsDisplay();

  // 게이트 시스템 초기화
  gateSystem.init();
  gateSystem.subscribe(updateGateIndicator);
  updateGateIndicator();

  // 레벨 해금 이벤트 구독
  stateManager.subscribe('levelUnlock', showUnlockRewardModal);

  // v6.1: 랭크 승급 이벤트 구독
  stateManager.subscribe('rankUp', showRankUpModal);

  // 오프라인 보상 체크
  checkOfflineReward();
}

// 네비게이션 바
function renderNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  navbar.innerHTML = `
    <a href="#dashboard" class="nav-item" data-route="dashboard">
      <span class="nav-icon">&#127968;</span>
      <span class="nav-label">홈</span>
    </a>
    <a href="#quests" class="nav-item" data-route="quests">
      <span class="nav-icon">&#128203;</span>
      <span class="nav-label">퀘스트</span>
    </a>
    <a href="#hunter" class="nav-item" data-route="hunter">
      <span class="nav-icon">&#129333;</span>
      <span class="nav-label">헌터</span>
    </a>
    <a href="#idle-growth" class="nav-item" data-route="idle-growth">
      <span class="nav-icon">&#128200;</span>
      <span class="nav-label">스탯</span>
    </a>
    <a href="#hunter-growth" class="nav-item" data-route="hunter-growth">
      <span class="nav-icon">&#128084;</span>
      <span class="nav-label">전직</span>
    </a>
    <a href="#gates" class="nav-item" data-route="gates">
      <span class="nav-icon">&#128682;</span>
      <span class="nav-label">게이트</span>
    </a>
    <a href="#guild" class="nav-item" data-route="guild">
      <span class="nav-icon">&#127970;</span>
      <span class="nav-label">길드</span>
    </a>
    <a href="#shop" class="nav-item" data-route="shop">
      <span class="nav-icon">&#128176;</span>
      <span class="nav-label">상점</span>
    </a>
  `;

  updateActiveNav();
  window.addEventListener('hashchange', updateActiveNav);
}

function updateActiveNav() {
  const hash = window.location.hash.slice(1) || 'dashboard';
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.route === hash);
  });
}

// 헌터 상태 표시
function updateHunterStatus() {
  const statusEl = document.getElementById('hunterStatus');
  if (!statusEl) return;

  const hunter = stateManager.get('hunter');
  if (!hunter) {
    statusEl.innerHTML = '';
    return;
  }

  const isRealHunter = stateManager.isRealHunterToday();
  const statusClass = isRealHunter ? 'real-hunter' : 'simulation';
  const statusText = isRealHunter ? 'REAL' : 'SIM';

  statusEl.innerHTML = `
    <span class="status-badge ${statusClass}">${statusText}</span>
  `;
}

// v6.3: GPS 표시 업데이트
function updateGpsDisplay() {
  let gpsEl = document.getElementById('gpsDisplay');

  const hunter = stateManager.get('hunter');
  if (!hunter) {
    if (gpsEl) gpsEl.remove();
    return;
  }

  // Create GPS display element if it doesn't exist
  if (!gpsEl) {
    const headerLeft = document.querySelector('.header-left');
    if (!headerLeft) return;

    gpsEl = document.createElement('div');
    gpsEl.id = 'gpsDisplay';
    gpsEl.className = 'gps-hud-display';
    headerLeft.appendChild(gpsEl);
  }

  // Calculate total GPS
  const totalGps = stateManager.getTotalGuildGps();

  gpsEl.innerHTML = `
    <span class="gps-icon">💰</span>
    <span class="gps-value">+${totalGps.toFixed(1)}/s</span>
  `;
}

// 게이트 인디케이터 업데이트
function updateGateIndicator() {
  // 게이트 인디케이터 컨테이너 확인/생성
  let indicatorEl = document.getElementById('gateIndicator');
  if (!indicatorEl) {
    const headerLeft = document.querySelector('.header-left');
    if (!headerLeft) return;

    indicatorEl = document.createElement('div');
    indicatorEl.id = 'gateIndicator';
    headerLeft.appendChild(indicatorEl);
  }

  const hunter = stateManager.get('hunter');
  if (!hunter) {
    indicatorEl.innerHTML = '';
    return;
  }

  const currentGate = gateSystem.getCurrentGate();
  const gateIcons = {
    weekday: '&#128682;',
    weekend: '&#128128;',
    sudden: '&#9888;'
  };

  let extraInfo = '';
  if (currentGate.id === 'sudden') {
    const remaining = gateSystem.getSuddenGateRemainingTime();
    if (remaining) {
      const mins = Math.ceil(remaining / 60000);
      extraInfo = ` (${mins}분)`;
    }
  } else if (currentGate.id === 'weekend') {
    extraInfo = ' (x5)';
  }

  indicatorEl.innerHTML = `
    <div class="gate-indicator ${currentGate.id}">
      <span class="gate-icon">${gateIcons[currentGate.id] || '&#128682;'}</span>
      <span>${currentGate.name}${extraInfo}</span>
    </div>
  `;
}

// 테마 적용
function applyTheme() {
  const settings = stateManager.get('settings');
  const isDark = settings.theme === 'dark';

  // Apply theme class
  document.body.classList.toggle('light-theme', !isDark);
  document.body.classList.toggle('dark-theme', isDark);

  // Update theme icon
  const themeIcon = document.querySelector('.theme-icon');
  if (themeIcon) {
    themeIcon.innerHTML = isDark ? '&#9728;' : '&#127769;'; // Sun for dark mode (switch to light), Moon for light mode (switch to dark)
  }

  // Update meta theme-color
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.content = isDark ? '#0a0a1a' : '#f8fafc';
  }
}

// 테마 토글
window.toggleTheme = function() {
  const settings = stateManager.get('settings');
  stateManager.update('settings', {
    theme: settings.theme === 'dark' ? 'light' : 'dark'
  });
};

// 오프라인 보상 체크
function checkOfflineReward() {
  const hunter = stateManager.get('hunter');
  if (!hunter) return;

  const offlineGold = stateManager.calculateOfflineReward();
  if (offlineGold > 0) {
    stateManager.gainGold(offlineGold);
    showNotification(`오프라인 보상: ${offlineGold.toLocaleString()} G`, 'gold');
  }
}

// 알림 표시
window.showNotification = function(message, type = 'info') {
  const container = document.getElementById('notification-container');
  if (!container) return;

  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;

  container.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
};

// 데이터 리셋 (개발용)
window.resetGame = function() {
  if (confirm('모든 데이터를 삭제하시겠습니까?')) {
    stateManager.reset();
    location.reload();
  }
};

// ========== 레벨 해금 보상 모달 ==========
function showUnlockRewardModal(data) {
  const { oldLevel, newLevel, unlocks } = data;

  // 모달 컨테이너 생성
  const modal = document.createElement('div');
  modal.className = 'unlock-modal';
  modal.innerHTML = `
    <div class="unlock-modal-backdrop"></div>
    <div class="unlock-modal-content">
      <div class="unlock-header">
        <div class="level-up-badge">LEVEL UP!</div>
        <div class="level-change">
          <span class="old-level">Lv.${oldLevel}</span>
          <span class="level-arrow">→</span>
          <span class="new-level">Lv.${newLevel}</span>
        </div>
      </div>

      <div class="unlock-title">
        <span class="unlock-icon">🔓</span>
        <h2>새로운 기능 해금!</h2>
      </div>

      <div class="unlock-list">
        ${unlocks.map(unlock => `
          <div class="unlock-item" data-category="${unlock.category}">
            <div class="unlock-item-icon">${unlock.icon}</div>
            <div class="unlock-item-info">
              <h3>${unlock.name}</h3>
              <p>${unlock.description}</p>
            </div>
          </div>
        `).join('')}
      </div>

      <button class="btn-unlock-confirm">확인</button>
    </div>
  `;

  document.body.appendChild(modal);

  // 애니메이션 시작
  requestAnimationFrame(() => {
    modal.classList.add('show');
  });

  // 확인 버튼 클릭
  modal.querySelector('.btn-unlock-confirm').addEventListener('click', () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  });

  // 배경 클릭으로도 닫기
  modal.querySelector('.unlock-modal-backdrop').addEventListener('click', () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  });
}

// 레벨업 알림 (해금 없을 때)
window.showLevelUpNotification = function(newLevel) {
  const hunter = stateManager.get('hunter');
  const nextUnlock = getNextUnlockInfo(newLevel);

  let message = `레벨 업! Lv.${newLevel}`;
  if (nextUnlock) {
    message += ` (다음 해금: Lv.${nextUnlock.level})`;
  }

  window.showNotification(message, 'success');
};

// v6.1: 랭크 승급 모달 (현대 판타지 소설 톤)
function showRankUpModal(data) {
  const { oldRank, newRank, totalStats } = data;
  const rankInfo = stateManager.getRankInfo(newRank);

  // 랭크별 내러티브 메시지
  const narratives = {
    'D': "축하합니다! 이제 저급 게이트를 솔로 클리어할 수 있습니다.",
    'C': "중급 헌터로 인정받았습니다. 길드 가입 자격이 주어집니다.",
    'B': "당신의 이름이 헌터 협회 본부에 등록되었습니다.",
    'A': "국가 재난급 게이트 공략에 참여할 수 있습니다.",
    'S': "전 세계에 당신의 이름이 알려집니다. 전설의 시작입니다."
  };

  const modal = document.createElement('div');
  modal.className = 'rank-up-modal';
  modal.innerHTML = `
    <div class="rank-up-modal-backdrop"></div>
    <div class="rank-up-modal-content">
      <div class="rank-up-header">
        <div class="rank-up-badge">RANK UP!</div>
      </div>
      <div class="rank-change-display">
        <span class="old-rank rank-${oldRank.toLowerCase()}">${oldRank}</span>
        <span class="rank-arrow">→</span>
        <span class="new-rank rank-${newRank.toLowerCase()}" style="color: ${rankInfo.color}; text-shadow: 0 0 20px ${rankInfo.color};">${newRank}</span>
      </div>
      <div class="rank-info-display">
        <h2 style="color: ${rankInfo.color};">${rankInfo.name}</h2>
        <p class="rank-description">${rankInfo.description}</p>
        <p class="rank-narrative">"${narratives[newRank] || '새로운 힘을 얻었습니다!'}"</p>
        <div class="total-stats-display">
          <span class="stats-label">총 스탯</span>
          <span class="stats-value">${totalStats}</span>
        </div>
      </div>
      <button class="btn-rank-confirm">확인</button>
    </div>
  `;

  document.body.appendChild(modal);

  requestAnimationFrame(() => {
    modal.classList.add('show');
  });

  modal.querySelector('.btn-rank-confirm').addEventListener('click', () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  });

  modal.querySelector('.rank-up-modal-backdrop').addEventListener('click', () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  });
}

// DOM 로드 시 초기화
document.addEventListener('DOMContentLoaded', initApp);
