// The Hunter System - 퀘스트 화면
import { stateManager } from '../../core/stateManager.js';
import { GAME_CONSTANTS } from '../../config/constants.js';

let countdownInterval = null;

export function renderQuests() {
  const app = document.getElementById('app');
  const hunter = stateManager.get('hunter');
  const quests = stateManager.get('quests');
  const daily = stateManager.get('daily');

  if (!hunter) {
    window.location.hash = 'awakening';
    return;
  }

  const activeQuests = quests.filter(q => q.status !== 'completed');
  const completedToday = quests.filter(q =>
    q.status === 'completed' &&
    q.completedAt &&
    q.completedAt.split('T')[0] === new Date().toISOString().split('T')[0]
  );

  app.innerHTML = `
    <div class="quests-screen">
      <div class="screen-header">
        <h1>퀘스트</h1>
        <p class="screen-subtitle">실생활 목표를 퀘스트로 등록하세요</p>
      </div>

      <!-- 스태미나 상태 -->
      <div class="stamina-bar-container">
        <div class="stamina-header">
          <span>스태미나</span>
          <span>${daily.stamina} / ${GAME_CONSTANTS.DAILY_STAMINA}</span>
        </div>
        <div class="stamina-bar">
          <div class="stamina-fill" style="width: ${(daily.stamina / GAME_CONSTANTS.DAILY_STAMINA) * 100}%"></div>
        </div>
      </div>

      <!-- 퀘스트 생성 버튼 -->
      <button class="btn-primary create-quest-btn" id="createQuestBtn">
        + 새 퀘스트 등록
      </button>

      <!-- 활성 퀘스트 -->
      <div class="quest-section">
        <h3>진행 중인 퀘스트</h3>
        ${activeQuests.length === 0 ? `
          <div class="empty-state">
            <p>등록된 퀘스트가 없습니다.</p>
            <p class="hint">실생활 목표를 퀘스트로 등록해보세요!</p>
          </div>
        ` : `
          <div class="quest-list">
            ${activeQuests.map(quest => renderQuestCard(quest, hunter)).join('')}
          </div>
        `}
      </div>

      <!-- 오늘 완료 -->
      ${completedToday.length > 0 ? `
        <div class="quest-section completed-section">
          <h3>오늘 완료한 퀘스트</h3>
          <div class="quest-list">
            ${completedToday.map(quest => renderCompletedCard(quest)).join('')}
          </div>
        </div>
      ` : ''}
    </div>

    <!-- 퀘스트 생성 모달 -->
    <div class="modal" id="createQuestModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>새 퀘스트 등록</h2>
          <button class="close-btn" id="closeModal">&times;</button>
        </div>
        <div class="form-group">
          <label>퀘스트 내용</label>
          <input type="text" id="questTitle" placeholder="예: 30분 운동하기" maxlength="50">
        </div>
        <div class="form-group">
          <label>카테고리</label>
          <div class="category-grid">
            ${Object.entries(GAME_CONSTANTS.QUEST_CATEGORIES).map(([key, cat]) => `
              <button class="category-btn" data-category="${key}">
                <span class="cat-icon">${cat.icon}</span>
                <span class="cat-label">${cat.label}</span>
                <span class="cat-stat">+${cat.stat}</span>
              </button>
            `).join('')}
          </div>
        </div>
        <div class="form-group">
          <label>등급 (스태미나 소모)</label>
          <div class="grade-grid">
            ${Object.entries(GAME_CONSTANTS.QUEST_STAMINA_COST).map(([grade, cost]) => `
              <button class="grade-btn" data-grade="${grade}">
                <span class="grade-label">${grade}</span>
                <span class="grade-cost">${cost} ST</span>
              </button>
            `).join('')}
          </div>
        </div>
        <button class="btn-primary" id="submitQuest" disabled>퀘스트 생성</button>
      </div>
    </div>
  `;

  setupEventListeners();
  startCountdown();
}

function renderQuestCard(quest, hunter) {
  const category = GAME_CONSTANTS.QUEST_CATEGORIES[quest.category];
  const isInProgress = quest.status === 'in_progress';
  const canComplete = isInProgress && new Date(quest.completeAvailableAt) <= new Date();

  return `
    <div class="quest-card ${quest.status}" data-quest-id="${quest.id}">
      <div class="quest-header">
        <span class="quest-grade grade-${quest.grade}">${quest.grade}</span>
        <span class="quest-category">${category?.icon || ''} ${category?.label || ''}</span>
      </div>
      <h4 class="quest-title">${quest.title}</h4>
      <div class="quest-info">
        <span class="quest-stamina">&#9889; ${quest.staminaCost}</span>
        <span class="quest-reward">+${quest.reward.exp} EXP / +${quest.reward.gold} G</span>
      </div>
      <div class="quest-actions">
        ${quest.status === 'pending' ? `
          <button class="btn-start-quest" data-quest-id="${quest.id}">시작하기</button>
          <button class="btn-delete-quest" data-quest-id="${quest.id}">삭제</button>
        ` : ''}
        ${isInProgress && !canComplete ? `
          <div class="quest-timer" data-end-time="${quest.completeAvailableAt}">
            대기 중...
          </div>
        ` : ''}
        ${canComplete ? `
          <button class="btn-complete-quest" data-quest-id="${quest.id}">완료하기</button>
        ` : ''}
      </div>
    </div>
  `;
}

function renderCompletedCard(quest) {
  const category = GAME_CONSTANTS.QUEST_CATEGORIES[quest.category];

  return `
    <div class="quest-card completed">
      <div class="quest-header">
        <span class="quest-grade grade-${quest.grade}">${quest.grade}</span>
        <span class="quest-category">${category?.icon || ''}</span>
        <span class="completed-badge">완료</span>
      </div>
      <h4 class="quest-title">${quest.title}</h4>
    </div>
  `;
}

function setupEventListeners() {
  const modal = document.getElementById('createQuestModal');
  const createBtn = document.getElementById('createQuestBtn');
  const closeBtn = document.getElementById('closeModal');
  const submitBtn = document.getElementById('submitQuest');

  let selectedCategory = null;
  let selectedGrade = null;

  // 모달 열기
  createBtn.addEventListener('click', () => {
    modal.classList.add('show');
    selectedCategory = null;
    selectedGrade = null;
    document.getElementById('questTitle').value = '';
    updateSubmitButton();
  });

  // 모달 닫기
  closeBtn.addEventListener('click', () => {
    modal.classList.remove('show');
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('show');
    }
  });

  // 카테고리 선택
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedCategory = btn.dataset.category;
      updateSubmitButton();
    });
  });

  // 등급 선택
  document.querySelectorAll('.grade-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.grade-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedGrade = btn.dataset.grade;
      updateSubmitButton();
    });
  });

  // 제출 버튼 활성화 체크
  function updateSubmitButton() {
    const title = document.getElementById('questTitle').value.trim();
    submitBtn.disabled = !title || !selectedCategory || !selectedGrade;
  }

  document.getElementById('questTitle').addEventListener('input', updateSubmitButton);

  // 퀘스트 생성
  submitBtn.addEventListener('click', () => {
    const title = document.getElementById('questTitle').value.trim();
    if (!title || !selectedCategory || !selectedGrade) return;

    const daily = stateManager.get('daily');
    const staminaCost = GAME_CONSTANTS.QUEST_STAMINA_COST[selectedGrade];

    if (daily.stamina < staminaCost) {
      window.showNotification('스태미나가 부족합니다!', 'error');
      return;
    }

    stateManager.createQuest({
      title,
      category: selectedCategory,
      grade: selectedGrade
    });

    modal.classList.remove('show');
    window.showNotification('퀘스트가 등록되었습니다!', 'success');
    renderQuests();
  });

  // 퀘스트 시작
  document.querySelectorAll('.btn-start-quest').forEach(btn => {
    btn.addEventListener('click', () => {
      const questId = parseInt(btn.dataset.questId);
      const result = stateManager.startQuest(questId);

      if (result.success) {
        window.showNotification(`퀘스트 시작! ${result.waitMinutes}분 후 완료 가능`, 'info');
        renderQuests();
      } else {
        window.showNotification(result.error, 'error');
      }
    });
  });

  // 퀘스트 완료
  document.querySelectorAll('.btn-complete-quest').forEach(btn => {
    btn.addEventListener('click', () => {
      const questId = parseInt(btn.dataset.questId);
      const result = stateManager.completeQuest(questId);

      if (result.success) {
        let msg = `퀘스트 완료! +${result.rewards.exp} EXP, +${result.rewards.gold} G`;
        if (result.rewards.statGain) {
          msg += ` (${result.rewards.statGain} +1!)`;
        }
        window.showNotification(msg, 'success');
        renderQuests();
      } else {
        window.showNotification(result.error, 'error');
      }
    });
  });

  // 퀘스트 삭제
  document.querySelectorAll('.btn-delete-quest').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('이 퀘스트를 삭제하시겠습니까?')) {
        const questId = parseInt(btn.dataset.questId);
        stateManager.deleteQuest(questId);
        renderQuests();
      }
    });
  });
}

function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);

  countdownInterval = setInterval(() => {
    const timers = document.querySelectorAll('.quest-timer');
    let needsRefresh = false;

    timers.forEach(timer => {
      const endTime = new Date(timer.dataset.endTime);
      const now = new Date();
      const diff = endTime - now;

      if (diff <= 0) {
        needsRefresh = true;
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')} 남음`;
      }
    });

    if (needsRefresh) {
      renderQuests();
    }
  }, 1000);
}
