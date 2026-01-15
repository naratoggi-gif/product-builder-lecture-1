// The Hunter System - 각성 화면 (헌터 생성)
import { stateManager } from '../../core/stateManager.js';
import { GAME_CONSTANTS } from '../../config/constants.js';

let selectedGender = null;

export function renderAwakening() {
  const app = document.getElementById('app');
  selectedGender = null;

  app.innerHTML = `
    <div class="awakening-screen">
      <div class="awakening-content">
        <div class="system-message">
          <div class="glitch-text">SYSTEM</div>
          <div class="message-box">
            <p class="typing-text">[시스템 알림]</p>
            <p class="typing-text delay-1">당신은 선택받았습니다.</p>
            <p class="typing-text delay-2">진정한 헌터가 될 자격이 있습니다.</p>
          </div>
        </div>

        <div class="awakening-rules">
          <h3>헌터 시스템 규칙</h3>
          <div class="rule-item real">
            <span class="rule-icon">&#128293;</span>
            <div class="rule-content">
              <strong>Real Hunter</strong>
              <p>실제 퀘스트 완료 시 100% 보상</p>
            </div>
          </div>
          <div class="rule-item sim">
            <span class="rule-icon">&#128308;</span>
            <div class="rule-content">
              <strong>Simulation Mode</strong>
              <p>퀘스트 없이 플레이 시 35% 보상</p>
            </div>
          </div>
        </div>

        <div class="awakening-quote">
          "Playing is allowed,<br>
          but real action makes you a true hunter."
        </div>

        <!-- Gender Selection -->
        <div class="gender-selection">
          <label>성별 선택</label>
          <div class="gender-buttons">
            <button class="gender-btn" data-gender="male">
              <span class="gender-icon">&#128104;</span>
              <span class="gender-label">남성</span>
            </button>
            <button class="gender-btn" data-gender="female">
              <span class="gender-icon">&#128105;</span>
              <span class="gender-label">여성</span>
            </button>
          </div>
        </div>

        <div class="name-input-section">
          <label for="hunterName">헌터 이름을 입력하세요</label>
          <input
            type="text"
            id="hunterName"
            placeholder="이름 입력..."
            maxlength="12"
            autocomplete="off"
          >
          <button class="btn-awaken" id="awakenBtn" disabled>
            각성하기
          </button>
        </div>
      </div>
    </div>
  `;

  // 이벤트 리스너
  const nameInput = document.getElementById('hunterName');
  const awakenBtn = document.getElementById('awakenBtn');

  // Gender selection
  document.querySelectorAll('.gender-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedGender = btn.dataset.gender;
      updateAwakenButton();
    });
  });

  nameInput.addEventListener('input', updateAwakenButton);

  function updateAwakenButton() {
    const name = nameInput.value.trim();
    awakenBtn.disabled = name.length < 2 || !selectedGender;
  }

  awakenBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (name.length >= 2 && selectedGender) {
      createHunter(name, selectedGender);
    }
  });

  nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const name = nameInput.value.trim();
      if (name.length >= 2 && selectedGender) {
        createHunter(name, selectedGender);
      }
    }
  });
}

function createHunter(name, gender) {
  // 헌터 생성
  stateManager.createHunter(name, gender);

  // 각성 완료 애니메이션
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="awakening-complete">
      <div class="rank-reveal">
        <span class="rank-label">당신의 랭크</span>
        <div class="rank-badge rank-e">E</div>
      </div>
      <h2>각성 완료</h2>
      <p class="hunter-name">${name}</p>
      <p class="welcome-msg">진정한 헌터의 여정이 시작됩니다.</p>
      <div class="initial-stats">
        <h4>초기 스탯</h4>
        <div class="stats-grid">
          ${Object.entries(GAME_CONSTANTS.INITIAL_STATS).map(([stat, value]) => `
            <div class="stat-item">
              <span class="stat-name">${stat}</span>
              <span class="stat-value">${value}</span>
            </div>
          `).join('')}
        </div>
      </div>
      <button class="btn-primary" onclick="window.location.hash='dashboard'">
        시작하기
      </button>
    </div>
  `;
}
