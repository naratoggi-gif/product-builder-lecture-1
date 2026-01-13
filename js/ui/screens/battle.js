// 전투 화면
import { stateManager } from '../../core/stateManager.js';
import { BattleEngine } from '../../core/battleEngine.js';
import { GameEngine } from '../../core/gameEngine.js';
import { SKILLS } from '../../config/skills.js';
import { BOSSES } from '../../config/bosses.js';
import { router } from '../router.js';

let battleEngine = null;

export function renderBattle() {
  const app = document.getElementById('app');
  const bossId = sessionStorage.getItem('currentBoss');

  if (!bossId) {
    router.navigate('bosses');
    return;
  }

  const character = stateManager.get('character');
  if (!character) {
    router.navigate('dashboard');
    return;
  }

  // 전투 초기화
  battleEngine = new BattleEngine();
  battleEngine.initBattle(character, bossId);

  renderBattleState();
}

function renderBattleState() {
  const app = document.getElementById('app');
  const state = battleEngine.getState();

  if (!state) return;

  const player = state.player;
  const boss = state.boss;
  const equippedSkills = player.equippedSkills || ['basic_attack'];

  app.innerHTML = `
    <div class="battle-screen">
      <!-- 도망 버튼 -->
      <button class="flee-btn" id="flee-btn">&#8592; 도망</button>

      <!-- 보스 영역 -->
      <div class="boss-area">
        <div class="boss-display">
          <h2>${boss.name}</h2>
          <div class="boss-sprite">&#128121;</div>
          <div class="hp-bar boss-hp">
            <div class="hp-fill" style="width: ${(boss.currentHp / boss.stats.maxHp) * 100}%"></div>
            <span class="hp-text">HP: ${boss.currentHp} / ${boss.stats.maxHp}</span>
          </div>
          ${renderBuffs(boss.buffs, boss.debuffs)}
        </div>
      </div>

      <!-- 전투 로그 -->
      <div class="battle-log" id="battle-log">
        ${state.log.slice(-6).map(entry => `
          <div class="log-entry log-${entry.type}">${entry.message}</div>
        `).join('')}
      </div>

      <!-- 플레이어 영역 -->
      <div class="player-area">
        <div class="player-status">
          <div class="player-name">${player.name}</div>
          <div class="hp-bar player-hp">
            <div class="hp-fill" style="width: ${(player.currentHp / player.combatStats.maxHp) * 100}%"></div>
            <span class="hp-text">HP: ${player.currentHp} / ${player.combatStats.maxHp}</span>
          </div>
          <div class="mp-bar">
            <div class="mp-fill" style="width: ${(player.currentMp / player.combatStats.maxMp) * 100}%"></div>
            <span class="mp-text">MP: ${player.currentMp} / ${player.combatStats.maxMp}</span>
          </div>
          ${renderBuffs(player.buffs, player.debuffs)}
        </div>

        <!-- 스킬 버튼 -->
        <div class="skill-buttons">
          <button class="skill-btn" data-skill="basic_attack" ${state.phase !== 'player' || state.isOver ? 'disabled' : ''}>
            <span class="skill-icon">&#9876;</span>
            <span class="skill-name">기본 공격</span>
          </button>
          ${equippedSkills.filter(id => id !== 'basic_attack').map(skillId => {
            const skill = SKILLS[skillId];
            if (!skill) return '';
            const canUse = player.currentMp >= skill.mpCost;
            return `
              <button class="skill-btn ${!canUse ? 'disabled' : ''}"
                      data-skill="${skillId}"
                      ${state.phase !== 'player' || state.isOver || !canUse ? 'disabled' : ''}>
                <span class="skill-icon">${getSkillIcon(skill)}</span>
                <span class="skill-name">${skill.name}</span>
                <span class="skill-cost">${skill.mpCost}</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>

      ${state.isOver ? `
        <div class="battle-result-overlay">
          <div class="battle-result ${state.result}">
            <h2>${state.result === 'victory' ? '승리!' : '패배...'}</h2>
            ${state.result === 'victory' ? `
              <p>경험치 ${BOSSES[boss.id].rewards.exp} XP 획득!</p>
              <p>칭호 "${BOSSES[boss.id].rewards.title}" 획득!</p>
            ` : `
              <p>더 강해져서 다시 도전하세요!</p>
            `}
            <button class="btn-primary" id="battle-end-btn">확인</button>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  // 이벤트 바인딩
  bindBattleEvents(state);
}

function renderBuffs(buffs, debuffs) {
  if ((!buffs || buffs.length === 0) && (!debuffs || debuffs.length === 0)) {
    return '';
  }

  return `
    <div class="status-effects">
      ${(buffs || []).map(b => `<span class="buff" title="${b.stat}">${b.remainingTurns}</span>`).join('')}
      ${(debuffs || []).map(d => `<span class="debuff" title="${d.type}">${d.remainingTurns}</span>`).join('')}
    </div>
  `;
}

function getSkillIcon(skill) {
  const icons = {
    'sword': '&#9876;',
    'sword-cross': '&#9876;',
    'run': '&#128168;',
    'swords': '&#9876;',
    'tornado': '&#127744;',
    'fire': '&#128293;',
    'lightning': '&#9889;',
    'snowflake': '&#10052;',
    'meteor': '&#9732;',
    'shield': '&#128737;',
    'eye': '&#128065;',
    'castle': '&#127984;',
    'megaphone': '&#128227;',
    'heart': '&#10084;',
    'sparkles': '&#10024;',
    'heart-pulse': '&#128147;'
  };
  return icons[skill.icon] || '&#10024;';
}

function bindBattleEvents(state) {
  // 도망
  document.getElementById('flee-btn')?.addEventListener('click', () => {
    if (confirm('정말 도망치시겠습니까?')) {
      battleEngine.flee();
      sessionStorage.removeItem('currentBoss');
      router.navigate('bosses');
    }
  });

  // 스킬 버튼
  document.querySelectorAll('.skill-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      const skillId = btn.dataset.skill;
      executePlayerTurn(skillId);
    });
  });

  // 전투 종료
  document.getElementById('battle-end-btn')?.addEventListener('click', () => {
    handleBattleEnd();
  });
}

async function executePlayerTurn(skillId) {
  // 플레이어 행동
  const result = battleEngine.playerAction(skillId);

  renderBattleState();

  if (battleEngine.getState().isOver) return;

  // 보스 턴 (잠시 딜레이)
  await delay(800);

  battleEngine.bossAction();
  renderBattleState();
}

function handleBattleEnd() {
  const state = battleEngine.getState();
  const character = stateManager.get('character');
  const gameEngine = new GameEngine(stateManager);

  if (state.result === 'victory') {
    const boss = BOSSES[state.boss.id];

    // 경험치 지급
    const levelResult = gameEngine.addExperience(character, boss.rewards.exp);
    stateManager.saveCharacter(character);

    // 보스 처치 기록
    stateManager.recordBossDefeat(state.boss.id);

    if (levelResult.leveledUp) {
      alert(`레벨 업! Lv.${character.level}`);
    }
  }

  sessionStorage.removeItem('currentBoss');
  router.navigate('bosses');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
