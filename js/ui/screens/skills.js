// 스킬 화면
import { stateManager } from '../../core/stateManager.js';
import { SKILLS, canUnlockSkill, getSkillTreeForCharacter } from '../../config/skills.js';
import { GameEngine } from '../../core/gameEngine.js';
import { getClassById } from '../../config/classes.js';

export function renderSkills() {
  const app = document.getElementById('app');
  const character = stateManager.get('character');

  if (!character) {
    app.innerHTML = '<div class="empty-state"><p>캐릭터가 없습니다.</p></div>';
    return;
  }

  const unlockedSkills = character.unlockedSkills || [];
  const equippedSkills = character.equippedSkills || [];
  const currentClass = character.classId ? getClassById(character.classId) : null;

  // 해당 직업이 배울 수 있는 스킬만 필터링
  const classSkills = getSkillTreeForCharacter(character);
  const attackSkills = classSkills.filter(s => s.type === 'attack' || s.type === 'magic' || s.type === 'summon');
  const supportSkills = classSkills.filter(s => s.type === 'buff' || s.type === 'heal' || s.type === 'debuff');

  app.innerHTML = `
    <div class="skills-screen">
      <header class="screen-header">
        <h1>스킬</h1>
        ${currentClass ? `<p class="class-indicator">${currentClass.icon} ${currentClass.name} 스킬</p>` : ''}
      </header>

      <!-- 장착 슬롯 -->
      <div class="equipped-skills card">
        <h3>장착 스킬 (${equippedSkills.length}/4)</h3>
        <div class="skill-slots">
          ${[0, 1, 2, 3].map(i => {
            const skillId = equippedSkills[i];
            const skill = skillId ? SKILLS[skillId] : null;
            return `
              <div class="skill-slot ${skill ? 'filled' : 'empty'}" data-slot="${i}">
                ${skill ? `
                  <div class="skill-icon">${getSkillIcon(skill)}</div>
                  <div class="skill-name">${skill.name}</div>
                  <button class="unequip-btn" data-skill="${skillId}">&times;</button>
                ` : `
                  <div class="empty-slot">빈 슬롯</div>
                `}
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 공격 스킬 -->
      <div class="skill-category card">
        <h3>공격 스킬</h3>
        <div class="skills-grid">
          ${attackSkills.map(skill => renderSkillCard(skill, unlockedSkills, equippedSkills, character)).join('')}
        </div>
      </div>

      <!-- 보조 스킬 -->
      <div class="skill-category card">
        <h3>보조 스킬</h3>
        <div class="skills-grid">
          ${supportSkills.map(skill => renderSkillCard(skill, unlockedSkills, equippedSkills, character)).join('')}
        </div>
      </div>
    </div>
  `;

  // 이벤트 바인딩
  bindSkillEvents(character);
}

function renderSkillCard(skill, unlockedSkills, equippedSkills, character) {
  const isUnlocked = unlockedSkills.includes(skill.id);
  const isEquipped = equippedSkills.includes(skill.id);
  const canUnlock = canUnlockSkill(skill.id, character);

  let statusClass = 'locked';
  if (isUnlocked) statusClass = isEquipped ? 'equipped' : 'unlocked';

  const requirements = getRequirementText(skill.unlockRequirements);

  return `
    <div class="skill-card ${statusClass}" data-skill="${skill.id}">
      <div class="skill-card-icon">${getSkillIcon(skill)}</div>
      <div class="skill-card-info">
        <h4>${skill.name}</h4>
        <p class="skill-desc">${skill.description}</p>
        ${skill.mpCost > 0 ? `<span class="mp-cost">MP ${skill.mpCost}</span>` : ''}
      </div>
      ${!isUnlocked ? `
        <div class="skill-requirements">
          <span class="req-label">해금 조건:</span>
          <span class="req-text ${canUnlock ? 'met' : ''}">${requirements}</span>
        </div>
      ` : ''}
      ${isUnlocked && !isEquipped && equippedSkills.length < 4 ? `
        <button class="equip-btn" data-skill="${skill.id}">장착</button>
      ` : ''}
      ${isEquipped ? `
        <div class="equipped-badge">장착중</div>
      ` : ''}
    </div>
  `;
}

function getSkillIcon(skill) {
  const icons = {
    // 공용
    'sword': '&#9876;',
    'shield': '&#128737;',
    // 전사 계열
    'megaphone': '&#128227;',
    'fist': '&#128074;',
    'castle': '&#127984;',
    'axe': '&#129683;',
    'stomp': '&#129406;',
    'skull': '&#128128;',
    'blood': '&#129656;',
    'angry': '&#128544;',
    // 검사 계열
    'wind': '&#128168;',
    'swords': '&#9876;',
    'eye': '&#128065;',
    'dance': '&#128131;',
    'holy': '&#10022;',
    'crown': '&#128081;',
    'katana': '&#128481;',
    'blade': '&#128481;',
    'ultimate': '&#127775;',
    // 마법사 계열
    'sparkle': '&#10024;',
    'fire': '&#128293;',
    'water': '&#128167;',
    'lightning': '&#9889;',
    'stone': '&#129704;',
    'metal': '&#9881;',
    'shadow': '&#127761;',
    'light': '&#10024;',
    'inferno': '&#128293;',
    'rain': '&#127783;',
    'wave': '&#127754;',
    'ice': '&#10052;',
    'hurricane': '&#127744;',
    'barrier': '&#127768;',
    'tempest': '&#127744;',
    'earthquake': '&#127755;',
    'armor': '&#129717;',
    'gaia': '&#127807;',
    'alchemy': '&#9878;',
    'storm': '&#127785;',
    'gold': '&#129689;',
    'philosopher': '&#128142;',
    'drain': '&#128165;',
    'curse': '&#128122;',
    'void': '&#11044;',
    'heart': '&#10084;',
    'heart-pulse': '&#128147;',
    'bless': '&#128588;',
    'judgment': '&#9878;',
    'shock': '&#9889;',
    'chain': '&#128279;',
    'plasma': '&#128165;',
    'meditation': '&#129496;',
    'explosion': '&#128165;',
    // 소환사 계열
    'fairy': '&#129498;',
    'bond': '&#128279;',
    'golem': '&#129302;',
    'skeleton': '&#128128;',
    'ghost': '&#128123;',
    'soul': '&#128124;',
    'army': '&#128128;',
    'magic-sword': '&#128481;',
    'spear': '&#128993;',
    'blade-storm': '&#127744;',
    'armory': '&#129717;',
    'wolf': '&#128058;',
    'rage': '&#128293;',
    'drake': '&#128009;',
    'alpha': '&#128081;',
    'imp': '&#128520;',
    'pact': '&#128220;',
    'demon': '&#128520;',
    'gate': '&#128682;',
    'cherub': '&#128124;',
    'divine-shield': '&#128737;',
    'archangel': '&#128124;',
    'chorus': '&#127925;',
    'fire-elemental': '&#128293;',
    'water-elemental': '&#128167;',
    'fusion': '&#128165;'
  };
  return icons[skill.icon] || '&#10024;';
}

function getRequirementText(req) {
  const parts = [];
  if (req.level) parts.push(`Lv.${req.level}`);
  if (req.strength) parts.push(`힘 ${req.strength}`);
  if (req.vitality) parts.push(`체력 ${req.vitality}`);
  if (req.intelligence) parts.push(`지능 ${req.intelligence}`);
  if (req.agility) parts.push(`민첩 ${req.agility}`);
  return parts.join(', ');
}

function bindSkillEvents(character) {
  const gameEngine = new GameEngine(stateManager);

  // 장착 버튼
  document.querySelectorAll('.equip-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const skillId = e.target.dataset.skill;
      const result = gameEngine.equipSkill(character, skillId);

      if (result.success) {
        stateManager.saveCharacter(character);
        renderSkills();
      } else {
        showToast(result.message);
      }
    });
  });

  // 해제 버튼
  document.querySelectorAll('.unequip-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const skillId = e.target.dataset.skill;
      const result = gameEngine.unequipSkill(character, skillId);

      if (result.success) {
        stateManager.saveCharacter(character);
        renderSkills();
      } else {
        showToast(result.message);
      }
    });
  });

  // 스킬 카드 클릭 (상세 정보)
  document.querySelectorAll('.skill-card').forEach(card => {
    card.addEventListener('click', () => {
      const skillId = card.dataset.skill;
      showSkillDetail(skillId);
    });
  });
}

function showSkillDetail(skillId) {
  const skill = SKILLS[skillId];
  if (!skill) return;

  const modal = document.createElement('div');
  modal.className = 'modal show';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>${getSkillIcon(skill)} ${skill.name}</h2>
        <button class="close-btn">&times;</button>
      </div>
      <div class="skill-detail">
        <p>${skill.description}</p>
        <div class="skill-stats">
          ${skill.mpCost > 0 ? `<div>MP 소모: ${skill.mpCost}</div>` : ''}
          ${skill.multiplier ? `<div>데미지: ${skill.multiplier * 100}%</div>` : ''}
          ${skill.hits ? `<div>타격 횟수: ${skill.hits}회</div>` : ''}
          ${skill.effect ? `<div>효과: ${skill.effect.duration}턴 지속</div>` : ''}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('.close-btn').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
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
