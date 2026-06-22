// 직업 선택 화면
import { stateManager } from '../../core/stateManager.js';
import { GameEngine } from '../../core/gameEngine.js';
import { BASE_CLASSES, ADVANCED_CLASSES, getAdvancedClassesFor, getClassById, CLASS_TIERS, canAdvanceClass } from '../../config/classes.js';
import { router } from '../router.js';

// 직업 선택 화면 (신규 캐릭터 생성)
export function renderClassSelect() {
  const app = document.getElementById('app');
  const baseClasses = Object.values(BASE_CLASSES);

  app.innerHTML = `
    <div class="class-select-screen">
      <header class="screen-header">
        <h1>직업 선택</h1>
        <p class="subtitle">당신의 운명을 선택하세요</p>
      </header>

      <div class="class-grid">
        ${baseClasses.map(cls => renderClassCard(cls, false)).join('')}
      </div>

      <div class="class-detail-panel" id="classDetailPanel" style="display: none;">
        <!-- 선택된 직업 상세 정보 -->
      </div>
    </div>
  `;

  // 직업 카드 클릭 이벤트
  document.querySelectorAll('.class-card').forEach(card => {
    card.addEventListener('click', () => {
      const classId = card.dataset.classId;
      showClassDetail(classId);
    });
  });
}

function renderClassCard(cls, isSelected) {
  const statBonusText = Object.entries(cls.statBonus)
    .filter(([_, v]) => v > 0)
    .map(([stat, value]) => `${getStatName(stat)} +${value}`)
    .join(', ');

  return `
    <div class="class-card ${isSelected ? 'selected' : ''}" data-class-id="${cls.id}">
      <div class="class-icon">${cls.icon}</div>
      <h3 class="class-name">${cls.name}</h3>
      <p class="class-desc">${cls.description}</p>
      <div class="class-bonus">${statBonusText}</div>
    </div>
  `;
}

function showClassDetail(classId) {
  const cls = getClassById(classId);
  if (!cls) return;

  const panel = document.getElementById('classDetailPanel');
  const advancedClasses = getAdvancedClassesFor(classId);

  panel.style.display = 'block';
  panel.innerHTML = `
    <div class="class-detail">
      <div class="class-detail-header">
        <span class="class-icon-large">${cls.icon}</span>
        <div class="class-info">
          <h2>${cls.name}</h2>
          <span class="class-tier">1차 직업</span>
        </div>
      </div>

      <p class="class-description">${cls.description}</p>

      <div class="stat-bonuses">
        <h4>초기 스탯 보너스</h4>
        <div class="bonus-grid">
          ${renderStatBonus(cls.statBonus)}
        </div>
      </div>

      <div class="growth-info">
        <h4>성장 특성</h4>
        <div class="growth-bars">
          ${renderGrowthBars(cls.growthWeights)}
        </div>
      </div>

      <div class="combat-modifiers">
        <h4>전투 보정</h4>
        <div class="modifier-list">
          ${renderCombatModifiers(cls.combatModifiers)}
        </div>
      </div>

      ${advancedClasses.length > 0 ? `
        <div class="advancement-preview">
          <h4>전직 가능 직업 (Lv.${CLASS_TIERS.ADVANCED.requiredLevel})</h4>
          <div class="advancement-list">
            ${advancedClasses.map(adv => `
              <div class="advancement-item">
                <span class="adv-icon">${adv.icon}</span>
                <span class="adv-name">${adv.name}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="class-actions">
        <button class="btn-secondary" onclick="document.getElementById('classDetailPanel').style.display='none'">
          취소
        </button>
        <button class="btn-primary" id="selectClassBtn" data-class-id="${cls.id}">
          ${cls.name} 선택
        </button>
      </div>
    </div>
  `;

  // 선택 버튼 이벤트
  document.getElementById('selectClassBtn').addEventListener('click', (e) => {
    const selectedClassId = e.target.dataset.classId;
    showNameInput(selectedClassId);
  });

  // 선택된 카드 하이라이트
  document.querySelectorAll('.class-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.classId === classId);
  });
}

function showNameInput(classId) {
  const cls = getClassById(classId);
  const panel = document.getElementById('classDetailPanel');

  panel.innerHTML = `
    <div class="name-input-panel">
      <div class="selected-class-preview">
        <span class="class-icon-large">${cls.icon}</span>
        <span class="class-name-preview">${cls.name}</span>
      </div>

      <div class="name-form">
        <label for="characterName">캐릭터 이름</label>
        <input type="text" id="characterName" placeholder="이름을 입력하세요" maxlength="12" />
      </div>

      <div class="class-actions">
        <button class="btn-secondary" onclick="showClassDetail('${classId}')">
          뒤로
        </button>
        <button class="btn-primary" id="createCharacterBtn">
          모험 시작!
        </button>
      </div>
    </div>
  `;

  // 캐릭터 생성 버튼 이벤트
  document.getElementById('createCharacterBtn').addEventListener('click', () => {
    const nameInput = document.getElementById('characterName');
    const name = nameInput.value.trim() || cls.name;
    createCharacterWithClass(name, classId);
  });

  // 엔터 키로도 생성 가능
  document.getElementById('characterName').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const name = e.target.value.trim() || cls.name;
      createCharacterWithClass(name, classId);
    }
  });

  document.getElementById('characterName').focus();
}

function createCharacterWithClass(name, classId) {
  const gameEngine = new GameEngine(stateManager);
  const character = gameEngine.createNewCharacter(name, classId);

  stateManager.saveCharacter(character);

  showToast(`${character.name} (${getClassById(classId).name}) 생성 완료!`);
  router.navigate('dashboard');
}

// 전직 화면 (레벨 30, 70 도달 시)
export function renderClassAdvancement() {
  const app = document.getElementById('app');
  const character = stateManager.get('character');

  if (!character) {
    router.navigate('class-select');
    return;
  }

  const currentClass = getClassById(character.classId);
  const availableClasses = getAdvancedClassesFor(
    currentClass.baseClass || character.classId
  );

  // 전직 가능한 직업만 필터링
  const eligibleClasses = availableClasses.filter(cls => {
    const result = canAdvanceClass(character, cls.id);
    return result.canAdvance;
  });

  if (eligibleClasses.length === 0) {
    app.innerHTML = `
      <div class="class-select-screen">
        <header class="screen-header">
          <h1>전직</h1>
        </header>
        <div class="empty-state">
          <p>현재 전직 가능한 직업이 없습니다.</p>
          <p>레벨 ${CLASS_TIERS.ADVANCED.requiredLevel}에 전문화 직업으로,</p>
          <p>레벨 ${CLASS_TIERS.MASTER.requiredLevel}에 마스터 직업으로 전직할 수 있습니다.</p>
          <button class="btn-primary" onclick="history.back()">돌아가기</button>
        </div>
      </div>
    `;
    return;
  }

  app.innerHTML = `
    <div class="class-select-screen advancement">
      <header class="screen-header">
        <h1>전직</h1>
        <p class="subtitle">새로운 길을 선택하세요</p>
      </header>

      <div class="current-class-info">
        <span class="label">현재 직업</span>
        <div class="current-class">
          <span class="class-icon">${currentClass.icon}</span>
          <span class="class-name">${currentClass.name}</span>
          <span class="class-level">Lv.${character.level}</span>
        </div>
      </div>

      <div class="advancement-arrow">▼</div>

      <div class="class-grid advancement-grid">
        ${eligibleClasses.map(cls => renderAdvancementCard(cls)).join('')}
      </div>

      <div class="class-detail-panel" id="classDetailPanel" style="display: none;">
      </div>
    </div>
  `;

  // 직업 카드 클릭 이벤트
  document.querySelectorAll('.class-card').forEach(card => {
    card.addEventListener('click', () => {
      const classId = card.dataset.classId;
      showAdvancementDetail(classId, character);
    });
  });
}

function renderAdvancementCard(cls) {
  return `
    <div class="class-card" data-class-id="${cls.id}">
      <div class="class-icon">${cls.icon}</div>
      <h3 class="class-name">${cls.name}</h3>
      <p class="class-desc">${cls.description}</p>
      ${cls.passive ? `
        <div class="passive-preview">
          <span class="passive-label">패시브:</span>
          <span class="passive-name">${cls.passive.name}</span>
        </div>
      ` : ''}
    </div>
  `;
}

function showAdvancementDetail(classId, character) {
  const cls = getClassById(classId);
  if (!cls) return;

  const panel = document.getElementById('classDetailPanel');
  panel.style.display = 'block';

  panel.innerHTML = `
    <div class="class-detail advancement-detail">
      <div class="class-detail-header">
        <span class="class-icon-large">${cls.icon}</span>
        <div class="class-info">
          <h2>${cls.name}</h2>
          <span class="class-tier">${cls.tier}차 직업</span>
        </div>
      </div>

      <p class="class-description">${cls.description}</p>

      ${cls.passive ? `
        <div class="passive-info">
          <h4>고유 패시브: ${cls.passive.name}</h4>
          <p>${cls.passive.description}</p>
        </div>
      ` : ''}

      <div class="stat-bonuses">
        <h4>추가 스탯 보너스</h4>
        <div class="bonus-grid">
          ${renderStatBonus(cls.statBonus)}
        </div>
      </div>

      <div class="combat-modifiers">
        <h4>전투 보정</h4>
        <div class="modifier-list">
          ${renderCombatModifiers(cls.combatModifiers)}
        </div>
      </div>

      <div class="special-skills">
        <h4>전용 스킬</h4>
        <div class="skill-preview-list">
          ${cls.specialSkills.map(skillId => `
            <span class="skill-tag">${skillId.replace(/_/g, ' ')}</span>
          `).join('')}
        </div>
      </div>

      <div class="class-actions">
        <button class="btn-secondary" onclick="document.getElementById('classDetailPanel').style.display='none'">
          취소
        </button>
        <button class="btn-primary advancement-btn" data-class-id="${cls.id}">
          ${cls.name}(으)로 전직
        </button>
      </div>
    </div>
  `;

  // 전직 버튼 이벤트
  document.querySelector('.advancement-btn').addEventListener('click', (e) => {
    const targetClassId = e.target.dataset.classId;
    advanceToClass(character, targetClassId);
  });

  // 선택된 카드 하이라이트
  document.querySelectorAll('.class-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.classId === classId);
  });
}

function advanceToClass(character, targetClassId) {
  const gameEngine = new GameEngine(stateManager);
  const result = gameEngine.advanceClass(character, targetClassId);

  if (result.success) {
    stateManager.saveCharacter(character);
    const newClass = getClassById(targetClassId);
    showToast(`${newClass.name}(으)로 전직 완료!`);
    router.navigate('character');
  } else {
    showToast(result.message);
  }
}

// 헬퍼 함수들
function getStatName(stat) {
  const names = {
    strength: '힘',
    vitality: '체력',
    intelligence: '지능',
    agility: '민첩'
  };
  return names[stat] || stat;
}

function renderStatBonus(statBonus) {
  return Object.entries(statBonus)
    .map(([stat, value]) => {
      const colorClass = value > 0 ? 'positive' : value < 0 ? 'negative' : '';
      const sign = value > 0 ? '+' : '';
      return `
        <div class="bonus-item ${colorClass}">
          <span class="stat-name">${getStatName(stat)}</span>
          <span class="stat-value">${sign}${value}</span>
        </div>
      `;
    })
    .join('');
}

function renderGrowthBars(weights) {
  return Object.entries(weights)
    .map(([stat, weight]) => `
      <div class="growth-bar-item">
        <span class="stat-label">${getStatName(stat)}</span>
        <div class="growth-bar">
          <div class="growth-fill" style="width: ${weight * 100}%"></div>
        </div>
        <span class="growth-value">${Math.round(weight * 100)}%</span>
      </div>
    `)
    .join('');
}

function renderCombatModifiers(modifiers) {
  const modifierNames = {
    hpBonus: 'HP',
    mpBonus: 'MP',
    attackBonus: '공격력',
    magicAttackBonus: '마법력',
    defenseBonus: '방어력',
    critRateBonus: '크리티컬률',
    critDamageBonus: '크리티컬 피해',
    dodgeBonus: '회피율',
    healBonus: '치유량',
    summonBonus: '소환수 능력',
    drainBonus: '흡수량',
    stunChanceBonus: '마비 확률'
  };

  return Object.entries(modifiers)
    .map(([mod, value]) => {
      const percent = Math.round((value - 1) * 100);
      const sign = percent >= 0 ? '+' : '';
      const colorClass = percent >= 0 ? 'positive' : 'negative';
      return `
        <div class="modifier-item ${colorClass}">
          <span class="modifier-name">${modifierNames[mod] || mod}</span>
          <span class="modifier-value">${sign}${percent}%</span>
        </div>
      `;
    })
    .join('');
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
