// The Hunter System - 상점 화면 (코스튬 기반 직업 전직)
import { stateManager } from '../../core/stateManager.js';
import { GAME_CONSTANTS } from '../../config/constants.js';
import { COSTUMES, getCostumeById, canEquipCostume, getCostumeStatBonus } from '../../config/costumes.js';

export function renderShop() {
  const app = document.getElementById('app');
  const hunter = stateManager.get('hunter');
  const daily = stateManager.get('daily');
  const ownedCostumes = stateManager.get('costumes') || [];
  const equippedCostume = stateManager.get('equippedCostume');

  if (!hunter) {
    window.location.hash = 'awakening';
    return;
  }

  const equippedData = equippedCostume ? getCostumeById(equippedCostume) : null;
  const costumeBonus = equippedData ? getCostumeStatBonus(equippedCostume) : null;
  const currentJobName = stateManager.getCurrentJobName();

  app.innerHTML = `
    <div class="shop-screen">
      <div class="screen-header">
        <h1>상점</h1>
        <div class="gold-display">
          <span class="gold-icon">&#128176;</span>
          <span class="gold-amount">${hunter.gold.toLocaleString()} G</span>
        </div>
      </div>

      <!-- 현재 장착 코스튬 / 직업 -->
      <div class="card equipped-costume-card">
        <div class="card-header">
          <h3>현재 직업</h3>
          <span class="job-name-badge">${currentJobName}</span>
        </div>
        <div class="equipped-info">
          ${equippedData ? `
            <div class="equipped-display">
              <div class="equipped-icon">&#128085;</div>
              <div class="equipped-details">
                <span class="equipped-job">${equippedData.jobTitle}</span>
                <span class="equipped-name">${equippedData.name}</span>
              </div>
            </div>
            <div class="equipped-bonuses">
              ${costumeBonus.expMult > 1 ? `<span class="bonus-tag exp">EXP x${costumeBonus.expMult}</span>` : ''}
              ${costumeBonus.goldMult > 1 ? `<span class="bonus-tag gold">Gold x${costumeBonus.goldMult}</span>` : ''}
            </div>
            <button class="btn-unequip" id="unequipBtn">해제</button>
          ` : `
            <p class="no-costume">장착된 코스튬이 없습니다</p>
            <p class="hint">코스튬을 장착하여 직업을 변경하세요!</p>
          `}
        </div>
        ${equippedData && costumeBonus ? `
          <div class="equipped-stat-bonuses">
            ${costumeBonus.strFlat > 0 ? `<span class="stat-bonus">+${costumeBonus.strFlat} STR</span>` : ''}
            ${costumeBonus.intFlat > 0 ? `<span class="stat-bonus">+${costumeBonus.intFlat} INT</span>` : ''}
            ${costumeBonus.wilFlat > 0 ? `<span class="stat-bonus">+${costumeBonus.wilFlat} WIL</span>` : ''}
            ${costumeBonus.focusFlat > 0 ? `<span class="stat-bonus">+${costumeBonus.focusFlat} FOCUS</span>` : ''}
            ${costumeBonus.lukFlat > 0 ? `<span class="stat-bonus">+${costumeBonus.lukFlat} LUK</span>` : ''}
          </div>
        ` : ''}
      </div>

      <!-- 광고 보상 (외부 에너지 계약) -->
      <div class="card energy-contract-card">
        <div class="card-header">
          <h3>외부 에너지 계약</h3>
          <span class="contract-icon">&#9889;</span>
        </div>
        <p class="contract-desc">광고 시청을 통해 특별한 보상을 획득하세요</p>

        <div class="contract-list">
          <!-- 자동전투 부스트 -->
          <div class="contract-item ${daily.adWatched.autoBattle ? 'used' : ''}">
            <div class="contract-info">
              <span class="contract-name">자동전투 부스트</span>
              <span class="contract-effect">30분간 골드 수급 x2</span>
            </div>
            ${!daily.adWatched.autoBattle ? `
              <button class="btn-watch-ad" data-type="autoBattle">시청</button>
            ` : '<span class="used-badge">사용완료</span>'}
          </div>

          <!-- 스태미나 회복 -->
          <div class="contract-item ${daily.adWatched.stamina >= 3 ? 'used' : ''}">
            <div class="contract-info">
              <span class="contract-name">스태미나 회복</span>
              <span class="contract-effect">+20 스태미나 (${daily.adWatched.stamina}/3)</span>
            </div>
            ${daily.adWatched.stamina < 3 ? `
              <button class="btn-watch-ad" data-type="stamina">시청</button>
            ` : '<span class="used-badge">한도 도달</span>'}
          </div>
        </div>
      </div>

      <!-- 코스튬 상점 -->
      <div class="costume-section">
        <h3>코스튬 컬렉션</h3>
        <div class="costume-tabs">
          <button class="costume-tab active" data-rarity="all">전체</button>
          <button class="costume-tab" data-rarity="NORMAL">일반</button>
          <button class="costume-tab" data-rarity="RARE">레어</button>
          <button class="costume-tab" data-rarity="EPIC">에픽</button>
          <button class="costume-tab" data-rarity="LEGENDARY">전설</button>
        </div>

        <div class="costume-grid" id="costumeGrid">
          ${renderCostumeGrid(COSTUMES, ownedCostumes, hunter, equippedCostume)}
        </div>
      </div>
    </div>
  `;

  setupShopEvents(ownedCostumes, hunter, equippedCostume);
}

function renderCostumeGrid(costumes, owned, hunter, equippedCostume, filter = 'all') {
  const filtered = filter === 'all' ? costumes : costumes.filter(c => c.rarity === filter);

  return filtered.map(costume => {
    const isOwned = owned.includes(costume.id);
    const isEquipped = equippedCostume === costume.id;
    const rarity = GAME_CONSTANTS.COSTUME_RARITY[costume.rarity] || { color: '#f59e0b', name: '전설' };
    const canBuy = costume.price && hunter.gold >= costume.price && !isOwned;
    const equipCheck = canEquipCostume(costume.id, hunter.stats);
    const bonus = costume.statBonus || {};

    // 플랫 보너스 태그 생성
    const flatBonusTags = [];
    if (bonus.strFlat) flatBonusTags.push(`+${bonus.strFlat} STR`);
    if (bonus.intFlat) flatBonusTags.push(`+${bonus.intFlat} INT`);
    if (bonus.wilFlat) flatBonusTags.push(`+${bonus.wilFlat} WIL`);
    if (bonus.focusFlat) flatBonusTags.push(`+${bonus.focusFlat} FOCUS`);
    if (bonus.lukFlat) flatBonusTags.push(`+${bonus.lukFlat} LUK`);

    return `
      <div class="costume-card ${isOwned ? 'owned' : ''} ${isEquipped ? 'equipped' : ''}" data-costume-id="${costume.id}">
        <div class="costume-header" style="border-color: ${rarity.color}">
          <span class="costume-rarity" style="color: ${rarity.color}">${rarity.name}</span>
          ${isEquipped ? '<span class="equipped-badge">장착중</span>' : ''}
        </div>
        <div class="costume-icon">&#128085;</div>
        <h4 class="costume-name">${costume.name}</h4>
        <p class="costume-job-title">"${costume.jobTitle}"</p>
        <p class="costume-desc">${costume.description}</p>

        <div class="costume-stats">
          <!-- 배율 보너스 -->
          <div class="costume-mult-bonus">
            ${bonus.expMult > 1 ? `<span class="mult-tag exp">EXP x${bonus.expMult}</span>` : ''}
            ${bonus.goldMult > 1 ? `<span class="mult-tag gold">Gold x${bonus.goldMult}</span>` : ''}
          </div>
          <!-- 플랫 보너스 -->
          <div class="costume-flat-bonus">
            ${flatBonusTags.map(tag => `<span class="bonus-stat">${tag}</span>`).join('')}
          </div>
        </div>

        ${costume.requiredStats ? `
          <div class="costume-requirements ${equipCheck.canEquip ? 'met' : 'unmet'}">
            <span class="req-label">장착 조건:</span>
            ${Object.entries(costume.requiredStats).map(([stat, val]) => {
              const current = hunter.stats[stat] || 0;
              const hasStat = current >= val;
              return `<span class="req-stat ${hasStat ? 'met' : 'unmet'}">${stat} ${current}/${val}</span>`;
            }).join('')}
          </div>
        ` : '<div class="costume-requirements met"><span class="req-label">장착 조건: 없음</span></div>'}

        <div class="costume-action">
          ${isEquipped ? '<span class="equipped-label">장착중</span>' :
            isOwned ? (equipCheck.canEquip ?
              `<button class="btn-equip-costume" data-id="${costume.id}">장착하기</button>` :
              `<span class="cannot-equip">${equipCheck.reason}</span>`) :
            costume.adRequired ? '<button class="btn-ad-costume">광고 시청</button>' :
            costume.eventOnly ? '<span class="event-badge">이벤트 전용</span>' :
            costume.achievementOnly ? '<span class="event-badge">업적 보상</span>' :
            canBuy ? `<button class="btn-buy-costume" data-id="${costume.id}">${costume.price} G</button>` :
            `<span class="price-tag">${costume.price} G</span>`
          }
        </div>
      </div>
    `;
  }).join('');
}

function setupShopEvents(ownedCostumes, hunter, equippedCostume) {
  // 장착 해제
  const unequipBtn = document.getElementById('unequipBtn');
  if (unequipBtn) {
    unequipBtn.addEventListener('click', () => {
      stateManager.set('equippedCostume', null);
      // 직업 명칭 초기화
      const hunterData = stateManager.get('hunter');
      hunterData.title = '각성한 자';
      stateManager.set('hunter', hunterData);
      window.showNotification('코스튬을 해제했습니다', 'info');
      renderShop();
    });
  }

  // 광고 시청 버튼
  document.querySelectorAll('.btn-watch-ad').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;

      if (confirm('광고를 시청하시겠습니까?\n(데모에서는 바로 보상을 받습니다)')) {
        if (type === 'autoBattle') {
          stateManager.activateAutoBattleBoost();
          window.showNotification('자동전투 부스트 30분 활성화!', 'success');
        } else if (type === 'stamina') {
          const success = stateManager.recoverStaminaByAd();
          if (success) {
            window.showNotification('스태미나 +20 회복!', 'success');
          }
        }
        renderShop();
      }
    });
  });

  // 탭 전환
  document.querySelectorAll('.costume-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.costume-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const rarity = tab.dataset.rarity;
      const currentHunter = stateManager.get('hunter');
      const currentOwned = stateManager.get('costumes') || [];
      const currentEquipped = stateManager.get('equippedCostume');

      document.getElementById('costumeGrid').innerHTML =
        renderCostumeGrid(COSTUMES, currentOwned, currentHunter, currentEquipped, rarity);

      setupCostumeButtons();
    });
  });

  setupCostumeButtons();
}

function setupCostumeButtons() {
  // 코스튬 구매
  document.querySelectorAll('.btn-buy-costume').forEach(btn => {
    btn.addEventListener('click', () => {
      const costumeId = btn.dataset.id;
      const costume = getCostumeById(costumeId);
      const hunter = stateManager.get('hunter');

      if (costume && hunter.gold >= costume.price) {
        hunter.gold -= costume.price;
        stateManager.set('hunter', hunter);

        const costumes = stateManager.get('costumes') || [];
        costumes.push(costumeId);
        stateManager.set('costumes', costumes);

        window.showNotification(`${costume.name} 구매 완료!`, 'success');
        renderShop();
      }
    });
  });

  // 코스튬 장착
  document.querySelectorAll('.btn-equip-costume').forEach(btn => {
    btn.addEventListener('click', () => {
      const costumeId = btn.dataset.id;
      const costume = getCostumeById(costumeId);
      const hunter = stateManager.get('hunter');

      const equipCheck = canEquipCostume(costumeId, hunter.stats);
      if (!equipCheck.canEquip) {
        window.showNotification(equipCheck.reason, 'error');
        return;
      }

      // 코스튬 장착
      stateManager.set('equippedCostume', costumeId);

      // 직업 명칭 변경
      hunter.title = costume.jobTitle;
      stateManager.set('hunter', hunter);

      window.showNotification(`"${costume.jobTitle}"(으)로 전직했습니다!`, 'success');
      renderShop();
    });
  });

  // 광고 코스튬
  document.querySelectorAll('.btn-ad-costume').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('광고를 시청하여 코스튬을 획득하시겠습니까?')) {
        const card = btn.closest('.costume-card');
        const costumeId = card.dataset.costumeId;
        const costume = getCostumeById(costumeId);

        if (costume) {
          const costumes = stateManager.get('costumes') || [];
          costumes.push(costumeId);
          stateManager.set('costumes', costumes);

          window.showNotification(`${costume.name} 획득!`, 'success');
          renderShop();
        }
      }
    });
  });
}
