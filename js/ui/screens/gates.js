// The Hunter System - 게이트 화면
import { stateManager } from '../../core/stateManager.js';
import { gateSystem } from '../../core/gateSystem.js';
import { GAME_CONSTANTS, calculateCombatStats } from '../../config/constants.js';
import { GATE_ENTRY_WARNINGS } from '../../config/narrative.js';

// 게이트 데이터
const GATES = [
  {
    id: 'weekday_e',
    type: 'WEEKDAY',
    rank: 'E',
    name: 'E급 게이트',
    description: '초보 헌터를 위한 게이트',
    minLevel: 1,
    monsters: 5,
    baseReward: { exp: 50, gold: 100 }
  },
  {
    id: 'weekday_d',
    type: 'WEEKDAY',
    rank: 'D',
    name: 'D급 게이트',
    description: '일반적인 위험도의 게이트',
    minLevel: 5,
    monsters: 8,
    baseReward: { exp: 100, gold: 250 }
  },
  {
    id: 'weekday_c',
    type: 'WEEKDAY',
    rank: 'C',
    name: 'C급 게이트',
    description: '숙련된 헌터를 위한 게이트',
    minLevel: 10,
    monsters: 12,
    baseReward: { exp: 200, gold: 500 }
  },
  {
    id: 'weekend_b',
    type: 'WEEKEND',
    rank: 'B',
    name: 'B급 레이드',
    description: '주말 한정 고급 레이드 (보스 출현)',
    minLevel: 15,
    monsters: 15,
    baseReward: { exp: 400, gold: 1000 },
    weekendOnly: true,
    hasBoss: true
  },
  {
    id: 'simulation',
    type: 'SIMULATION',
    rank: '?',
    name: '시뮬레이션 게이트',
    description: '가상 훈련장 (35% 보상)',
    minLevel: 1,
    monsters: 10,
    baseReward: { exp: 80, gold: 150 },
    isSimulation: true
  }
];

/**
 * 통합 보상 공식: finalReward = base * hunterMultiplier * gateMultiplier * costumeMultiplier
 */
function calculateFinalReward(baseReward, isRealHunter, gateMultiplier) {
  const hunterMultiplier = isRealHunter
    ? GAME_CONSTANTS.REWARD_MULTIPLIER.REAL_HUNTER
    : GAME_CONSTANTS.REWARD_MULTIPLIER.SIMULATION;

  const costumeMultiplier = stateManager.getCostumeExpBonus();

  return {
    exp: Math.floor(baseReward.exp * hunterMultiplier * gateMultiplier * costumeMultiplier),
    gold: Math.floor(baseReward.gold * hunterMultiplier * gateMultiplier)
  };
}

let battleState = null;

export function renderGates() {
  const app = document.getElementById('app');
  const hunter = stateManager.get('hunter');
  const daily = stateManager.get('daily');

  if (!hunter) {
    window.location.hash = 'awakening';
    return;
  }

  const isRealHunter = stateManager.isRealHunterToday();
  const isWeekend = [0, 6].includes(new Date().getDay());
  const currentGate = gateSystem.getCurrentGate();
  const gateMultiplier = gateSystem.getGateRewardMultiplier();

  // 돌발 게이트 상태
  const isSuddenActive = gateSystem.isSuddenGateActive();
  const isSuddenCleared = gateSystem.isSuddenGateCleared();
  const suddenRemaining = gateSystem.getSuddenGateRemainingTime();
  const suddenReward = gateSystem.calculateSuddenGateReward();

  app.innerHTML = `
    <div class="gates-screen">
      <div class="screen-header">
        <h1>게이트</h1>
        <p class="screen-subtitle">던전을 클리어하고 보상을 획득하세요</p>
      </div>

      <!-- 현재 게이트 상태 -->
      <div class="current-gate-banner gate-${currentGate.id}">
        <span class="gate-name">${currentGate.name}</span>
        ${gateMultiplier > 1 ? `<span class="gate-bonus">보상 x${gateMultiplier}</span>` : ''}
        ${isWeekend && currentGate.id === 'weekend' ? '<span class="boss-indicator">&#128128; BOSS</span>' : ''}
      </div>

      <!-- 헌터 모드 상태 -->
      <div class="hunter-mode-indicator ${isRealHunter ? 'real' : 'simulation'}">
        <span class="mode-label">${isRealHunter ? 'Real Hunter' : 'Simulation Mode'}</span>
        <span class="mode-multiplier">헌터 배율 x${isRealHunter ? '1.0' : '0.35'}</span>
      </div>

      <!-- 게이트 입장 경고 배너 -->
      <div class="gate-warning-banner ${isRealHunter ? 'real' : 'simulation'}">
        <span class="warning-icon">${isRealHunter ? '&#9889;' : '&#9888;'}</span>
        <p>${isRealHunter ? GATE_ENTRY_WARNINGS.real : GATE_ENTRY_WARNINGS.simulation}</p>
      </div>

      <!-- 돌발 게이트 (활성화 시) -->
      ${isSuddenActive ? `
        <div class="card sudden-gate-card ${isSuddenCleared ? 'cleared' : 'active'}">
          <div class="sudden-gate-header">
            <span class="sudden-icon">&#9888;</span>
            <h3>돌발 게이트</h3>
            <span class="sudden-timer">${suddenRemaining ? Math.ceil(suddenRemaining / 60000) + '분 남음' : ''}</span>
          </div>
          <p class="sudden-desc">긴급 출현! 클리어 시 10분치 골드 보상</p>
          <div class="sudden-reward">
            <span>보상: +${suddenReward.exp} EXP / +${suddenReward.gold} G</span>
          </div>
          ${!isSuddenCleared ? `
            <button class="btn-clear-sudden" id="clearSuddenBtn">돌발 게이트 클리어!</button>
          ` : `
            <div class="sudden-cleared-badge">클리어 완료!</div>
          `}
        </div>
      ` : ''}

      <!-- 게이트 목록 -->
      <div class="gates-list">
        ${GATES.map(gate => {
          const isLocked = hunter.level < gate.minLevel;
          const isWeekendGate = gate.weekendOnly;
          const isAvailable = !isLocked && (!isWeekendGate || isWeekend);
          // 통합 보상 공식 적용
          const reward = calculateFinalReward(
            gate.baseReward,
            isRealHunter && !gate.isSimulation,
            gateMultiplier
          );

          return `
            <div class="gate-card ${isLocked ? 'locked' : ''} ${!isAvailable ? 'unavailable' : ''} ${gate.hasBoss && isWeekend ? 'has-boss' : ''}"
                 data-gate-id="${gate.id}">
              <div class="gate-header">
                <span class="gate-rank rank-${gate.rank.toLowerCase()}">${gate.rank}</span>
                <span class="gate-type">${GAME_CONSTANTS.GATE_TYPES[gate.type]?.name || gate.type}</span>
                ${gate.hasBoss && isWeekend ? '<span class="boss-badge">BOSS</span>' : ''}
              </div>
              <h3 class="gate-name">${gate.name}</h3>
              <p class="gate-desc">${gate.description}</p>
              <div class="gate-info">
                <span class="gate-monsters">&#128128; x${gate.monsters}</span>
                <span class="gate-reward">+${reward.exp} EXP / +${reward.gold} G</span>
              </div>
              ${isLocked ? `
                <div class="gate-requirement">Lv.${gate.minLevel} 필요</div>
              ` : ''}
              ${isWeekendGate && !isWeekend ? `
                <div class="gate-requirement">주말에만 입장 가능</div>
              ` : ''}
              ${isAvailable ? `
                <button class="btn-enter-gate" data-gate-id="${gate.id}">입장하기</button>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>

      <!-- 랜덤 게이트 -->
      ${!daily.randomGateUsed ? `
        <div class="card random-gate-card">
          <div class="random-gate-header">
            <span class="random-icon">&#127922;</span>
            <h3>랜덤 게이트</h3>
          </div>
          <p>하루 1회 랜덤 등급의 게이트에 입장할 수 있습니다.</p>
          <button class="btn-random-gate" id="randomGateBtn">랜덤 게이트 열기</button>
        </div>
      ` : `
        <div class="card random-gate-card used">
          <p>오늘의 랜덤 게이트를 이미 사용했습니다.</p>
        </div>
      `}
    </div>

    <!-- 전투 모달 -->
    <div class="modal" id="battleModal">
      <div class="modal-content battle-modal">
        <div id="battleArea"></div>
      </div>
    </div>
  `;

  setupGateEvents();
}

function setupGateEvents() {
  // 게이트 입장
  document.querySelectorAll('.btn-enter-gate').forEach(btn => {
    btn.addEventListener('click', () => {
      const gateId = btn.dataset.gateId;
      const gate = GATES.find(g => g.id === gateId);
      if (gate) {
        startBattle(gate);
      }
    });
  });

  // 랜덤 게이트
  const randomBtn = document.getElementById('randomGateBtn');
  if (randomBtn) {
    randomBtn.addEventListener('click', () => {
      const hunter = stateManager.get('hunter');
      const availableGates = GATES.filter(g =>
        !g.isSimulation && !g.weekendOnly && hunter.level >= g.minLevel
      );
      if (availableGates.length > 0) {
        const randomGate = availableGates[Math.floor(Math.random() * availableGates.length)];
        stateManager.update('daily', { randomGateUsed: true });
        startBattle(randomGate, true);
      }
    });
  }

  // 돌발 게이트 클리어
  const clearSuddenBtn = document.getElementById('clearSuddenBtn');
  if (clearSuddenBtn) {
    clearSuddenBtn.addEventListener('click', () => {
      const result = gateSystem.clearSuddenGate();
      if (result.success) {
        if (window.showNotification) {
          window.showNotification(`돌발 게이트 클리어! +${result.reward.exp} EXP, +${result.reward.gold} G`, 'success');
        }
        renderGates(); // UI 갱신
      } else {
        if (window.showNotification) {
          window.showNotification(result.error, 'error');
        }
      }
    });
  }
}

function startBattle(gate, isRandom = false) {
  const modal = document.getElementById('battleModal');
  const battleArea = document.getElementById('battleArea');
  const hunter = stateManager.get('hunter');
  const combatStats = calculateCombatStats(hunter.stats);
  const isRealHunter = stateManager.isRealHunterToday() && !gate.isSimulation;

  battleState = {
    gate,
    isRandom,
    monstersLeft: gate.monsters,
    playerHp: combatStats.maxHp,
    maxHp: combatStats.maxHp,
    combatStats,
    logs: [],
    isRealHunter
  };

  modal.classList.add('show');
  renderBattleUI();
  runBattleTurn();
}

function renderBattleUI() {
  const battleArea = document.getElementById('battleArea');
  const { gate, monstersLeft, playerHp, maxHp, logs, isRealHunter } = battleState;

  battleArea.innerHTML = `
    <div class="battle-screen">
      <div class="battle-header">
        <h2>${gate.name}</h2>
        <span class="battle-mode ${isRealHunter ? 'real' : 'sim'}">${isRealHunter ? 'REAL' : 'SIM'}</span>
      </div>

      <div class="battle-status">
        <div class="monsters-status">
          <span class="monster-icon">&#128128;</span>
          <span>남은 몬스터: ${monstersLeft}</span>
        </div>
        <div class="player-hp-bar">
          <span>HP: ${playerHp}/${maxHp}</span>
          <div class="hp-bar">
            <div class="hp-fill" style="width: ${(playerHp / maxHp) * 100}%"></div>
          </div>
        </div>
      </div>

      <div class="battle-log">
        ${logs.slice(-5).map(log => `
          <div class="log-entry ${log.type}">${log.text}</div>
        `).join('')}
      </div>

      <div class="battle-actions">
        ${battleState.monstersLeft > 0 && battleState.playerHp > 0 ? `
          <button class="btn-attack" id="attackBtn">공격</button>
        ` : ''}
      </div>
    </div>
  `;

  // 공격 버튼 이벤트
  const attackBtn = document.getElementById('attackBtn');
  if (attackBtn) {
    attackBtn.addEventListener('click', runBattleTurn);
  }
}

function runBattleTurn() {
  const { combatStats, gate, isRealHunter } = battleState;

  if (battleState.monstersLeft <= 0 || battleState.playerHp <= 0) {
    return;
  }

  // 플레이어 공격
  const isCrit = Math.random() * 100 < combatStats.critRate;
  let damage = combatStats.attack + Math.floor(Math.random() * 10);
  if (isCrit) {
    damage = Math.floor(damage * (combatStats.critDamage / 100));
    battleState.logs.push({ type: 'crit', text: `크리티컬! ${damage} 데미지!` });
  } else {
    battleState.logs.push({ type: 'attack', text: `${damage} 데미지를 입혔다!` });
  }

  // 몬스터 처치 (간단화: 데미지 20 이상이면 처치)
  if (damage >= 15) {
    battleState.monstersLeft--;
    battleState.logs.push({ type: 'kill', text: `몬스터를 처치했다!` });
  }

  // 몬스터 반격
  if (battleState.monstersLeft > 0) {
    const monsterDamage = Math.max(5, 10 - Math.floor(combatStats.defense / 3));
    battleState.playerHp -= monsterDamage;
    battleState.logs.push({ type: 'damage', text: `몬스터에게 ${monsterDamage} 데미지를 받았다!` });
  }

  renderBattleUI();

  // 전투 종료 체크
  if (battleState.monstersLeft <= 0) {
    setTimeout(() => endBattle(true), 500);
  } else if (battleState.playerHp <= 0) {
    setTimeout(() => endBattle(false), 500);
  }
}

function endBattle(victory) {
  const { gate, isRealHunter } = battleState;
  const battleArea = document.getElementById('battleArea');
  const gateMultiplier = gateSystem.getGateRewardMultiplier();

  // 통합 보상 공식: base * hunterMultiplier * gateMultiplier * costumeMultiplier
  const reward = calculateFinalReward(gate.baseReward, isRealHunter, gateMultiplier);

  if (victory) {
    stateManager.gainExp(reward.exp);
    stateManager.gainGold(reward.gold);

    battleArea.innerHTML = `
      <div class="battle-result victory">
        <h2>승리!</h2>
        <div class="reward-list">
          <p>+${reward.exp} EXP</p>
          <p>+${reward.gold} G</p>
          ${!isRealHunter ? '<p class="penalty-note">(시뮬레이션 모드: 35% 보상)</p>' : ''}
          ${gateMultiplier > 1 ? `<p class="bonus-note">(게이트 보너스: x${gateMultiplier})</p>` : ''}
        </div>
        <button class="btn-primary" id="closeBattle">확인</button>
      </div>
    `;
  } else {
    battleArea.innerHTML = `
      <div class="battle-result defeat">
        <h2>패배...</h2>
        <p>다음에 다시 도전하세요!</p>
        <button class="btn-primary" id="closeBattle">확인</button>
      </div>
    `;
  }

  document.getElementById('closeBattle').addEventListener('click', () => {
    document.getElementById('battleModal').classList.remove('show');
    renderGates();
  });
}
