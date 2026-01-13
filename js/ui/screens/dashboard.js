// The Hunter System - 대시보드 화면
import { stateManager } from '../../core/stateManager.js';
import { GAME_CONSTANTS, getRequiredExp, calculateIdleGold } from '../../config/constants.js';

let idleUpdateInterval = null;

export function renderDashboard() {
  const app = document.getElementById('app');
  const hunter = stateManager.get('hunter');
  const daily = stateManager.get('daily');

  if (!hunter) {
    window.location.hash = 'awakening';
    return;
  }

  const isRealHunter = stateManager.isRealHunterToday();
  const rewardMultiplier = stateManager.getCurrentRewardMultiplier();
  const expRequired = getRequiredExp(hunter.level);
  const expPercent = Math.floor((hunter.exp / expRequired) * 100);

  app.innerHTML = `
    <div class="dashboard-screen">
      <!-- 헌터 모드 배너 -->
      <div class="hunter-mode-banner ${isRealHunter ? 'real' : 'simulation'}">
        <div class="mode-icon">${isRealHunter ? '&#128293;' : '&#128308;'}</div>
        <div class="mode-info">
          <span class="mode-label">${isRealHunter ? 'REAL HUNTER' : 'SIMULATION MODE'}</span>
          <span class="mode-multiplier">보상 x${rewardMultiplier}</span>
        </div>
        ${!isRealHunter ? `
          <a href="#quests" class="mode-action">퀘스트 시작</a>
        ` : ''}
      </div>

      <!-- 헌터 정보 카드 -->
      <div class="card hunter-card">
        <div class="hunter-summary">
          <div class="hunter-avatar">
            <div class="avatar-icon">&#129333;</div>
            <div class="rank-badge rank-${hunter.rank.toLowerCase()}">${hunter.rank}</div>
          </div>
          <div class="hunter-info">
            <h2>${hunter.name}</h2>
            <p class="hunter-title">${hunter.title}</p>
            <div class="level-info">
              <span class="level">Lv. ${hunter.level}</span>
              ${hunter.statPoints > 0 ? `<span class="stat-points-badge">+${hunter.statPoints} 포인트</span>` : ''}
            </div>
          </div>
        </div>
        <div class="exp-bar">
          <div class="exp-fill" style="width: ${expPercent}%"></div>
          <span class="exp-text">${hunter.exp} / ${expRequired} EXP</span>
        </div>
      </div>

      <!-- 스태미나 & 골드 -->
      <div class="resources-row">
        <div class="resource-card stamina">
          <div class="resource-icon">&#9889;</div>
          <div class="resource-info">
            <span class="resource-label">스태미나</span>
            <span class="resource-value">${daily.stamina} / ${GAME_CONSTANTS.DAILY_STAMINA}</span>
          </div>
          <div class="resource-bar">
            <div class="resource-fill" style="width: ${(daily.stamina / GAME_CONSTANTS.DAILY_STAMINA) * 100}%"></div>
          </div>
        </div>
        <div class="resource-card gold">
          <div class="resource-icon">&#128176;</div>
          <div class="resource-info">
            <span class="resource-label">골드</span>
            <span class="resource-value">${hunter.gold.toLocaleString()} G</span>
          </div>
        </div>
      </div>

      <!-- 아이들 골드 -->
      <div class="card idle-card">
        <div class="card-header">
          <h3>자동 수급</h3>
          <span class="idle-rate" id="idleRate">계산 중...</span>
        </div>
        <div class="idle-info">
          <p>STR 스탯이 높을수록 초당 골드가 증가합니다.</p>
          ${daily.questsCompleted >= 3 ? '<span class="idle-bonus">+20% 퀘스트 보너스 적용 중!</span>' : ''}
          ${daily.questsCompleted === 0 ? '<span class="idle-penalty">-30% 시뮬레이션 패널티</span>' : ''}
        </div>
      </div>

      <!-- 오늘의 진행 상황 -->
      <div class="card progress-card">
        <div class="card-header">
          <h3>오늘의 진행</h3>
          <span class="progress-badge">${daily.questsCompleted} 퀘스트</span>
        </div>
        <div class="progress-stats">
          <div class="progress-item">
            <span class="progress-icon">&#128203;</span>
            <span class="progress-label">완료한 퀘스트</span>
            <span class="progress-value">${daily.questsCompleted}</span>
          </div>
          <div class="progress-item">
            <span class="progress-icon">&#128293;</span>
            <span class="progress-label">연속 기록</span>
            <span class="progress-value">${stateManager.get('statistics').currentStreak}일</span>
          </div>
        </div>
      </div>

      <!-- 빠른 액션 -->
      <div class="quick-actions">
        <a href="#quests" class="action-btn">
          <span class="action-icon">&#128203;</span>
          <span class="action-label">퀘스트 등록</span>
        </a>
        <a href="#gates" class="action-btn">
          <span class="action-icon">&#128682;</span>
          <span class="action-label">게이트 입장</span>
        </a>
        <a href="#hunter" class="action-btn">
          <span class="action-icon">&#128200;</span>
          <span class="action-label">스탯 확인</span>
        </a>
        <a href="#shop" class="action-btn">
          <span class="action-icon">&#128085;</span>
          <span class="action-label">코스튬 상점</span>
        </a>
      </div>
    </div>
  `;

  // 아이들 골드 표시 업데이트
  updateIdleRate();
  if (idleUpdateInterval) clearInterval(idleUpdateInterval);
  idleUpdateInterval = setInterval(updateIdleRate, 1000);
}

function updateIdleRate() {
  const rateEl = document.getElementById('idleRate');
  if (!rateEl) {
    if (idleUpdateInterval) clearInterval(idleUpdateInterval);
    return;
  }

  const hunter = stateManager.get('hunter');
  const daily = stateManager.get('daily');
  if (!hunter) return;

  let goldPerSecond = calculateIdleGold(hunter.stats.STR, daily.questsCompleted);

  // 시뮬레이션 패널티
  if (!stateManager.isRealHunterToday()) {
    goldPerSecond *= GAME_CONSTANTS.REWARD_MULTIPLIER.SIMULATION;
  }

  // 자동전투 부스트
  const idle = stateManager.get('idle');
  if (idle.autoBattleBoost && Date.now() < idle.autoBattleBoost.endTime) {
    goldPerSecond *= GAME_CONSTANTS.AD_REWARDS.AUTO_BATTLE_BOOST.multiplier;
    rateEl.innerHTML = `<span class="boosted">${goldPerSecond.toFixed(2)} G/s (x2)</span>`;
  } else {
    rateEl.textContent = `${goldPerSecond.toFixed(2)} G/s`;
  }
}
