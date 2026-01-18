// The Hunter System - Guild Management Screen (v6.3)
// Guild Office, Hunter Dispatch, Research Center
import { stateManager } from '../../core/stateManager.js';
import { getGuildHunterById, getHuntersByRank, getHunterRankColor, getRandomDispatchMessage, GUILD_HUNTERS } from '../../config/guildHunters.js';
import { getOfficeLevelInfo, getNextOfficeLevelInfo, getMaxOfficeLevelForRank, RESEARCH_TREE, getResearchById, canStartResearch, calculateResearchBonuses, formatResearchTime, DISPATCH_MATERIALS } from '../../config/guildConfig.js';

let activeTab = 'office'; // 'office', 'dispatch', 'research'

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

  app.innerHTML = `
    <div class="guild-screen">
      <div class="screen-header">
        <h1>🏢 길드 관리</h1>
        <p class="screen-subtitle">길드를 운영하여 자동 수급을 증가시키세요</p>
      </div>

      <!-- GPS Summary Card -->
      <div class="card guild-gps-card">
        <div class="gps-display">
          <div class="gps-icon">💰</div>
          <div class="gps-info">
            <span class="gps-label">현재 GPS</span>
            <span class="gps-value">+${totalGps.toFixed(2)} Gold/sec</span>
          </div>
        </div>
        <div class="gps-breakdown">
          <span class="breakdown-item">🏢 사무실: +${officeInfo.gps}/s</span>
          <span class="breakdown-item">👥 파견대: +${(totalGps - officeInfo.gps).toFixed(2)}/s</span>
        </div>
        <div class="gold-display-mini">
          <span>보유 골드: </span>
          <span class="gold-amount">${gold.toLocaleString()} G</span>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="guild-tabs">
        <button class="guild-tab ${activeTab === 'office' ? 'active' : ''}" data-tab="office">
          🏢 사무실
        </button>
        <button class="guild-tab ${activeTab === 'dispatch' ? 'active' : ''}" data-tab="dispatch">
          👥 파견대 (${usedSlots}/${maxSlots})
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
  const hiredHunters = guild.hiredHunters || [];
  const availableHunters = GUILD_HUNTERS.filter(h => !hiredHunters.some(hired => hired.hunterId === h.id));

  return `
    <div class="dispatch-section">
      <!-- Hired Hunters -->
      <div class="card hired-hunters-card">
        <div class="card-header">
          <h4>👥 고용된 헌터</h4>
          <span class="slot-info">${hiredHunters.length}/${maxSlots} 슬롯</span>
        </div>

        ${hiredHunters.length === 0 ? `
          <div class="empty-dispatch">
            <span class="empty-icon">📭</span>
            <p>아직 고용된 헌터가 없습니다.</p>
            <p class="empty-hint">아래에서 헌터를 고용하세요!</p>
          </div>
        ` : `
          <div class="hired-hunters-grid">
            ${hiredHunters.map(hired => {
              const guildHunter = getGuildHunterById(hired.hunterId);
              if (!guildHunter) return '';
              return `
                <div class="hired-hunter-card">
                  <div class="hunter-avatar">${guildHunter.sprite}</div>
                  <div class="hunter-info">
                    <span class="hunter-name">${guildHunter.name}</span>
                    <span class="hunter-rank" style="color: ${getHunterRankColor(guildHunter.rank)}">${guildHunter.rank}급</span>
                  </div>
                  <div class="hunter-stats">
                    <span class="hunter-gps">+${guildHunter.gps} GPS</span>
                    <span class="hunter-earned">${Math.floor(hired.totalGoldProduced).toLocaleString()} G 수급</span>
                  </div>
                  <button class="btn-dismiss" data-hunter-id="${guildHunter.id}">해고</button>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <!-- Available Hunters -->
      <div class="card available-hunters-card">
        <div class="card-header">
          <h4>🎯 고용 가능한 헌터</h4>
        </div>

        ${['E', 'D', 'C'].map(rank => {
          const hunters = availableHunters.filter(h => h.rank === rank);
          if (hunters.length === 0) return '';

          return `
            <div class="hunter-rank-section">
              <h5 class="rank-header" style="color: ${getHunterRankColor(rank)}">${rank}급 헌터</h5>
              <div class="available-hunters-grid">
                ${hunters.map(h => {
                  const canHire = gold >= h.hireCost && hiredHunters.length < maxSlots;
                  return `
                    <div class="available-hunter-card ${canHire ? '' : 'disabled'}">
                      <div class="hunter-top">
                        <span class="hunter-avatar">${h.sprite}</span>
                        <span class="hunter-name">${h.name}</span>
                      </div>
                      <div class="hunter-specialty">${h.specialty}</div>
                      <div class="hunter-bottom">
                        <span class="hunter-gps">+${h.gps} GPS</span>
                        <button class="btn-hire ${canHire ? '' : 'disabled'}"
                                data-hunter-id="${h.id}"
                                ${canHire ? '' : 'disabled'}>
                          ${h.hireCost.toLocaleString()} G
                        </button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
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

  // Hire hunters
  document.querySelectorAll('.btn-hire').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const hunterId = e.currentTarget.dataset.hunterId;
      const result = stateManager.hireGuildHunter(hunterId);
      if (result.success) {
        const guildHunter = getGuildHunterById(hunterId);
        window.showNotification(`${guildHunter.name}을(를) 고용했습니다!`, 'success');
        renderGuild();
      } else {
        window.showNotification(result.error, 'error');
      }
    });
  });

  // Dismiss hunters
  document.querySelectorAll('.btn-dismiss').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const hunterId = e.currentTarget.dataset.hunterId;
      const guildHunter = getGuildHunterById(hunterId);
      if (confirm(`${guildHunter.name}을(를) 해고하시겠습니까?`)) {
        const result = stateManager.dismissGuildHunter(hunterId);
        if (result.success) {
          window.showNotification(`${guildHunter.name}을(를) 해고했습니다.`, 'info');
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
    ...DISPATCH_MATERIALS['E'],
    ...DISPATCH_MATERIALS['D'],
    ...DISPATCH_MATERIALS['C']
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
