// 목표 관리 화면
import { stateManager } from '../../core/stateManager.js';
import { goalManager } from '../../core/goalManager.js';

let currentTab = 'habit';

export function renderGoals() {
  const app = document.getElementById('app');
  const goals = stateManager.get('goals');
  const today = new Date().toISOString().split('T')[0];

  const habits = goals.filter(g => g.type === 'habit' && g.status !== 'archived');
  const tasks = goals.filter(g => g.type === 'task' && g.status === 'active');
  const completed = goals.filter(g => g.status === 'completed');
  const archived = goals.filter(g => g.status === 'archived');

  app.innerHTML = `
    <div class="goals-screen">
      <header class="screen-header">
        <h1>목표 관리</h1>
      </header>

      <!-- 탭 -->
      <div class="tabs">
        <button class="tab ${currentTab === 'habit' ? 'active' : ''}" data-tab="habit">
          습관 (${habits.length})
        </button>
        <button class="tab ${currentTab === 'task' ? 'active' : ''}" data-tab="task">
          단기 (${tasks.length})
        </button>
        <button class="tab ${currentTab === 'completed' ? 'active' : ''}" data-tab="completed">
          완료 (${completed.length})
        </button>
        <button class="tab ${currentTab === 'archived' ? 'active' : ''}" data-tab="archived">
          보관
        </button>
      </div>

      <!-- 목표 목록 -->
      <div class="goals-content">
        ${renderGoalsList(currentTab, habits, tasks, completed, archived, today)}
      </div>

      <!-- 목표 추가 버튼 -->
      <button class="fab" id="add-goal-btn">+</button>

      <!-- 목표 추가 모달 -->
      <div class="modal" id="add-goal-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h2>새 목표 추가</h2>
            <button class="close-btn" id="close-modal">&times;</button>
          </div>
          <form id="goal-form">
            <div class="form-group">
              <label>목표 제목</label>
              <input type="text" id="goal-title" required placeholder="예: 매일 운동하기">
            </div>
            <div class="form-group">
              <label>설명 (선택)</label>
              <textarea id="goal-description" placeholder="목표에 대한 설명"></textarea>
            </div>
            <div class="form-group">
              <label>목표 유형</label>
              <div class="radio-group">
                <label class="radio-label">
                  <input type="radio" name="goal-type" value="habit" checked>
                  <span>습관 (장기)</span>
                </label>
                <label class="radio-label">
                  <input type="radio" name="goal-type" value="task">
                  <span>단기 목표</span>
                </label>
              </div>
            </div>
            <div class="form-group" id="difficulty-group">
              <label>난이도</label>
              <select id="goal-difficulty">
                <option value="easy">쉬움 (+30 XP)</option>
                <option value="normal" selected>보통 (+50 XP)</option>
                <option value="hard">어려움 (+80 XP)</option>
              </select>
            </div>
            <button type="submit" class="btn-primary">추가하기</button>
          </form>
        </div>
      </div>
    </div>
  `;

  // 이벤트 바인딩
  bindGoalEvents(today);
}

function renderGoalsList(tab, habits, tasks, completed, archived, today) {
  let items = [];
  let emptyMessage = '';

  switch (tab) {
    case 'habit':
      items = habits;
      emptyMessage = '습관 목표를 추가해보세요!';
      break;
    case 'task':
      items = tasks;
      emptyMessage = '단기 목표를 추가해보세요!';
      break;
    case 'completed':
      items = completed;
      emptyMessage = '아직 완료한 목표가 없습니다.';
      break;
    case 'archived':
      items = archived;
      emptyMessage = '보관된 목표가 없습니다.';
      break;
  }

  if (items.length === 0) {
    return `<div class="empty-state"><p>${emptyMessage}</p></div>`;
  }

  return `
    <ul class="goal-list">
      ${items.map(goal => renderGoalItem(goal, tab, today)).join('')}
    </ul>
  `;
}

function renderGoalItem(goal, tab, today) {
  const isCompleted = goal.type === 'habit'
    ? goal.lastCompletedDate === today
    : goal.status === 'completed';

  return `
    <li class="goal-list-item ${isCompleted ? 'completed' : ''}" data-goal-id="${goal.id}">
      <div class="goal-main">
        ${tab !== 'completed' && tab !== 'archived' ? `
          <label class="checkbox-container">
            <input type="checkbox"
                   class="goal-checkbox"
                   data-goal-id="${goal.id}"
                   ${isCompleted ? 'checked disabled' : ''}>
            <span class="checkmark"></span>
          </label>
        ` : ''}
        <div class="goal-info">
          <h4>${goal.title}</h4>
          ${goal.description ? `<p class="goal-desc">${goal.description}</p>` : ''}
          <div class="goal-meta">
            ${goal.type === 'habit' ? `
              <span class="streak">연속 ${goal.currentStreak || 0}일</span>
              <span class="best-streak">최고 ${goal.bestStreak || 0}일</span>
            ` : `
              <span class="difficulty difficulty-${goal.difficulty || 'normal'}">${getDifficultyLabel(goal.difficulty)}</span>
            `}
          </div>
        </div>
      </div>
      <div class="goal-actions">
        ${tab !== 'completed' && tab !== 'archived' ? `
          <button class="action-icon-btn archive-btn" data-goal-id="${goal.id}" title="보관">&#128230;</button>
        ` : ''}
        <button class="action-icon-btn delete-btn" data-goal-id="${goal.id}" title="삭제">&#128465;</button>
      </div>
    </li>
  `;
}

function getDifficultyLabel(difficulty) {
  const labels = { easy: '쉬움', normal: '보통', hard: '어려움' };
  return labels[difficulty] || '보통';
}

function bindGoalEvents(today) {
  // 탭 전환
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      currentTab = e.target.dataset.tab;
      renderGoals();
    });
  });

  // 목표 추가 모달
  const modal = document.getElementById('add-goal-modal');
  document.getElementById('add-goal-btn').addEventListener('click', () => {
    modal.classList.add('show');
  });
  document.getElementById('close-modal').addEventListener('click', () => {
    modal.classList.remove('show');
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('show');
  });

  // 목표 유형에 따라 난이도 표시/숨김
  document.querySelectorAll('input[name="goal-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      document.getElementById('difficulty-group').style.display =
        e.target.value === 'task' ? 'block' : 'none';
    });
  });

  // 목표 추가 폼
  document.getElementById('goal-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.querySelector('input[name="goal-type"]:checked').value;
    const goal = {
      title: document.getElementById('goal-title').value,
      description: document.getElementById('goal-description').value,
      type,
      difficulty: type === 'task' ? document.getElementById('goal-difficulty').value : 'normal'
    };
    goalManager.createGoal(goal);
    modal.classList.remove('show');
    document.getElementById('goal-form').reset();
    currentTab = type;
    renderGoals();
  });

  // 목표 완료
  document.querySelectorAll('.goal-checkbox:not(:disabled)').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const goalId = e.target.dataset.goalId;
      const result = goalManager.completeGoal(goalId);
      if (result.success) {
        showToast(`+${result.expGained} XP 획득!`);
        renderGoals();
      }
    });
  });

  // 보관
  document.querySelectorAll('.archive-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const goalId = e.target.dataset.goalId;
      goalManager.archiveGoal(goalId);
      renderGoals();
    });
  });

  // 삭제
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const goalId = e.target.dataset.goalId;
      if (confirm('정말 삭제하시겠습니까?')) {
        goalManager.deleteGoal(goalId);
        renderGoals();
      }
    });
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
