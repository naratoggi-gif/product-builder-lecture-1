// 보스 목록 화면
import { stateManager } from '../../core/stateManager.js';
import { BOSSES, canChallengeBoss, getBossesByTier } from '../../config/bosses.js';
import { router } from '../router.js';

export function renderBosses() {
  const app = document.getElementById('app');
  const character = stateManager.get('character');
  const defeatedBosses = stateManager.get('defeatedBosses') || [];

  if (!character) {
    app.innerHTML = '<div class="empty-state"><p>캐릭터가 없습니다.</p></div>';
    return;
  }

  const tiers = [1, 2, 3, 4];

  app.innerHTML = `
    <div class="bosses-screen">
      <header class="screen-header">
        <h1>보스 도전</h1>
      </header>

      ${tiers.map(tier => renderBossTier(tier, character, defeatedBosses)).join('')}
    </div>
  `;

  // 이벤트 바인딩
  document.querySelectorAll('.boss-card.available').forEach(card => {
    card.addEventListener('click', () => {
      const bossId = card.dataset.boss;
      showBossChallenge(bossId);
    });
  });
}

function renderBossTier(tier, character, defeatedBosses) {
  const tierNames = {
    1: 'Tier 1 - 초급',
    2: 'Tier 2 - 중급',
    3: 'Tier 3 - 고급',
    4: 'Tier 4 - 최종 보스'
  };

  const bosses = getBossesByTier(tier);

  return `
    <div class="boss-tier card">
      <h3>${tierNames[tier]}</h3>
      <div class="bosses-grid">
        ${bosses.map(boss => renderBossCard(boss, character, defeatedBosses)).join('')}
      </div>
    </div>
  `;
}

function renderBossCard(boss, character, defeatedBosses) {
  const isDefeated = defeatedBosses.includes(boss.id);
  const canChallenge = canChallengeBoss(boss.id, character, defeatedBosses);

  const bossIcons = {
    'goblin': '&#128122;',
    'troll': '&#128122;',
    'dark_knight': '&#9876;',
    'witch': '&#129497;',
    'dragon': '&#128009;',
    'death_knight': '&#128128;',
    'demon': '&#128520;'
  };

  let statusClass = 'locked';
  if (isDefeated) statusClass = 'defeated';
  else if (canChallenge) statusClass = 'available';

  return `
    <div class="boss-card ${statusClass}" data-boss="${boss.id}">
      <div class="boss-icon">${bossIcons[boss.image] || '&#128121;'}</div>
      <div class="boss-info">
        <h4>${boss.name}</h4>
        <p class="boss-desc">${boss.description}</p>
        <div class="boss-stats">
          <span>HP ${boss.stats.maxHp}</span>
          <span>ATK ${boss.stats.attack}</span>
        </div>
      </div>
      ${isDefeated ? `
        <div class="defeated-badge">처치 완료</div>
      ` : ''}
      ${!canChallenge && !isDefeated ? `
        <div class="boss-requirements">
          <span>해금 조건:</span>
          ${getRequirementText(boss.unlockRequirements, character, defeatedBosses)}
        </div>
      ` : ''}
      ${canChallenge && !isDefeated ? `
        <div class="challenge-prompt">터치하여 도전</div>
      ` : ''}
    </div>
  `;
}

function getRequirementText(req, character, defeatedBosses) {
  const parts = [];

  if (req.level) {
    const met = character.level >= req.level;
    parts.push(`<span class="${met ? 'met' : ''}">Lv.${req.level}</span>`);
  }

  if (req.skills) {
    req.skills.forEach(skillId => {
      const met = character.unlockedSkills.includes(skillId);
      parts.push(`<span class="${met ? 'met' : ''}">스킬 필요</span>`);
    });
  }

  if (req.bossesDefeated) {
    req.bossesDefeated.forEach(bossId => {
      const boss = BOSSES[bossId];
      const met = defeatedBosses.includes(bossId);
      parts.push(`<span class="${met ? 'met' : ''}">${boss.name} 처치</span>`);
    });
  }

  return parts.join(', ');
}

function showBossChallenge(bossId) {
  const boss = BOSSES[bossId];
  if (!boss) return;

  const modal = document.createElement('div');
  modal.className = 'modal show';
  modal.innerHTML = `
    <div class="modal-content boss-challenge-modal">
      <div class="modal-header">
        <h2>${boss.name}</h2>
        <button class="close-btn">&times;</button>
      </div>
      <div class="boss-preview">
        <div class="boss-icon-large">&#128121;</div>
        <p>${boss.description}</p>
        <div class="boss-stats-detail">
          <div class="stat">HP: ${boss.stats.maxHp}</div>
          <div class="stat">공격력: ${boss.stats.attack}</div>
          <div class="stat">방어력: ${boss.stats.defense}</div>
        </div>
        <div class="boss-rewards">
          <h4>보상</h4>
          <p>경험치: ${boss.rewards.exp} XP</p>
          <p>칭호: ${boss.rewards.title}</p>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary close-modal-btn">취소</button>
        <button class="btn-primary challenge-btn" data-boss="${bossId}">도전하기</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
  modal.querySelector('.close-modal-btn').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  modal.querySelector('.challenge-btn').addEventListener('click', () => {
    modal.remove();
    // 전투 화면으로 이동
    sessionStorage.setItem('currentBoss', bossId);
    router.navigate('battle');
  });
}
