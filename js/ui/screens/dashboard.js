// The Hunter System - 대시보드 화면
import { stateManager } from '../../core/stateManager.js';
import { GAME_CONSTANTS, getRequiredExp, calculateIdleGold } from '../../config/constants.js';
import { getDailyQuote, generateDailyEvaluation, WARNING_MESSAGES } from '../../config/narrative.js';
import { getCostumeById } from '../../config/costumes.js';

let idleUpdateInterval = null;
let criticalUnsubscribe = null;

// 코스튬에 따른 아바타 스프라이트 반환
function getAvatarSprite(gender, costume) {
  if (!costume) {
    // 기본 아바타
    return gender === 'female' ? '👩' : '👨';
  }

  // 코스튬별 스프라이트 맵핑
  const costumeSprites = {
    // Normal
    'hunter_basic': gender === 'female' ? '👩‍🦱' : '👨‍🦱',
    'shadow_cloak': '🥷',
    'warrior_armor': '⚔️',
    'scholar_robe': '🧙',
    // Rare
    'mage_robe': '🧙‍♂️',
    'lucky_charm': '🍀',
    'assassin_gear': '🗡️',
    // Epic
    'dragon_scale': '🐉',
    'esper_suit': '🔮',
    // Legendary
    'monarch_regalia': '👑'
  };

  return costumeSprites[costume.id] || (gender === 'female' ? '👩' : '👨');
}

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
  const statistics = stateManager.get('statistics');
  const currentStreak = statistics.currentStreak || 0;

  // 일일 명언 및 평가
  const dailyQuote = getDailyQuote();
  const evaluationInsights = generateDailyEvaluation(hunter.stats, [], currentStreak);

  // 경고 체크 (3일 이상 연속 기록 없음)
  const showStreakWarning = currentStreak === 0 && !isRealHunter;

  app.innerHTML = `
    <div class="dashboard-screen">
      <!-- 오늘의 명언 위젯 -->
      <div class="quote-widget">
        <div class="quote-icon">&#128172;</div>
        <div class="quote-content">
          <p class="quote-text">"${dailyQuote.text}"</p>
          <span class="quote-author">- ${dailyQuote.author}</span>
        </div>
      </div>

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
      ${!isRealHunter ? `
      <div class="simulation-guide">
        <p>현실 퀘스트를 완료하여 실전 보상(100%)을 획득하세요!</p>
      </div>
      ` : ''}

      ${showStreakWarning ? `
      <div class="streak-warning">
        <span class="warning-icon">&#9888;</span>
        <p>${WARNING_MESSAGES.simulation_only}</p>
      </div>
      ` : ''}

      <!-- 헌터 정보 카드 -->
      ${(() => {
        const equippedCostumeId = stateManager.get('equippedCostume');
        const equippedCostume = equippedCostumeId ? getCostumeById(equippedCostumeId) : null;
        const avatarSprite = getAvatarSprite(hunter.gender, equippedCostume);
        const jobTitle = equippedCostume ? equippedCostume.jobTitle : hunter.title;
        const hasCostume = !!equippedCostume;

        return `
      <div class="card hunter-card ${hasCostume ? 'costume-equipped' : ''}">
        <div class="hunter-summary">
          <div class="hunter-avatar ${hasCostume ? 'has-costume' : ''}" onclick="window.location.hash='shop'">
            <div class="avatar-icon ${equippedCostume ? 'costume-' + equippedCostume.rarity.toLowerCase() : ''}">${avatarSprite}</div>
            <div class="rank-badge rank-${hunter.rank.toLowerCase()}">${hunter.rank}</div>
            ${hasCostume ? '<div class="costume-indicator">&#128084;</div>' : ''}
          </div>
          <div class="hunter-info">
            <h2>${hunter.name}</h2>
            <p class="hunter-title ${hasCostume ? 'costume-title' : ''}">${jobTitle}</p>
            <div class="level-info">
              <span class="level">Lv. ${hunter.level}</span>
              ${hunter.statPoints > 0 ? `<span class="stat-points-badge">+${hunter.statPoints} 포인트</span>` : ''}
            </div>
            ${hasCostume ? `<div class="costume-bonus-badge">&#128176; x2 골드</div>` : ''}
          </div>
        </div>
        <div class="exp-bar">
          <div class="exp-fill" style="width: ${expPercent}%"></div>
          <span class="exp-text">${hunter.exp} / ${expRequired} EXP</span>
        </div>
      </div>`;
      })()}

      <!-- 스태미나 & 골드 & 에센스 (v5.0 Dual Economy) -->
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
        <div class="resource-card gold clickable" onclick="window.location.hash='idle-growth'">
          <div class="resource-icon">&#128176;</div>
          <div class="resource-info">
            <span class="resource-label">골드</span>
            <span class="resource-value">${hunter.gold.toLocaleString()} G</span>
          </div>
          <span class="resource-hint">자동 수급 → 스탯 강화</span>
        </div>
        <div class="resource-card essence clickable" onclick="window.location.hash='shop'">
          <div class="resource-icon">&#10024;</div>
          <div class="resource-info">
            <span class="resource-label">에센스</span>
            <span class="resource-value">${(hunter.essence || 0).toLocaleString()} E</span>
          </div>
          <span class="resource-hint">퀘스트 → 코스튬 구매</span>
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
          <p class="idle-crit-info">FOCUS가 높을수록 크리티컬 확률이 증가합니다.</p>
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
            <span class="progress-value">${currentStreak}일</span>
          </div>
        </div>
      </div>

      <!-- 일일 평가 패널 -->
      <div class="card evaluation-card">
        <div class="card-header">
          <h3>시스템 분석</h3>
          <span class="evaluation-icon">&#128202;</span>
        </div>
        <div class="evaluation-insights">
          ${evaluationInsights.map(insight => `
            <div class="insight-item">
              <span class="insight-bullet">&#8226;</span>
              <p>${insight}</p>
            </div>
          `).join('')}
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

  // 크리티컬 컨테이너 생성
  ensureCriticalContainer();

  // 크리티컬 이벤트 구독
  if (criticalUnsubscribe) criticalUnsubscribe();
  criticalUnsubscribe = stateManager.subscribe('critical', showCriticalAnimation);
}

// 크리티컬 컨테이너가 없으면 생성
function ensureCriticalContainer() {
  if (!document.getElementById('critical-container')) {
    const container = document.createElement('div');
    container.id = 'critical-container';
    document.body.appendChild(container);
  }
}

// 크리티컬 애니메이션 표시
function showCriticalAnimation(data) {
  const container = document.getElementById('critical-container');
  if (!container) return;

  // 기존 애니메이션 제거
  container.innerHTML = '';

  // 크리티컬 텍스트 생성
  const wrapper = document.createElement('div');
  wrapper.style.textAlign = 'center';

  const critText = document.createElement('div');
  critText.className = 'critical-text';
  critText.textContent = 'CRITICAL!';

  const goldText = document.createElement('div');
  goldText.className = 'critical-gold';
  goldText.textContent = `+${data.gold} G`;

  wrapper.appendChild(critText);
  wrapper.appendChild(goldText);
  container.appendChild(wrapper);

  // 애니메이션 종료 후 제거
  setTimeout(() => {
    if (container.contains(wrapper)) {
      container.removeChild(wrapper);
    }
  }, 800);
}

// Design v3.0: goldPerSecond = baseGold * (1 + STR * 0.05)
// v5.1: 코스튬 장착 시 2배 골드 적용
function updateIdleRate() {
  const rateEl = document.getElementById('idleRate');
  if (!rateEl) {
    if (idleUpdateInterval) clearInterval(idleUpdateInterval);
    return;
  }

  const hunter = stateManager.get('hunter');
  if (!hunter) return;

  let goldPerSecond = calculateIdleGold(hunter.stats.STR);
  const bonusLabels = [];

  // 시뮬레이션 패널티
  if (!stateManager.isRealHunterToday()) {
    goldPerSecond *= GAME_CONSTANTS.REWARD_MULTIPLIER.SIMULATION;
    bonusLabels.push('SIM 0.35x');
  }

  // 코스튬 보너스 (2x)
  const costumeBonus = stateManager.getCostumeGoldBonus();
  if (costumeBonus > 1) {
    goldPerSecond *= costumeBonus;
    bonusLabels.push('코스튬 x2');
  }

  // 자동전투 부스트
  const idle = stateManager.get('idle');
  if (idle.autoBattleBoost && Date.now() < idle.autoBattleBoost.endTime) {
    goldPerSecond *= GAME_CONSTANTS.AD_REWARDS.AUTO_BATTLE_BOOST.multiplier;
    bonusLabels.push('부스트 x2');
  }

  if (bonusLabels.length > 0) {
    const bonusText = bonusLabels.join(' · ');
    rateEl.innerHTML = `<span class="boosted">${goldPerSecond.toFixed(2)} G/s</span> <span class="bonus-info">(${bonusText})</span>`;
  } else {
    rateEl.textContent = `${goldPerSecond.toFixed(2)} G/s`;
  }
}
