// The Hunter System - 헌터 화면 (v6.7.2 Mobile RPG HUD Style)
// 헌터 자격증 카드 중심 UI, 카이로소프트 스타일 애니메이션
import { stateManager } from '../../core/stateManager.js';
import { getRequiredExp, calculateCombatStats, getQuestWaitTime, calculateRefineCost } from '../../config/constants.js';

// 연마 홀드 상태 관리 (메모리 누수 방지)
let refineState = {
  activeInterval: null,
  activeRaf: null,
  sparkles: [],
  maxSparkles: 8,
  isRefining: false // 중복 실행 방지 플래그
};

// S랭크 홀로그램 상태
let hologramState = {
  rafId: null,
  isTracking: false
};

// 안전한 게이지 계산 (NaN 및 범위 초과 방지)
function clamp(value, min, max) {
  if (isNaN(value) || !isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function safeProgress(current, max) {
  const safeMax = Math.max(max, 1);
  return clamp(current / safeMax, 0, 1);
}

// 클린업 함수
function cleanupRefineState() {
  if (refineState.activeInterval) {
    clearInterval(refineState.activeInterval);
    refineState.activeInterval = null;
  }
  if (refineState.activeRaf) {
    cancelAnimationFrame(refineState.activeRaf);
    refineState.activeRaf = null;
  }
  refineState.isRefining = false;
}

// 홀로그램 클린업
function cleanupHologram() {
  if (hologramState.rafId) {
    cancelAnimationFrame(hologramState.rafId);
    hologramState.rafId = null;
  }
  hologramState.isTracking = false;
}

// 동적 CTA 버튼 라벨 결정
function getCTAConfig() {
  const quests = stateManager.getActiveQuests();
  const hunter = stateManager.get('hunter');

  if (!quests || quests.length === 0) {
    return {
      label: '새 목표 추가',
      icon: '➕',
      action: 'add-quest',
      ariaLabel: '새로운 퀘스트 목표 추가하기'
    };
  }

  // 진행 중인 퀘스트가 있으면 상태 확인
  const inProgressQuest = quests.find(q => q.status === 'in_progress');
  if (inProgressQuest) {
    const canComplete = new Date(inProgressQuest.completeAvailableAt) <= new Date();
    if (canComplete) {
      return {
        label: '퀘스트 완료',
        icon: '✅',
        action: 'complete-quest',
        ariaLabel: '현재 퀘스트 완료하기'
      };
    }
  }

  // 골드가 충분하면 연마 권장
  const minRefineCost = Math.min(...Object.values(hunter.stats).map(v => calculateRefineCost(v)));
  if (hunter.gold >= minRefineCost) {
    return {
      label: '연마 시작',
      icon: '⚒️',
      action: 'refine',
      ariaLabel: '능력 연마 시작하기'
    };
  }

  // 기본: 게이트 진입
  return {
    label: '게이트 진입',
    icon: '🚪',
    action: 'gate',
    ariaLabel: '게이트 던전 진입하기'
  };
}

// Sparkle 이펙트 생성 (6~10개 제한, 300ms 자동 제거)
function createSparkle(container, x, y) {
  if (refineState.sparkles.length >= refineState.maxSparkles) return;

  const sparkle = document.createElement('div');
  sparkle.className = 'refine-sparkle';
  sparkle.style.left = `${x}px`;
  sparkle.style.top = `${y}px`;
  container.appendChild(sparkle);

  refineState.sparkles.push(sparkle);

  setTimeout(() => {
    sparkle.remove();
    const idx = refineState.sparkles.indexOf(sparkle);
    if (idx > -1) refineState.sparkles.splice(idx, 1);
  }, 300);
}

// 스탯 레벨업 피드백 (shake + pop)
function triggerStatUpFeedback(statRow, statName, newValue) {
  statRow.classList.add('stat-level-up');

  const valueBadge = statRow.querySelector('.stat-level-badge');
  if (valueBadge) {
    valueBadge.classList.add('pop');
    valueBadge.textContent = `Lv.${newValue}`;
  }

  // statUp 이벤트 발생
  stateManager.notify('statUp', { stat: statName, newValue });

  setTimeout(() => {
    statRow.classList.remove('stat-level-up');
    if (valueBadge) valueBadge.classList.remove('pop');
  }, 500);
}

export function renderHunter() {
  const app = document.getElementById('app');
  const hunter = stateManager.get('hunter');

  if (!hunter) {
    window.location.hash = 'awakening';
    return;
  }

  // 페이지 이동 시 클린업
  cleanupRefineState();
  cleanupHologram();

  const expRequired = getRequiredExp(hunter.level);
  const expPercent = clamp((hunter.exp / Math.max(expRequired, 1)) * 100, 0, 100);
  const combatStats = calculateCombatStats(hunter.stats);
  const waitTime = getQuestWaitTime(hunter.stats.FOCUS);
  const rankClass = `rank-${hunter.rank.toLowerCase()}`;
  const isHighRank = hunter.rank === 'A' || hunter.rank === 'S';
  const isSRank = hunter.rank === 'S';

  // 동적 CTA 버튼 설정
  const ctaConfig = getCTAConfig();

  const statMeta = {
    STR: { icon: '💪', label: '근력', desc: '물리 데미지' },
    INT: { icon: '📚', label: '지능', desc: '스킬 데미지' },
    WIL: { icon: '🛡️', label: '의지', desc: '방어력' },
    FOCUS: { icon: '🎯', label: '집중', desc: '크리티컬' },
    LUK: { icon: '🍀', label: '행운', desc: '드롭률' }
  };

  app.innerHTML = `
    <div class="hunter-screen">
      <!-- 헌터 자격증 카드 (RPG HUD Style) -->
      <div class="hunter-id-card ${rankClass} ${isHighRank ? 'high-rank' : ''} ${isSRank ? 's-rank-holo' : ''}"
           data-rank="${hunter.rank}"
           role="region"
           aria-label="헌터 자격증 카드">
        ${isHighRank ? '<div class="aurora-overlay"></div>' : ''}
        ${isSRank ? '<div class="hologram-layer" aria-hidden="true"></div>' : ''}
        <div class="id-card-inner">
          <!-- 좌측: 아바타 -->
          <div class="id-card-avatar">
            <div class="avatar-frame ${rankClass}" role="img" aria-label="${hunter.rank}랭크 헌터 아바타">
              <div class="avatar-icon">${hunter.gender === 'female' ? '👩' : '👨'}</div>
            </div>
            <div class="rank-emblem ${rankClass}" aria-label="랭크 ${hunter.rank}">
              <span class="rank-letter">${hunter.rank}</span>
            </div>
          </div>

          <!-- 우측: 정보 + 스탯 -->
          <div class="id-card-info">
            <div class="id-card-header">
              <h2 class="hunter-name">${hunter.name}</h2>
              <span class="hunter-title-badge">${hunter.title}</span>
            </div>

            <div class="id-card-level" aria-label="레벨 ${hunter.level}, 경험치 ${Math.round(expPercent)}%">
              <span class="level-label">Lv.</span>
              <span class="level-value">${hunter.level}</span>
              <div class="exp-mini-bar" role="progressbar" aria-valuenow="${Math.round(expPercent)}" aria-valuemin="0" aria-valuemax="100">
                <div class="exp-mini-fill" style="width: ${expPercent}%"></div>
              </div>
            </div>

            <div class="id-card-stats" role="list" aria-label="기본 스탯">
              ${Object.entries(hunter.stats).map(([stat, value]) => {
                const meta = statMeta[stat];
                return `
                <div class="mini-stat" role="listitem" aria-label="${meta.label} ${value}">
                  <span class="mini-stat-icon" aria-hidden="true">${meta.icon}</span>
                  <span class="mini-stat-value">${value}</span>
                </div>
              `}).join('')}
            </div>

            <div class="id-card-resources" aria-label="보유 자원">
              <span class="resource gold" aria-label="골드 ${hunter.gold.toLocaleString()}">💰 ${hunter.gold.toLocaleString()}</span>
              <span class="resource essence" aria-label="에센스 ${(hunter.essence || 0).toLocaleString()}">✨ ${(hunter.essence || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 동적 대표 액션 버튼 -->
      <button class="main-cta-btn" data-action="${ctaConfig.action}" aria-label="${ctaConfig.ariaLabel}">
        <span class="cta-icon" aria-hidden="true">${ctaConfig.icon}</span>
        <span class="cta-label">${ctaConfig.label}</span>
      </button>

      <!-- 연마 패널 (Hold to Refine) -->
      <div class="card refine-panel" role="region" aria-label="능력 연마 패널">
        <div class="card-header">
          <h3>⚒️ 능력 연마</h3>
          <span class="refine-hint">꾹 눌러서 연마</span>
        </div>
        <div class="refine-stats-list" role="list">
          ${Object.entries(hunter.stats).map(([stat, value]) => {
            const meta = statMeta[stat];
            const progress = stateManager.getRefineProgress(stat);
            const progressPercent = safeProgress(progress.current, progress.required) * 100;
            const cost = calculateRefineCost(value);

            return `
            <div class="refine-stat-row" data-stat="${stat}" role="listitem">
              <div class="refine-stat-info">
                <span class="refine-stat-icon" aria-hidden="true">${meta.icon}</span>
                <div class="refine-stat-details">
                  <span class="refine-stat-name">${meta.label} <span class="stat-level-badge">Lv.${value}</span></span>
                  <span class="refine-stat-desc">${meta.desc}</span>
                </div>
              </div>
              <div class="refine-gauge-section">
                <div class="refine-gauge" role="progressbar" aria-valuenow="${Math.round(progressPercent)}" aria-valuemin="0" aria-valuemax="100" aria-label="${meta.label} 연마 진행도">
                  <div class="refine-gauge-fill" style="width: ${progressPercent}%"></div>
                  <div class="refine-gauge-glow" aria-hidden="true"></div>
                </div>
                <div class="refine-cost" aria-label="연마 비용 ${cost} 골드">💰 ${cost}/tick</div>
              </div>
              <button class="refine-btn" data-stat="${stat}" aria-label="${meta.label} 연마하기, 꾹 눌러서 연속 연마">
                <span class="refine-btn-icon" aria-hidden="true">⚒️</span>
              </button>
            </div>
          `}).join('')}
        </div>
      </div>

      <!-- FOCUS 효과 -->
      <div class="card focus-card compact">
        <h3>🎯 FOCUS 효과</h3>
        <div class="focus-effects">
          <div class="focus-effect">
            <span class="effect-label">퀘스트 대기</span>
            <span class="effect-value">${waitTime}분</span>
          </div>
          <div class="focus-effect">
            <span class="effect-label">크리티컬률</span>
            <span class="effect-value">${combatStats.critRate.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <!-- 전투 스탯 -->
      <div class="card combat-panel compact">
        <h3>⚔️ 전투 능력치</h3>
        <div class="combat-stats-grid compact">
          <div class="combat-stat"><span class="cs-icon">❤️</span><span class="cs-val">${combatStats.maxHp}</span><span class="cs-label">HP</span></div>
          <div class="combat-stat"><span class="cs-icon">⚔️</span><span class="cs-val">${combatStats.attack}</span><span class="cs-label">ATK</span></div>
          <div class="combat-stat"><span class="cs-icon">✨</span><span class="cs-val">${combatStats.skillDamage}</span><span class="cs-label">SKL</span></div>
          <div class="combat-stat"><span class="cs-icon">🛡️</span><span class="cs-val">${combatStats.defense}</span><span class="cs-label">DEF</span></div>
          <div class="combat-stat"><span class="cs-icon">💥</span><span class="cs-val">${combatStats.critDamage}%</span><span class="cs-label">CRIT</span></div>
          <div class="combat-stat"><span class="cs-icon">🍀</span><span class="cs-val">+${combatStats.dropRate.toFixed(1)}%</span><span class="cs-label">DROP</span></div>
        </div>
      </div>

      <!-- 통계 -->
      <div class="card statistics-panel compact">
        <h3>📊 통계</h3>
        <div class="statistics-list">
          <div class="stat-item"><span>총 퀘스트</span><span>${stateManager.get('statistics').totalQuestsCompleted}</span></div>
          <div class="stat-item"><span>최장 연속</span><span>${stateManager.get('statistics').longestStreak}일</span></div>
          <div class="stat-item"><span>현재 연속</span><span>${stateManager.get('statistics').currentStreak}일</span></div>
        </div>
      </div>
    </div>
  `;

  // 이벤트 바인딩
  bindRefineEvents();
  bindCTAEvents();
  if (isSRank) bindHologramEffect();
}

// 연마 홀드 이벤트 바인딩 (중복 실행 방지 강화)
function bindRefineEvents() {
  const refineBtns = document.querySelectorAll('.refine-btn');

  refineBtns.forEach(btn => {
    const stat = btn.dataset.stat;
    let isPointerDown = false; // 버튼별 상태 추적

    const startRefine = (e) => {
      e.preventDefault();

      // 중복 실행 방지
      if (refineState.isRefining || isPointerDown) return;
      isPointerDown = true;
      refineState.isRefining = true;

      // 기존 interval/raf 클린업 (무결성 보장)
      cleanupRefineState();
      refineState.isRefining = true; // 클린업 후 다시 설정

      const row = btn.closest('.refine-stat-row');
      btn.classList.add('refining');
      btn.setAttribute('aria-pressed', 'true');

      // 홀드 시 반복 연마
      const refineOnce = () => {
        const hunter = stateManager.get('hunter');
        const cost = calculateRefineCost(hunter.stats[stat]);

        if (hunter.gold >= cost) {
          const result = stateManager.upgradeStatWithGold(stat, cost);

          if (result.success) {
            // 게이지 업데이트
            const gauge = row.querySelector('.refine-gauge-fill');
            const gaugeContainer = row.querySelector('.refine-gauge');
            const progressPercent = safeProgress(
              stateManager.getRefineProgress(stat).current,
              stateManager.getRefineProgress(stat).required
            ) * 100;
            gauge.style.width = `${progressPercent}%`;
            if (gaugeContainer) {
              gaugeContainer.setAttribute('aria-valuenow', Math.round(progressPercent));
            }

            // Sparkle 이펙트
            const container = row.querySelector('.refine-gauge-section');
            createSparkle(container, Math.random() * 60, Math.random() * 20);

            // 레벨업 시 피드백
            if (result.levelUp) {
              triggerStatUpFeedback(row, stat, result.newStatValue);

              // 레벨 배지 업데이트
              const badge = row.querySelector('.stat-level-badge');
              if (badge) badge.textContent = `Lv.${result.newStatValue}`;

              // 비용 업데이트
              const costEl = row.querySelector('.refine-cost');
              if (costEl) costEl.textContent = `💰 ${calculateRefineCost(result.newStatValue)}/tick`;

              // ID 카드의 미니 스탯도 업데이트
              updateMiniStats();
            }
          }
        }
      };

      // 즉시 1회 실행 후 반복
      refineOnce();
      refineState.activeInterval = setInterval(refineOnce, 150);
    };

    const stopRefine = () => {
      if (!isPointerDown) return;
      isPointerDown = false;
      cleanupRefineState();
      btn.classList.remove('refining');
      btn.setAttribute('aria-pressed', 'false');
    };

    // 포인터 이벤트 (터치 + 마우스 모두 지원)
    btn.addEventListener('pointerdown', startRefine);
    btn.addEventListener('pointerup', stopRefine);
    btn.addEventListener('pointercancel', stopRefine);
    btn.addEventListener('pointerleave', stopRefine);

    // 키보드 접근성 (Space/Enter로 토글)
    btn.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!refineState.isRefining) {
          startRefine(e);
        }
      }
    });
    btn.addEventListener('keyup', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        stopRefine();
      }
    });
  });
}

// 미니 스탯 업데이트 (ID 카드 내)
function updateMiniStats() {
  const hunter = stateManager.get('hunter');
  const miniStats = document.querySelectorAll('.id-card-stats .mini-stat-value');
  const statKeys = Object.keys(hunter.stats);

  miniStats.forEach((el, idx) => {
    if (statKeys[idx]) {
      el.textContent = hunter.stats[statKeys[idx]];
    }
  });

  // 자원도 업데이트
  const goldEl = document.querySelector('.id-card-resources .resource.gold');
  const essenceEl = document.querySelector('.id-card-resources .resource.essence');
  if (goldEl) goldEl.textContent = `💰 ${hunter.gold.toLocaleString()}`;
  if (essenceEl) essenceEl.textContent = `✨ ${(hunter.essence || 0).toLocaleString()}`;
}

// CTA 버튼 이벤트 바인딩
function bindCTAEvents() {
  const ctaBtn = document.querySelector('.main-cta-btn');
  if (!ctaBtn) return;

  ctaBtn.addEventListener('click', () => {
    const action = ctaBtn.dataset.action;

    switch (action) {
      case 'add-quest':
        window.location.hash = 'quests';
        break;
      case 'complete-quest':
        window.location.hash = 'quests';
        break;
      case 'refine':
        // 첫 번째 연마 버튼으로 포커스
        const firstRefineBtn = document.querySelector('.refine-btn');
        if (firstRefineBtn) {
          firstRefineBtn.focus();
          firstRefineBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        break;
      case 'gate':
        window.location.hash = 'gates';
        break;
    }
  });
}

// S랭크 홀로그램 효과 (마우스 각도 추적)
function bindHologramEffect() {
  const card = document.querySelector('.hunter-id-card.s-rank-holo');
  if (!card) return;

  // hover 지원 미디어 쿼리 체크
  const supportsHover = window.matchMedia('(hover: hover)').matches;
  if (!supportsHover) return;

  // reduced motion 체크
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  const holoLayer = card.querySelector('.hologram-layer');
  if (!holoLayer) return;

  const handleMouseMove = (e) => {
    if (hologramState.isTracking) return;
    hologramState.isTracking = true;

    hologramState.rafId = requestAnimationFrame(() => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // 카드 중심 기준 상대 위치 (-1 ~ 1)
      const relX = (x / rect.width - 0.5) * 2;
      const relY = (y / rect.height - 0.5) * 2;

      // 광택 위치 계산
      const shineX = 50 + relX * 30;
      const shineY = 50 + relY * 30;

      holoLayer.style.background = `
        radial-gradient(
          circle at ${shineX}% ${shineY}%,
          rgba(255, 255, 255, 0.25) 0%,
          rgba(239, 68, 68, 0.15) 25%,
          rgba(168, 85, 247, 0.1) 50%,
          transparent 70%
        )
      `;

      // 미세한 3D 틸트 효과
      const tiltX = relY * 3;
      const tiltY = -relX * 3;
      card.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;

      hologramState.isTracking = false;
    });
  };

  const handleMouseLeave = () => {
    cleanupHologram();
    holoLayer.style.background = '';
    card.style.transform = '';
  };

  card.addEventListener('mousemove', handleMouseMove);
  card.addEventListener('mouseleave', handleMouseLeave);
}
