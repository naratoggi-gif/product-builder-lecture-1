// The Hunter System - 방치형 성장 화면 (Idle Growth)
// v5.0 Dual Economy: Gold is used for stat refinement (idle growth)
import { stateManager } from '../../core/stateManager.js';
import { calculateRefineCost } from '../../config/constants.js';

export function renderIdleGrowth() {
  const app = document.getElementById('app');
  const hunter = stateManager.get('hunter');

  if (!hunter) {
    window.location.hash = 'awakening';
    return;
  }

  // v5.0: Use gold instead of essence for stat refinement
  const gold = hunter.gold || 0;
  const statTraining = hunter.statTraining || {};

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

  // 스탯별 컬러 테마
  const statColors = {
    STR: { main: '#ff6b6b', glow: 'rgba(255, 107, 107, 0.5)' },
    INT: { main: '#4dabf7', glow: 'rgba(77, 171, 247, 0.5)' },
    WIL: { main: '#51cf66', glow: 'rgba(81, 207, 102, 0.5)' },
    FOCUS: { main: '#ffd43b', glow: 'rgba(255, 212, 59, 0.5)' },
    LUK: { main: '#cc5de8', glow: 'rgba(204, 93, 232, 0.5)' }
  };

  app.innerHTML = `
    <div class="refine-screen">
      <div class="screen-header">
        <h1>방치형 성장 (Gold)</h1>
        <p class="screen-subtitle">골드를 투자하여 능력치를 성장시키세요</p>
      </div>

      <!-- 골드 보유량 (v5.0: Gold for idle growth) -->
      <div class="card gold-refine-card">
        <div class="gold-display">
          <span class="gold-icon">&#128176;</span>
          <span class="gold-amount">${gold.toLocaleString()}</span>
          <span class="gold-label">보유 골드</span>
        </div>
        <p class="gold-hint">자동 수급으로 골드를 획득합니다</p>
      </div>

      <!-- 스탯 리스트 -->
      <div class="refine-list">
        ${Object.entries(hunter.stats).map(([stat, value]) => {
          const progress = statTraining[stat] || 0;
          const cost = calculateRefineCost(value);
          const percent = Math.min(100, (progress / cost) * 100);
          const canRefine = gold > 0; // v5.0: Use gold for refinement
          const color = statColors[stat];
          const isAlmostFull = percent >= 80;

          return `
            <div class="card refine-card" data-stat="${stat}">
              <div class="refine-header">
                <div class="stat-info">
                  <span class="stat-icon">${statIcons[stat]}</span>
                  <div class="stat-details">
                    <span class="stat-name">${stat}</span>
                    <span class="stat-desc">${statDescriptions[stat]}</span>
                  </div>
                </div>
                <div class="stat-level">
                  <span class="level-value">Lv.${value}</span>
                  <span class="level-next">→ ${value + 1}</span>
                </div>
              </div>

              <!-- Container-style progress bar -->
              <div class="refine-container">
                <div class="refine-tank">
                  <div class="refine-liquid ${isAlmostFull ? 'almost-full' : ''}"
                       style="height: ${percent}%; --stat-color: ${color.main}; --stat-glow: ${color.glow};">
                    <div class="liquid-shine"></div>
                  </div>
                  <div class="tank-markers">
                    <span class="marker" style="bottom: 25%"></span>
                    <span class="marker" style="bottom: 50%"></span>
                    <span class="marker" style="bottom: 75%"></span>
                  </div>
                </div>
                <div class="refine-info">
                  <div class="progress-numbers">
                    <span class="current">${progress}</span>
                    <span class="divider">/</span>
                    <span class="required">${cost}</span>
                  </div>
                  <div class="progress-percent">${percent.toFixed(1)}%</div>
                </div>
              </div>

              <div class="refine-actions">
                <button class="btn-refine-amount" data-stat="${stat}" data-amount="1" ${!canRefine ? 'disabled' : ''}>
                  +1
                </button>
                <button class="btn-refine-amount" data-stat="${stat}" data-amount="10" ${gold < 10 ? 'disabled' : ''}>
                  +10
                </button>
                <button class="btn-refine-max" data-stat="${stat}" ${!canRefine ? 'disabled' : ''}>
                  MAX
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // 이벤트 리스너 - 정량 투자 (v5.0: Gold)
  document.querySelectorAll('.btn-refine-amount').forEach(btn => {
    btn.addEventListener('click', () => {
      const stat = btn.dataset.stat;
      const amount = parseInt(btn.dataset.amount);
      const currentGold = stateManager.get('hunter').gold || 0;
      const amountToPour = Math.min(amount, currentGold);

      if (amountToPour <= 0) return;

      const result = stateManager.upgradeStatWithGold(stat, amountToPour);

      if (result.success) {
        if (result.levelUp) {
          showLevelUpEffect(stat, result.newStatValue);
        } else {
          window.showNotification(`${stat}에 골드 ${amountToPour} 투자`, 'info');
        }
        renderIdleGrowth();
      } else {
        window.showNotification(result.error, 'error');
      }
    });
  });

  // 이벤트 리스너 - MAX 투자 (v5.0: Gold)
  document.querySelectorAll('.btn-refine-max').forEach(btn => {
    btn.addEventListener('click', () => {
      const stat = btn.dataset.stat;
      const currentGold = stateManager.get('hunter').gold || 0;

      if (currentGold <= 0) return;

      const result = stateManager.upgradeStatWithGold(stat, currentGold);

      if (result.success) {
        if (result.levelUp) {
          showLevelUpEffect(stat, result.newStatValue);
        } else {
          window.showNotification(`${stat}에 골드 ${currentGold} 투자`, 'info');
        }
        renderIdleGrowth();
      } else {
        window.showNotification(result.error, 'error');
      }
    });
  });
}

// 레벨업 이펙트
function showLevelUpEffect(stat, newLevel) {
  window.showNotification(`${stat} 레벨 업! → Lv.${newLevel}`, 'success');

  // 카드에 레벨업 애니메이션 추가
  const card = document.querySelector(`.refine-card[data-stat="${stat}"]`);
  if (card) {
    card.classList.add('level-up-flash');
    setTimeout(() => card.classList.remove('level-up-flash'), 600);
  }
}