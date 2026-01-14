// The Hunter System - 메인 앱
import { router } from './ui/router.js';
import { stateManager } from './core/stateManager.js';
import { gateSystem } from './core/gateSystem.js';
import { renderDashboard } from './ui/screens/dashboard.js';
import { renderQuests } from './ui/screens/quests.js';
import { renderHunter } from './ui/screens/hunter.js';
import { renderGates } from './ui/screens/gates.js';
import { renderShop } from './ui/screens/shop.js';
import { renderAwakening } from './ui/screens/awakening.js';
import { GAME_CONSTANTS } from './config/constants.js';

// 앱 초기화
function initApp() {
  // 라우트 등록
  router.register('dashboard', renderDashboard);
  router.register('quests', renderQuests);
  router.register('hunter', renderHunter);
  router.register('gates', renderGates);
  router.register('shop', renderShop);
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
  updateHunterStatus();

  // 게이트 시스템 초기화
  gateSystem.init();
  gateSystem.subscribe(updateGateIndicator);
  updateGateIndicator();

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
    <a href="#gates" class="nav-item" data-route="gates">
      <span class="nav-icon">&#128682;</span>
      <span class="nav-label">게이트</span>
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
  document.body.classList.toggle('dark-theme', settings.theme === 'dark');
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

// DOM 로드 시 초기화
document.addEventListener('DOMContentLoaded', initApp);
