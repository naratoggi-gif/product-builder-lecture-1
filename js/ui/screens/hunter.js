// The Hunter System - 헌터 화면 (스탯, 전투력)
import { stateManager } from '../../core/stateManager.js';
import { GAME_CONSTANTS, getRequiredExp, calculateCombatStats, getQuestWaitTime } from '../../config/constants.js';

export function renderHunter() {
  const app = document.getElementById('app');
  const hunter = stateManager.get('hunter');

  if (!hunter) {
    window.location.hash = 'awakening';
    return;
  }

  const expRequired = getRequiredExp(hunter.level);
  const expPercent = Math.floor((hunter.exp / expRequired) * 100);
  const combatStats = calculateCombatStats(hunter.stats);
  const waitTime = getQuestWaitTime(hunter.stats.FOCUS);

  const statDescriptions = {
    STR: '물리 데미지, 아이들 골드',
    INT: '스킬 데미지, 보상 배율',
    WIL: '방어력, 스태미나 효율',
    FOCUS: '퀘스트 대기시간, 크리티컬',
    LUK: '드롭률, 랜덤 보너스'
  };

  const statIcons = {
    STR: '&#128170;',
    INT: '&#128218;',
    WIL: '&#128737;',
    FOCUS: '&#127919;',
    LUK: '&#127808;'
  };

  app.innerHTML = `
    <div class="hunter-screen">
      <!-- 헌터 프로필 -->
      <div class="card hunter-profile">
        <div class="profile-header">
          <div class="profile-avatar">
            <div class="avatar-icon-large">&#129333;</div>
            <div class="rank-badge rank-${hunter.rank.toLowerCase()}">${hunter.rank}</div>
          </div>
          <div class="profile-info">
            <h2>${hunter.name}</h2>
            <p class="hunter-title">${hunter.title}</p>
            <p class="hunter-level">Lv. ${hunter.level}</p>
          </div>
        </div>
        <div class="exp-bar-large">
          <div class="exp-fill" style="width: ${expPercent}%"></div>
          <span class="exp-text">${hunter.exp} / ${expRequired} EXP</span>
        </div>
        <div class="total-exp">총 골드: ${hunter.gold.toLocaleString()} G</div>
      </div>

      <!-- 스탯 포인트 -->
      ${hunter.statPoints > 0 ? `
        <div class="card stat-points-card">
          <div class="points-available">
            <span class="points-icon">&#11088;</span>
            <span>사용 가능한 스탯 포인트: <strong>${hunter.statPoints}</strong></span>
          </div>
        </div>
      ` : ''}

      <!-- 기본 스탯 -->
      <div class="card stats-panel">
        <div class="card-header">
          <h3>기본 스탯</h3>
        </div>
        <div class="stats-list">
          ${Object.entries(hunter.stats).map(([stat, value]) => `
            <div class="stat-row">
              <div class="stat-info">
                <span class="stat-icon">${statIcons[stat]}</span>
                <div class="stat-details">
                  <span class="stat-name">${stat}</span>
                  <span class="stat-desc">${statDescriptions[stat]}</span>
                </div>
              </div>
              <div class="stat-value-container">
                <span class="stat-value">${value}</span>
                ${hunter.statPoints > 0 ? `
                  <button class="stat-add-btn" data-stat="${stat}">+</button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- FOCUS 효과 -->
      <div class="card focus-card">
        <h3>FOCUS 효과</h3>
        <div class="focus-effects">
          <div class="focus-effect">
            <span class="effect-label">퀘스트 대기시간</span>
            <span class="effect-value">${waitTime}분</span>
          </div>
          <div class="focus-effect">
            <span class="effect-label">자동전투 크리티컬</span>
            <span class="effect-value">${combatStats.critRate.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <!-- 전투 스탯 -->
      <div class="card combat-panel">
        <h3>전투 스탯</h3>
        <div class="combat-stats-grid">
          <div class="combat-stat">
            <span class="combat-stat-icon">&#10084;</span>
            <span class="combat-stat-label">HP</span>
            <span class="combat-stat-value">${combatStats.maxHp}</span>
          </div>
          <div class="combat-stat">
            <span class="combat-stat-icon">&#9876;</span>
            <span class="combat-stat-label">공격력</span>
            <span class="combat-stat-value">${combatStats.attack}</span>
          </div>
          <div class="combat-stat">
            <span class="combat-stat-icon">&#10024;</span>
            <span class="combat-stat-label">스킬 데미지</span>
            <span class="combat-stat-value">${combatStats.skillDamage}</span>
          </div>
          <div class="combat-stat">
            <span class="combat-stat-icon">&#128737;</span>
            <span class="combat-stat-label">방어력</span>
            <span class="combat-stat-value">${combatStats.defense}</span>
          </div>
          <div class="combat-stat">
            <span class="combat-stat-icon">&#128165;</span>
            <span class="combat-stat-label">크리 데미지</span>
            <span class="combat-stat-value">${combatStats.critDamage}%</span>
          </div>
          <div class="combat-stat">
            <span class="combat-stat-icon">&#127808;</span>
            <span class="combat-stat-label">드롭률</span>
            <span class="combat-stat-value">+${combatStats.dropRate.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <!-- 통계 -->
      <div class="card statistics-panel">
        <h3>통계</h3>
        <div class="statistics-list">
          <div class="stat-item">
            <span>총 퀘스트 완료</span>
            <span>${stateManager.get('statistics').totalQuestsCompleted}</span>
          </div>
          <div class="stat-item">
            <span>최장 연속 기록</span>
            <span>${stateManager.get('statistics').longestStreak}일</span>
          </div>
          <div class="stat-item">
            <span>현재 연속</span>
            <span>${stateManager.get('statistics').currentStreak}일</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // 스탯 증가 이벤트
  document.querySelectorAll('.stat-add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const stat = btn.dataset.stat;
      const success = stateManager.increaseStat(stat);
      if (success) {
        window.showNotification(`${stat} +1!`, 'success');
        renderHunter();
      }
    });
  });
}
