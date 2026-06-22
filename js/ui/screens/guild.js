// The Hunter System - Guild Management Screen (v6.5 Enhanced Guild System)
// Guild Office, Hunter Dispatch (Random Summon), Research Center, GPS HUD
import { stateManager } from '../../core/stateManager.js';
import { getGuildHunterById, getHuntersByRank, getHunterRankColor, getHunterRankColorInfo, getRandomDispatchMessage, GUILD_HUNTERS, HUNTER_RANK_RATES, getRankOrder, getDismissRefund } from '../../config/guildHunters.js';
import { getOfficeLevelInfo, getNextOfficeLevelInfo, getMaxOfficeLevelForRank, RESEARCH_TREE, getResearchById, canStartResearch, calculateResearchBonuses, formatResearchTime, DISPATCH_MATERIALS } from '../../config/guildConfig.js';

let activeTab = 'dispatch'; // 'office', 'dispatch', 'research'
const SUMMON_COST = 1000; // 랜덤 소환 비용

export function renderGuild() {
  const app = document.getElementById('app');
  const hunter = stateManager.get('hunter');

  if (!hunter) {
    window.location.hash = 'awakening';
    return;
  }

  const guild = stateManager.get('guild');
  const gold = hunter.gold || 0;

  // Calculate total GPS
  const totalGps = stateManager.getTotalGuildGps();
  const officeInfo = getOfficeLevelInfo(guild.officeLevel);
  const nextOffice = getNextOfficeLevelInfo(guild.officeLevel);
  const maxOfficeLevel = getMaxOfficeLevelForRank(hunter.rank);

  // Research info
  const researchProgress = stateManager.getResearchProgress();
  const researchBonuses = stateManager.getResearchBonuses();

  // Dispatch info
  const maxSlots = stateManager.getMaxDispatchSlots();
  const usedSlots = guild.hiredHunters.length;

  // v6.5: Passive bonuses
  const hunterPassives = stateManager.getHunterPassiveBonuses();
  const hasPassives = Object.values(hunterPassives).some(v => v > 0);

  app.innerHTML = `
    <div class="guild-screen">
      <div class="screen-header">
        <h1>길드 관리</h1>
        <p class="screen-subtitle">부하 헌터를 고용하여 자동 수급을 증가시키세요</p>
      </div>

      <!-- GPS Summary Card -->
      <div class="card guild-gps-card">
        <div class="gps-display">
          <div class="gps-icon">💰</div>
          <div class="gps-info">
            <span class="gps-label">현재 GPS</span>
            <span class="gps-value gps-animated">+${totalGps.toFixed(2)} Gold/sec</span>
          </div>
        </div>
        <div class="gps-breakdown">
          <span class="breakdown-item">🏢 사무실: +${officeInfo.gps}/s</span>
          <span class="breakdown-item">👥 파견대: +${(totalGps - officeInfo.gps).toFixed(2)}/s</span>
        </div>
        ${hasPassives ? `
          <div class="passive-bonuses-display">
            <span class="passive-title">✨ 시너지 효과</span>
            <div class="passive-list">
              ${hunterPassives.gpsBoost > 0 ? `<span class="passive-item">GPS +${Math.round(hunterPassives.gpsBoost * 100)}%</span>` : ''}
              ${hunterPassives.refineCostReduction > 0 ? `<span class="passive-item">연마비용 -${Math.round(hunterPassives.refineCostReduction * 100)}%</span>` : ''}
              ${hunterPassives.questRewardBoost > 0 ? `<span class="passive-item">퀘스트보상 +${Math.round(hunterPassives.questRewardBoost * 100)}%</span>` : ''}
              ${hunterPassives.expBoost > 0 ? `<span class="passive-item">경험치 +${Math.round(hunterPassives.expBoost * 100)}%</span>` : ''}
              ${hunterPassives.essenceBoost > 0 ? `<span class="passive-item">에센스 +${Math.round(hunterPassives.essenceBoost * 100)}%</span>` : ''}
            </div>
          </div>
        ` : ''}
        <div class="gold-display-mini">
          <span>보유 골드: </span>
          <span class="gold-amount">${gold.toLocaleString()} G</span>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="guild-tabs">
        <button class="guild-tab ${activeTab === 'dispatch' ? 'active' : ''}" data-tab="dispatch">
          👥 부하 관리 (${usedSlots}/${maxSlots})
        </button>
        <button class="guild-tab ${activeTab === 'office' ? 'active' : ''}" data-tab="office">
          🏢 사무실
        </button>
        <button class="guild-tab ${activeTab === 'research' ? 'active' : ''}" data-tab="research">
          🔬 연구소
        </button>
      </div>

      <!-- Tab Content -->
      <div class="guild-tab-content">
        ${activeTab === 'office' ? renderOfficeTab(guild, hunter, officeInfo, nextOffice, maxOfficeLevel, gold) : ''}
        ${activeTab === 'dispatch' ? renderDispatchTab(guild, hunter, maxSlots, gold) : ''}
        ${activeTab === 'research' ? renderResearchTab(guild, hunter, researchProgress, researchBonuses) : ''}
      </div>
    </div>
  `;

  bindGuildEvents();
}

function renderOfficeTab(guild, hunter, officeInfo, nextOffice, maxOfficeLevel, gold) {
  const researchBonuses = stateManager.getResearchBonuses();
  const discount = researchBonuses.officeUpgradeDiscount || 0;
  const nextCost = nextOffice ? Math.floor(nextOffice.upgradeCost * (1 - discount)) : 0;
  const canUpgrade = nextOffice && nextOffice.level <= maxOfficeLevel && gold >= nextCost;
  const rankLocked = nextOffice && nextOffice.level > maxOfficeLevel;

  return `
    <div class="office-section">
      <!-- Current Office -->
      <div class="card office-card">
        <div class="office-header">
          <div class="office-icon">🏢</div>
          <div class="office-info">
            <h3>${officeInfo.name}</h3>
            <p class="office-level">Level ${officeInfo.level}</p>
          </div>
          <div class="office-gps">
            <span class="gps-badge">+${officeInfo.gps} GPS</span>
          </div>
        </div>
        <p class="office-description">${officeInfo.description}</p>

        ${nextOffice ? `
          <div class="upgrade-section">
            <div class="upgrade-preview">
              <span class="upgrade-arrow">→</span>
              <div class="next-office">
                <span class="next-name">${nextOffice.name}</span>
                <span class="next-gps">+${nextOffice.gps} GPS</span>
              </div>
            </div>
            <div class="upgrade-cost">
              <span class="cost-label">업그레이드 비용:</span>
              <span class="cost-value ${gold >= nextCost ? '' : 'insufficient'}">${nextCost.toLocaleString()} G</span>
              ${discount > 0 ? `<span class="discount-badge">-${Math.round(discount * 100)}%</span>` : ''}
            </div>
            ${rankLocked ? `
              <div class="rank-lock-notice">
                <span class="lock-icon">🔒</span>
                <span>${nextOffice.requiredRank}랭크 이상 필요</span>
              </div>
            ` : `
              <button class="btn-upgrade-office ${canUpgrade ? '' : 'disabled'}" ${canUpgrade ? '' : 'disabled'}>
                업그레이드
              </button>
            `}
          </div>
        ` : `
          <div class="max-level-notice">
            <span>🏆 최대 레벨 달성!</span>
          </div>
        `}
      </div>

      <!-- Rank Synergy Info -->
      <div class="card synergy-card">
        <h4>📊 랭크 시너지</h4>
        <p class="synergy-desc">개인 랭크에 따라 길드 사무실 최대 레벨이 결정됩니다.</p>
        <div class="rank-limits">
          <div class="rank-limit ${hunter.rank === 'E' ? 'current' : ''}">
            <span class="rank-badge rank-e">E</span>
            <span>Lv.1~2</span>
          </div>
          <div class="rank-limit ${hunter.rank === 'D' ? 'current' : ''}">
            <span class="rank-badge rank-d">D</span>
            <span>Lv.3~4</span>
          </div>
          <div class="rank-limit ${hunter.rank === 'C' ? 'current' : ''}">
            <span class="rank-badge rank-c">C</span>
            <span>Lv.5~6</span>
          </div>
          <div class="rank-limit ${hunter.rank === 'B' ? 'current' : ''}">
            <span class="rank-badge rank-b">B</span>
            <span>Lv.7~8</span>
          </div>
          <div class="rank-limit ${hunter.rank === 'A' ? 'current' : ''}">
            <span class="rank-badge rank-a">A</span>
            <span>Lv.9</span>
          </div>
          <div class="rank-limit ${hunter.rank === 'S' ? 'current' : ''}">
            <span class="rank-badge rank-s">S</span>
            <span>Lv.10</span>
          </div>
        </div>
        <p class="current-rank-info">현재 랭크: <strong style="color: ${getRankColor(hunter.rank)}">${hunter.rank}등급</strong> (최대 Lv.${maxOfficeLevel})</p>
      </div>
    </div>
  `;
}

function renderDispatchTab(guild, hunter, maxSlots, gold) {
  const sortedHunters = stateManager.getSortedHiredHunters();
  const canSummon = gold >= SUMMON_COST && sortedHunters.length < maxSlots;

  return `
    <div class="dispatch-section">
      <!-- Random Summon Card -->
      <div class="card summon-card">
        <div class="summon-header">
          <h4>🎴 헌터 소환</h4>
          <span class="summon-cost">${SUMMON_COST.toLocaleString()} G</span>
        </div>
        <p class="summon-desc">랜덤으로 F~S급 헌터를 소환합니다. S급 확률 0.5%!</p>
        <div class="summon-rates">
          <span class="rate rate-f">F:15%</span>
          <span class="rate rate-e">E:30%</span>
          <span class="rate rate-d">D:25%</span>
          <span class="rate rate-c">C:18%</span>
          <span class="rate rate-b">B:8%</span>
          <span class="rate rate-a">A:3.5%</span>
          <span class="rate rate-s">S:0.5%</span>
        </div>
        <button class="btn-summon ${canSummon ? '' : 'disabled'}" ${canSummon ? '' : 'disabled'}>
          🎴 소환하기
        </button>
        ${sortedHunters.length >= maxSlots ? '<p class="slot-full-notice">⚠️ 슬롯이 가득 찼습니다. 헌터를 방출하세요.</p>' : ''}
      </div>

      <!-- Hired Hunters (Sorted by Rank) -->
      <div class="card hired-hunters-card">
        <div class="card-header">
          <h4>👥 고용된 헌터</h4>
          <span class="slot-info">${sortedHunters.length}/${maxSlots} 슬롯</span>
        </div>

        ${sortedHunters.length === 0 ? `
          <div class="empty-dispatch">
            <span class="empty-icon">📭</span>
            <p>아직 고용된 헌터가 없습니다.</p>
            <p class="empty-hint">위에서 헌터를 소환하세요!</p>
          </div>
        ` : `
          <div class="hired-hunters-list">
            ${sortedHunters.map(hired => {
              const guildHunter = hired.info;
              if (!guildHunter) return '';
              const colorInfo = getHunterRankColorInfo(guildHunter.rank);
              const refundAmount = getDismissRefund(guildHunter.id);
              const hasPassive = guildHunter.passive;

              return `
                <div class="hired-hunter-row" style="border-left: 4px solid ${colorInfo.border};">
                  <div class="hunter-avatar-container" style="background: ${colorInfo.bg};">
                    <span class="hunter-avatar">${guildHunter.sprite}</span>
                    <span class="hunter-rank-badge" style="background: ${colorInfo.border}; color: white;">${guildHunter.rank}</span>
                  </div>
                  <div class="hunter-info">
                    <div class="hunter-name-row">
                      <span class="hunter-name">${guildHunter.name}</span>
                      <span class="hunter-gps" style="color: ${colorInfo.text}">+${guildHunter.gps} GPS</span>
                    </div>
                    <span class="hunter-specialty">${guildHunter.specialty}</span>
                    ${hasPassive ? `
                      <div class="hunter-passive" style="color: ${colorInfo.text}">
                        <span class="passive-icon">✨</span>
                        <span class="passive-name">${guildHunter.passive.name}</span>
                        <span class="passive-desc">${guildHunter.passive.description}</span>
                      </div>
                    ` : ''}
                    <div class="hunter-stats-row">
                      <span class="hunter-earned">${Math.floor(hired.totalGoldProduced).toLocaleString()} G 수급</span>
                    </div>
                  </div>
                  <button class="btn-dismiss" data-hunter-id="${guildHunter.id}" data-refund="${refundAmount}">
                    <span class="dismiss-label">방출</span>
                    <span class="dismiss-refund">+${refundAmount.toLocaleString()}G</span>
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <!-- Materials Collected -->
      <div class="card materials-card">
        <div class="card-header">
          <h4>📦 수집된 재료</h4>
        </div>
        <div class="materials-grid">
          ${Object.keys(guild.materials || {}).length === 0 ? `
            <p class="empty-materials">파견된 헌터가 재료를 수집하면 여기에 표시됩니다.</p>
          ` : Object.entries(guild.materials).map(([id, count]) => {
            const matInfo = getMaterialInfo(id);
            return `
              <div class="material-item">
                <span class="material-icon">${matInfo.icon}</span>
                <span class="material-name">${matInfo.name}</span>
                <span class="material-count">x${count}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderResearchTab(guild, hunter, researchProgress, researchBonuses) {
  const completedResearch = guild.completedResearch || [];

  return `
    <div class="research-section">
      <!-- Current Research -->
      ${researchProgress.inProgress ? `
        <div class="card current-research-card">
          <div class="card-header">
            <h4>🔬 연구 진행 중</h4>
          </div>
          <div class="research-progress">
            <div class="research-name">${researchProgress.research.name}</div>
            <div class="research-desc">${researchProgress.research.description}</div>
            <div class="progress-bar-container">
              <div class="progress-bar" style="width: ${researchProgress.percent}%"></div>
            </div>
            <div class="research-time">
              <span>남은 시간: ${formatResearchTime(researchProgress.remainingSeconds)}</span>
              <span class="research-percent">${researchProgress.percent.toFixed(1)}%</span>
            </div>
            <button class="btn-ad-skip" data-action="skip-research">
              📺 광고 보고 즉시 완료
            </button>
          </div>
        </div>
      ` : ''}

      <!-- Active Bonuses -->
      <div class="card bonuses-card">
        <div class="card-header">
          <h4>✨ 활성화된 연구 효과</h4>
        </div>
        <div class="bonuses-list">
          ${Object.entries(researchBonuses).filter(([k, v]) => v > 0).length === 0 ? `
            <p class="no-bonuses">아직 완료된 연구가 없습니다.</p>
          ` : Object.entries(researchBonuses).filter(([k, v]) => v > 0).map(([key, value]) => {
            const bonusInfo = getBonusInfo(key, value);
            return `<div class="bonus-item">${bonusInfo}</div>`;
          }).join('')}
        </div>
      </div>

      <!-- Research Categories -->
      ${Object.entries(RESEARCH_TREE).map(([categoryKey, category]) => `
        <div class="card research-category-card">
          <div class="card-header">
            <h4>${category.icon} ${category.name}</h4>
          </div>
          <div class="research-grid">
            ${category.techs.map(tech => {
              const isCompleted = completedResearch.includes(tech.id);
              const isInProgress = researchProgress.inProgress && researchProgress.research.id === tech.id;
              const canStart = !researchProgress.inProgress && !isCompleted && canStartResearch(tech.id, completedResearch);
              const rankOrder = { 'E': 1, 'D': 2, 'C': 3, 'B': 4, 'A': 5, 'S': 6 };
              const hasRank = rankOrder[hunter.rank] >= rankOrder[tech.requiredRank];
              const hasGold = hunter.gold >= tech.cost;
              const canAfford = canStart && hasRank && hasGold;

              let statusClass = '';
              if (isCompleted) statusClass = 'completed';
              else if (isInProgress) statusClass = 'in-progress';
              else if (!canStart) statusClass = 'locked';
              else if (!hasRank) statusClass = 'rank-locked';
              else if (!hasGold) statusClass = 'insufficient';

              return `
                <div class="research-item ${statusClass}">
                  <div class="research-header">
                    <span class="research-name">${tech.name}</span>
                    ${isCompleted ? '<span class="completed-badge">✓</span>' : ''}
                  </div>
                  <p class="research-desc">${tech.description}</p>
                  <div class="research-footer">
                    <span class="research-time">${formatResearchTime(tech.researchTime)}</span>
                    ${!isCompleted && !isInProgress ? `
                      <button class="btn-research ${canAfford ? '' : 'disabled'}"
                              data-research-id="${tech.id}"
                              ${canAfford ? '' : 'disabled'}>
                        ${tech.cost.toLocaleString()} G
                      </button>
                    ` : ''}
                    ${!hasRank && !isCompleted ? `<span class="rank-req">${tech.requiredRank}급 필요</span>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function bindGuildEvents() {
  // Tab switching
  document.querySelectorAll('.guild-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      activeTab = e.currentTarget.dataset.tab;
      renderGuild();
    });
  });

  // Upgrade office
  const upgradeBtn = document.querySelector('.btn-upgrade-office');
  if (upgradeBtn) {
    upgradeBtn.addEventListener('click', () => {
      const result = stateManager.upgradeGuildOffice();
      if (result.success) {
        window.showNotification(`사무실을 Lv.${result.newLevel}로 업그레이드했습니다!`, 'success');
        renderGuild();
      } else {
        window.showNotification(result.error, 'error');
      }
    });
  }

  // Random Summon
  const summonBtn = document.querySelector('.btn-summon');
  if (summonBtn) {
    summonBtn.addEventListener('click', () => {
      const result = stateManager.summonRandomHunter(SUMMON_COST);
      if (result.success) {
        showHunterCardPopup(result.hunter);
      } else {
        window.showNotification(result.error, 'error');
      }
    });
  }

  // Dismiss hunters
  document.querySelectorAll('.btn-dismiss').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const hunterId = e.currentTarget.dataset.hunterId;
      const guildHunter = getGuildHunterById(hunterId);
      const refund = parseInt(e.currentTarget.dataset.refund) || 0;

      if (confirm(`${guildHunter.name}을(를) 방출하시겠습니까?\n(${refund.toLocaleString()} G 환급)`)) {
        const result = stateManager.dismissGuildHunter(hunterId);
        if (result.success) {
          window.showNotification(`${guildHunter.name}을(를) 방출했습니다. (+${result.refund.toLocaleString()} G)`, 'info');
          renderGuild();
        } else {
          window.showNotification(result.error, 'error');
        }
      }
    });
  });

  // Start research
  document.querySelectorAll('.btn-research').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const researchId = e.currentTarget.dataset.researchId;
      const result = stateManager.startResearch(researchId);
      if (result.success) {
        const research = getResearchById(researchId);
        window.showNotification(`${research.name} 연구를 시작했습니다!`, 'success');
        renderGuild();
      } else {
        window.showNotification(result.error, 'error');
      }
    });
  });

  // Skip research with ad
  const skipBtn = document.querySelector('.btn-ad-skip');
  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      // Simulate ad watching
      if (confirm('광고를 시청하고 연구를 즉시 완료하시겠습니까?')) {
        const result = stateManager.completeResearch(true);
        if (result.success) {
          const research = getResearchById(result.completed);
          window.showNotification(`${research.name} 연구 완료!`, 'success');
          renderGuild();
        } else {
          window.showNotification(result.error, 'error');
        }
      }
    });
  }
}

/**
 * v6.5: 헌터 카드 팝업 표시 (등급별 연출)
 */
function showHunterCardPopup(guildHunter) {
  const colorInfo = getHunterRankColorInfo(guildHunter.rank);
  const isHighRank = ['A', 'S'].includes(guildHunter.rank);
  const isSRank = guildHunter.rank === 'S';

  // Create modal
  const modal = document.createElement('div');
  modal.className = `hunter-card-modal ${isSRank ? 's-rank' : ''}`;
  modal.innerHTML = `
    <div class="hunter-card-backdrop"></div>
    <div class="hunter-card-content" style="border-color: ${colorInfo.border}; ${colorInfo.glow !== 'none' ? `box-shadow: 0 0 30px ${colorInfo.glow}, 0 0 60px ${colorInfo.glow};` : ''}">
      ${isSRank ? '<div class="s-rank-particles"></div>' : ''}
      <div class="card-rank-banner" style="background: linear-gradient(135deg, ${colorInfo.bg}, ${colorInfo.border});">
        <span class="card-rank">${guildHunter.rank}급</span>
        <span class="card-rank-label">${getRankLabel(guildHunter.rank)}</span>
      </div>
      <div class="card-avatar-section" style="background: ${colorInfo.bg};">
        <span class="card-avatar">${guildHunter.sprite}</span>
      </div>
      <div class="card-info-section">
        <h2 class="card-name" style="color: ${colorInfo.text};">${guildHunter.name}</h2>
        <p class="card-specialty">${guildHunter.specialty}</p>
        <p class="card-description">${guildHunter.description}</p>
        <div class="card-stats">
          <div class="card-stat">
            <span class="stat-label">GPS</span>
            <span class="stat-value" style="color: ${colorInfo.text};">+${guildHunter.gps}</span>
          </div>
          <div class="card-stat">
            <span class="stat-label">고용가</span>
            <span class="stat-value">${guildHunter.hireCost.toLocaleString()} G</span>
          </div>
        </div>
        ${guildHunter.passive ? `
          <div class="card-passive" style="border-color: ${colorInfo.border}; background: rgba(${hexToRgb(colorInfo.border)}, 0.1);">
            <span class="passive-badge" style="background: ${colorInfo.border};">PASSIVE</span>
            <span class="passive-name">${guildHunter.passive.name}</span>
            <span class="passive-effect">${guildHunter.passive.description}</span>
          </div>
        ` : ''}
      </div>
      <button class="btn-card-confirm" style="background: linear-gradient(135deg, ${colorInfo.bg}, ${colorInfo.border});">확인</button>
    </div>
  `;

  document.body.appendChild(modal);

  // Animation
  requestAnimationFrame(() => {
    modal.classList.add('show');

    // S급 특별 이펙트
    if (isSRank) {
      createSRankParticles(modal.querySelector('.s-rank-particles'));
    }
  });

  // Close handlers
  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => {
      modal.remove();
      renderGuild();
    }, 400);
  };

  modal.querySelector('.btn-card-confirm').addEventListener('click', closeModal);
  modal.querySelector('.hunter-card-backdrop').addEventListener('click', closeModal);
}

/**
 * S급 헌터 파티클 이펙트
 */
function createSRankParticles(container) {
  if (!container) return;

  for (let i = 0; i < 30; i++) {
    const particle = document.createElement('div');
    particle.className = 's-rank-particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 2 + 's';
    particle.style.animationDuration = (2 + Math.random() * 2) + 's';
    container.appendChild(particle);
  }
}

/**
 * Hex to RGB 변환
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '255, 255, 255';
}

/**
 * 등급별 라벨
 */
function getRankLabel(rank) {
  const labels = {
    'F': '쓰레기',
    'E': '신입',
    'D': '숙련',
    'C': '정예',
    'B': '베테랑',
    'A': '상위',
    'S': '전설'
  };
  return labels[rank] || '헌터';
}

// Helper functions
function getRankColor(rank) {
  const colors = {
    'E': '#9ca3af',
    'D': '#10b981',
    'C': '#3b82f6',
    'B': '#a855f7',
    'A': '#f59e0b',
    'S': '#ef4444'
  };
  return colors[rank] || '#9ca3af';
}

function getMaterialInfo(id) {
  const allMaterials = [
    ...(DISPATCH_MATERIALS['F'] || []),
    ...(DISPATCH_MATERIALS['E'] || []),
    ...(DISPATCH_MATERIALS['D'] || []),
    ...(DISPATCH_MATERIALS['C'] || []),
    ...(DISPATCH_MATERIALS['B'] || []),
    ...(DISPATCH_MATERIALS['A'] || []),
    ...(DISPATCH_MATERIALS['S'] || [])
  ];
  return allMaterials.find(m => m.id === id) || { name: id, icon: '📦' };
}

function getBonusInfo(key, value) {
  const bonusMap = {
    goldMult: `💰 골드 획득 +${Math.round(value * 100)}%`,
    expMult: `📚 경험치 획득 +${Math.round(value * 100)}%`,
    critRate: `⚡ 크리티컬 확률 +${Math.round(value * 100)}%`,
    dropRate: `🎁 드롭률 +${Math.round(value * 100)}%`,
    dispatchGpsMult: `👥 파견 GPS +${Math.round(value * 100)}%`,
    refineCostReduction: `🔨 연마 비용 -${Math.round(value * 100)}%`,
    extraDispatchSlots: `📋 파견 슬롯 +${value}`,
    officeUpgradeDiscount: `🏢 사무실 업그레이드 -${Math.round(value * 100)}%`
  };
  return bonusMap[key] || `${key}: ${value}`;
}
