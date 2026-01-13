// 자정 습격 화면
import { stateManager } from '../../core/stateManager.js';
import { createRaidMonster, calculateFleeChance, calculateDefeatPenalty } from '../../config/monsters.js';
import { router } from '../router.js';

let currentRaidMonster = null;

export function renderRaid() {
  const app = document.getElementById('app');
  const character = stateManager.get('character');

  if (!character) {
    router.navigate('class-select');
    return;
  }

  // 습격 몬스터 생성 (없으면)
  if (!currentRaidMonster) {
    currentRaidMonster = createRaidMonster(character.level);
    stateManager.set('currentRaidMonster', currentRaidMonster);
  }

  const fleeChance = calculateFleeChance(character, currentRaidMonster);

  app.innerHTML = `
    <div class="raid-screen">
      <div class="raid-alert card">
        <span class="raid-icon">&#9888;</span>
        <h2>자정 습격!</h2>
        <p>어둠 속에서 몬스터가 나타났습니다!</p>
      </div>

      <div class="monster-card card">
        <div class="monster-icon">${currentRaidMonster.icon}</div>
        <div class="monster-info">
          <h3>${currentRaidMonster.name}</h3>
          <span class="monster-level">Lv.${currentRaidMonster.level}</span>
          <p class="monster-desc">${currentRaidMonster.description}</p>
          <div class="monster-stats-bar">
            <div class="monster-stat">
              <span>&#10084;</span>
              <span>${currentRaidMonster.maxHp}</span>
            </div>
            <div class="monster-stat">
              <span>&#9876;</span>
              <span>${currentRaidMonster.attack}</span>
            </div>
            <div class="monster-stat">
              <span>&#128737;</span>
              <span>${currentRaidMonster.defense}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="raid-rewards card">
        <h4>예상 보상</h4>
        <p class="reward-exp">승리 시: +${currentRaidMonster.expReward} EXP</p>
        <p class="reward-warning">패배 시: 경험치 손실 + 부상</p>
      </div>

      <div class="raid-actions">
        <button class="btn-fight" id="fightBtn">
          &#9876; 전투 개시!
        </button>
        <button class="btn-flee" id="fleeBtn">
          &#128168; 도주 시도 (${Math.floor(fleeChance * 100)}%)
        </button>
      </div>

      <div class="raid-tip card">
        <p>&#128161; 팁: 도주에 실패하면 전투가 시작됩니다. 민첩 스탯이 높을수록 도주 성공률이 올라갑니다.</p>
      </div>
    </div>
  `;

  // 이벤트 바인딩
  document.getElementById('fightBtn').addEventListener('click', startRaidBattle);
  document.getElementById('fleeBtn').addEventListener('click', attemptFlee);
}

function startRaidBattle() {
  // 습격 전투 정보 저장
  stateManager.set('currentBattle', {
    type: 'raid',
    monster: currentRaidMonster,
    rewards: {
      exp: currentRaidMonster.expReward
    }
  });

  router.navigate('battle');
}

function attemptFlee() {
  const character = stateManager.get('character');
  const fleeChance = calculateFleeChance(character, currentRaidMonster);

  if (Math.random() < fleeChance) {
    // 도주 성공
    showFleeResult(true);
  } else {
    // 도주 실패 - 전투 시작
    showFleeResult(false);
  }
}

function showFleeResult(success) {
  const modal = document.createElement('div');
  modal.className = 'modal show';

  if (success) {
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>도주 성공!</h2>
        </div>
        <div class="flee-result success">
          <span class="result-icon">&#128168;</span>
          <p>재빠르게 도망쳐 몬스터를 따돌렸습니다!</p>
        </div>
        <div class="modal-actions">
          <button class="btn-primary" id="fleeOkBtn">확인</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.getElementById('fleeOkBtn').addEventListener('click', () => {
      modal.remove();
      clearRaid();
      router.navigate('dashboard');
    });
  } else {
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>도주 실패!</h2>
        </div>
        <div class="flee-result failure">
          <span class="result-icon">&#128561;</span>
          <p>몬스터에게 따라잡혔습니다! 전투를 시작합니다.</p>
        </div>
        <div class="modal-actions">
          <button class="btn-danger" id="forceFightBtn">전투 시작</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.getElementById('forceFightBtn').addEventListener('click', () => {
      modal.remove();
      startRaidBattle();
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal && success) {
      modal.remove();
      clearRaid();
      router.navigate('dashboard');
    }
  });
}

// 습격 종료 및 정리
export function clearRaid() {
  currentRaidMonster = null;
  stateManager.set('currentRaidMonster', null);
  stateManager.set('lastRaidDate', new Date().toDateString());
}

// 습격 결과 처리 (battle.js에서 호출)
export function handleRaidResult(victory) {
  const character = stateManager.get('character');

  if (victory) {
    // 승리: 경험치 획득, 부상 회복
    if (character.injured) {
      character.injured = false;
      stateManager.saveCharacter(character);
    }
  } else {
    // 패배: 패널티 적용
    const penalty = calculateDefeatPenalty(character);

    character.currentExp = Math.max(0, character.currentExp - penalty.expLoss);
    character.injured = true;
    stateManager.saveCharacter(character);

    return penalty;
  }

  clearRaid();
  return null;
}

// 자정 체크 (main.js에서 호출)
export function checkMidnightRaid() {
  const character = stateManager.get('character');
  if (!character) return false;

  const now = new Date();
  const lastRaidDate = stateManager.get('lastRaidDate');
  const today = now.toDateString();

  // 이미 오늘 습격을 처리했으면 스킵
  if (lastRaidDate === today) return false;

  // 자정 근처인지 체크 (23:55 ~ 00:05)
  const hour = now.getHours();
  const minute = now.getMinutes();

  const isMidnight = (hour === 23 && minute >= 55) || (hour === 0 && minute <= 5);

  // 테스트용: 앱 실행 시 하루에 한번 습격 발생
  // 실제로는 자정에만 발생하도록 하려면 isMidnight 조건 추가
  if (!lastRaidDate || lastRaidDate !== today) {
    // 습격 발생 확률 (70%)
    if (Math.random() < 0.7) {
      return true;
    } else {
      // 습격이 없었어도 날짜 기록
      stateManager.set('lastRaidDate', today);
      return false;
    }
  }

  return false;
}
