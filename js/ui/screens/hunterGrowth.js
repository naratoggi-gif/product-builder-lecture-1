// The Hunter System - 헌터 성장 화면 (Hunter Growth)
// v5.0 Dual Economy: Essence is used for Hunter Growth (Costumes/Skills)
import { stateManager } from '../../core/stateManager.js';
import { COSTUMES, canEquipCostume } from '../../config/costumes.js';

export function renderHunterGrowth() {
  const app = document.getElementById('app');
  const hunter = stateManager.get('hunter');
  const ownedCostumes = stateManager.get('costumes') || [];
  const equippedCostumeId = stateManager.get('equippedCostume');

  if (!hunter) {
    window.location.hash = 'awakening';
    return;
  }

  // v5.0: Use Essence for Hunter Growth
  const essence = hunter.essence || 0;

  app.innerHTML = `
    <div class="hunter-growth-screen">
      <div class="screen-header">
        <h1>헌터 성장 (Essence)</h1>
        <p class="screen-subtitle">에센스를 사용하여 코스튬과 스킬을 획득하세요</p>
      </div>

      <!-- 에센스 보유량 -->
      <div class="card essence-display-card">
        <div class="essence-display">
          <span class="essence-icon">&#10024;</span>
          <span class="essence-amount">${essence.toLocaleString()}</span>
          <span class="essence-label">보유 에센스</span>
        </div>
        <p class="essence-hint">퀘스트 완료로 에센스를 획득합니다 (Proof of Effort)</p>
      </div>

      <!-- 탭 네비게이션 (확장 가능성) -->
      <div class="growth-tabs">
        <button class="growth-tab active">코스튬 (전직)</button>
        <!-- <button class="growth-tab" disabled>엘리트 스킬 (Coming Soon)</button> -->
      </div>

      <!-- 코스튬 리스트 -->
      <div class="costume-list">
        ${COSTUMES.map(costume => {
          const isOwned = ownedCostumes.includes(costume.id) || costume.id === 'hunter_basic';
          const isEquipped = equippedCostumeId === costume.id || (!equippedCostumeId && costume.id === 'hunter_basic');
          const canAfford = essence >= costume.essencePrice;
          const equipCheck = canEquipCostume(costume.id, hunter.stats);
          
          let actionBtn = '';
          if (isEquipped) {
            actionBtn = `<button class="btn-action equipped" disabled>장착 중</button>`;
          } else if (isOwned) {
            if (equipCheck.canEquip) {
              actionBtn = `<button class="btn-action equip" data-id="${costume.id}">장착하기</button>`;
            } else {
              actionBtn = `<button class="btn-action locked" disabled>조건 미달</button>`;
            }
          } else {
            actionBtn = `<button class="btn-action purchase" data-id="${costume.id}" ${!canAfford ? 'disabled' : ''}>
              구매 (${costume.essencePrice} 에센스)
            </button>`;
          }

          // 스탯 보너스 텍스트 생성
          const bonuses = [];
          if (costume.statBonus) {
            if (costume.statBonus.expMult > 1) bonuses.push(`EXP +${Math.round((costume.statBonus.expMult - 1) * 100)}%`);
            if (costume.statBonus.goldMult > 1) bonuses.push(`Gold +${Math.round((costume.statBonus.goldMult - 1) * 100)}%`);
            if (costume.statBonus.strFlat) bonuses.push(`힘 +${costume.statBonus.strFlat}`);
            if (costume.statBonus.intFlat) bonuses.push(`지능 +${costume.statBonus.intFlat}`);
            if (costume.statBonus.wilFlat) bonuses.push(`의지 +${costume.statBonus.wilFlat}`);
            if (costume.statBonus.focusFlat) bonuses.push(`집중 +${costume.statBonus.focusFlat}`);
            if (costume.statBonus.lukFlat) bonuses.push(`운 +${costume.statBonus.lukFlat}`);
          }
          const bonusText = bonuses.join(', ');

          // 요구 조건 텍스트
          let reqText = '요구 조건 없음';
          if (costume.requiredStats) {
             reqText = Object.entries(costume.requiredStats)
               .map(([k, v]) => `${k} ${v}`)
               .join(', ');
          }
          if (!equipCheck.canEquip && isOwned) {
            reqText = `<span class="text-danger">${equipCheck.reason}</span>`;
          }

          return `
            <div class="card costume-card ${isEquipped ? 'active-card' : ''}">
              <div class="costume-header">
                <div class="costume-info">
                  <span class="costume-name">${costume.name}</span>
                  <span class="costume-job">${costume.jobTitle}</span>
                </div>
                <div class="costume-rarity ${costume.rarity.toLowerCase()}">${costume.rarity}</div>
              </div>
              
              <div class="costume-desc">${costume.description}</div>
              
              <div class="costume-stats">
                <div class="stat-row">
                  <span class="label">효과:</span>
                  <span class="value">${bonusText || '없음'}</span>
                </div>
                <div class="stat-row">
                  <span class="label">조건:</span>
                  <span class="value">${reqText}</span>
                </div>
              </div>

              <div class="costume-actions">
                ${actionBtn}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // 이벤트 리스너 바인딩
  app.querySelectorAll('.btn-action.purchase').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      const result = stateManager.purchaseCostume(id);
      if (result.success) {
        window.showNotification('코스튬 구매 완료!', 'success');
        renderHunterGrowth();
      } else {
        window.showNotification(result.error, 'error');
      }
    });
  });

  app.querySelectorAll('.btn-action.equip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      const result = stateManager.equipCostume(id);
      if (result.success) {
        window.showNotification('코스튬 장착 완료!', 'success');
        renderHunterGrowth();
      } else {
        window.showNotification(result.error, 'error');
      }
    });
  });
}
