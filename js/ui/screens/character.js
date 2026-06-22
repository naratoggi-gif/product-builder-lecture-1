// 캐릭터 상세 화면
import { stateManager } from '../../core/stateManager.js';
import { GameEngine } from '../../core/gameEngine.js';
import { getRequiredExp, calculateCombatStats } from '../../config/constants.js';
import { goalManager } from '../../core/goalManager.js';
import { getClassById, getAdvancedClassesFor, CLASS_TIERS, canAdvanceClass } from '../../config/classes.js';
import { router } from '../router.js';

export function renderCharacter() {
  const app = document.getElementById('app');
  const character = stateManager.get('character');

  if (!character) {
    app.innerHTML = '<div class="empty-state"><p>캐릭터가 없습니다.</p></div>';
    return;
  }

  const levelProgress = {
    current: character.currentExp,
    required: getRequiredExp(character.level),
    percentage: Math.floor((character.currentExp / getRequiredExp(character.level)) * 100)
  };

  const stats = character.stats;
  const combatStats = character.combatStats;
  const totalCompleted = goalManager.getTotalCompleted();
  const bestStreak = goalManager.getBestStreak();
  const bossesDefeated = stateManager.get('defeatedBosses').length;

  // 직업 정보
  const currentClass = character.classId ? getClassById(character.classId) : null;
  const canAdvance = character.level >= CLASS_TIERS.ADVANCED.requiredLevel &&
                     currentClass && currentClass.tier === 1;
  const canMasterAdvance = character.level >= CLASS_TIERS.MASTER.requiredLevel &&
                           currentClass && currentClass.tier === 2;

  app.innerHTML = `
    <div class="character-screen">
      <header class="screen-header">
        <h1>캐릭터</h1>
      </header>

      <!-- 캐릭터 카드 -->
      <div class="character-card card">
        <div class="character-avatar-large">
          <div class="avatar-icon-large">${currentClass?.icon || '&#9876;'}</div>
        </div>
        <h2 class="character-name">${character.name}</h2>
        ${currentClass ? `
          <div class="character-class">
            <span class="class-name">${currentClass.name}</span>
            <span class="class-tier">${currentClass.tier}차 직업</span>
          </div>
        ` : ''}
        <div class="character-level">Level ${character.level}</div>
        <div class="exp-bar-large">
          <div class="exp-fill" style="width: ${levelProgress.percentage}%"></div>
          <span class="exp-text">${levelProgress.current} / ${levelProgress.required} XP</span>
        </div>
        <div class="total-exp">총 경험치: ${character.totalExp.toLocaleString()} XP</div>
        ${(canAdvance || canMasterAdvance) ? `
          <button class="btn-advancement" id="advancementBtn">
            전직 가능!
          </button>
        ` : ''}
      </div>

      <!-- 스탯 패널 -->
      <div class="stats-panel card">
        <div class="card-header">
          <h3>스탯</h3>
          ${character.statPoints > 0 ? `<span class="points-badge">${character.statPoints} 포인트</span>` : ''}
        </div>
        <div class="stats-list">
          ${renderStatRow('strength', '힘', stats.strength, character.statPoints > 0)}
          ${renderStatRow('vitality', '체력', stats.vitality, character.statPoints > 0)}
          ${renderStatRow('intelligence', '지능', stats.intelligence, character.statPoints > 0)}
          ${renderStatRow('agility', '민첩', stats.agility, character.statPoints > 0)}
        </div>
      </div>

      <!-- 전투 스탯 -->
      <div class="combat-stats card">
        <h3>전투 능력치</h3>
        <div class="combat-stats-grid">
          <div class="combat-stat">
            <span class="combat-stat-icon">&#10084;</span>
            <span class="combat-stat-label">HP</span>
            <span class="combat-stat-value">${combatStats.maxHp}</span>
          </div>
          <div class="combat-stat">
            <span class="combat-stat-icon">&#9733;</span>
            <span class="combat-stat-label">MP</span>
            <span class="combat-stat-value">${combatStats.maxMp}</span>
          </div>
          <div class="combat-stat">
            <span class="combat-stat-icon">&#9876;</span>
            <span class="combat-stat-label">공격력</span>
            <span class="combat-stat-value">${combatStats.attack}</span>
          </div>
          <div class="combat-stat">
            <span class="combat-stat-icon">&#10031;</span>
            <span class="combat-stat-label">마법력</span>
            <span class="combat-stat-value">${combatStats.magicAttack}</span>
          </div>
          <div class="combat-stat">
            <span class="combat-stat-icon">&#128737;</span>
            <span class="combat-stat-label">방어력</span>
            <span class="combat-stat-value">${combatStats.defense}</span>
          </div>
          <div class="combat-stat">
            <span class="combat-stat-icon">&#9889;</span>
            <span class="combat-stat-label">크리티컬</span>
            <span class="combat-stat-value">${combatStats.critRate.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <!-- 통계 -->
      <div class="player-stats card">
        <h3>활동 기록</h3>
        <div class="player-stats-grid">
          <div class="player-stat">
            <span class="player-stat-value">${totalCompleted}</span>
            <span class="player-stat-label">완료한 목표</span>
          </div>
          <div class="player-stat">
            <span class="player-stat-value">${bestStreak}</span>
            <span class="player-stat-label">최장 연속</span>
          </div>
          <div class="player-stat">
            <span class="player-stat-value">${bossesDefeated}</span>
            <span class="player-stat-label">처치한 보스</span>
          </div>
        </div>
      </div>

      <!-- 부상 상태 표시 -->
      ${character.injured ? `
        <div class="injury-warning card">
          <span class="injury-icon">&#129656;</span>
          <div class="injury-info">
            <h4>부상 상태</h4>
            <p>모든 스탯 10% 감소 중. 다음 전투 승리 시 회복됩니다.</p>
          </div>
        </div>
      ` : ''}

      <!-- 새 캐릭터 생성 -->
      <div class="new-character-section card">
        <h3>캐릭터 관리</h3>
        <p class="warning-text">새 캐릭터를 생성하면 현재 캐릭터는 삭제됩니다.</p>
        <button class="btn-danger" id="newCharacterBtn">새 캐릭터 생성</button>
      </div>
    </div>
  `;

  // 스탯 포인트 배분 이벤트
  document.querySelectorAll('.stat-add-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const statName = e.target.dataset.stat;
      allocateStat(statName);
    });
  });

  // 전직 버튼 이벤트
  const advancementBtn = document.getElementById('advancementBtn');
  if (advancementBtn) {
    advancementBtn.addEventListener('click', () => {
      router.navigate('class-advancement');
    });
  }

  // 새 캐릭터 생성 버튼 이벤트
  const newCharacterBtn = document.getElementById('newCharacterBtn');
  if (newCharacterBtn) {
    newCharacterBtn.addEventListener('click', () => {
      showNewCharacterConfirm();
    });
  }
}

function showNewCharacterConfirm() {
  const modal = document.createElement('div');
  modal.className = 'modal show';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>새 캐릭터 생성</h2>
        <button class="close-btn">&times;</button>
      </div>
      <div class="confirm-content">
        <p class="warning-text">정말로 새 캐릭터를 생성하시겠습니까?</p>
        <p>현재 캐릭터의 모든 데이터가 삭제됩니다:</p>
        <ul>
          <li>레벨 및 경험치</li>
          <li>스탯 및 스킬</li>
          <li>보스 처치 기록</li>
        </ul>
        <p class="note">※ 목표 기록은 유지됩니다.</p>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" id="cancelNewChar">취소</button>
        <button class="btn-danger" id="confirmNewChar">새로 시작</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
  modal.querySelector('#cancelNewChar').addEventListener('click', () => modal.remove());
  modal.querySelector('#confirmNewChar').addEventListener('click', () => {
    // 캐릭터와 보스 기록만 삭제
    stateManager.set('character', null);
    stateManager.set('defeatedBosses', []);
    modal.remove();
    router.navigate('class-select');
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

function renderStatRow(statId, statName, value, canAllocate) {
  const statIcons = {
    strength: '&#128170;',
    vitality: '&#128154;',
    intelligence: '&#128218;',
    agility: '&#128168;'
  };

  return `
    <div class="stat-row">
      <div class="stat-info">
        <span class="stat-icon">${statIcons[statId]}</span>
        <span class="stat-name">${statName}</span>
      </div>
      <div class="stat-value-container">
        <span class="stat-value">${value}</span>
        ${canAllocate ? `
          <button class="stat-add-btn" data-stat="${statId}">+</button>
        ` : ''}
      </div>
    </div>
  `;
}

function allocateStat(statName) {
  const character = stateManager.get('character');
  const gameEngine = new GameEngine(stateManager);

  const result = gameEngine.allocateStat(character, statName);

  if (result.success) {
    stateManager.saveCharacter(character);

    if (result.newSkillsUnlocked.length > 0) {
      const skillNames = result.newSkillsUnlocked.map(s => s.name).join(', ');
      showToast(`새 스킬 해금: ${skillNames}`);
    }

    renderCharacter();
  } else {
    showToast(result.message);
  }
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}
