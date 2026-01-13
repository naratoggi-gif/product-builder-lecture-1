// The Hunter System - 상점 화면 (코스튬, 광고 보상)
import { stateManager } from '../../core/stateManager.js';
import { GAME_CONSTANTS } from '../../config/constants.js';

// 코스튬 데이터 (오마주 기반)
const COSTUMES = [
  // Normal (골드 구매)
  {
    id: 'hunter_basic',
    name: '기본 헌터복',
    rarity: 'NORMAL',
    price: 500,
    statBonus: { STR: 1 },
    description: '초보 헌터의 기본 장비'
  },
  {
    id: 'shadow_cloak',
    name: '그림자 망토',
    rarity: 'NORMAL',
    price: 1000,
    statBonus: { FOCUS: 2 },
    description: '어둠 속에서 집중력을 높여준다'
  },
  {
    id: 'warrior_armor',
    name: '전사의 갑옷',
    rarity: 'NORMAL',
    price: 1500,
    statBonus: { STR: 2, WIL: 1 },
    description: '전장의 베테랑이 입던 갑옷'
  },
  // Rare (광고 시청)
  {
    id: 'mage_robe',
    name: '마법사의 로브',
    rarity: 'RARE',
    adRequired: true,
    statBonus: { INT: 3 },
    description: '마나의 흐름을 강화하는 로브'
  },
  {
    id: 'lucky_charm',
    name: '행운의 부적',
    rarity: 'RARE',
    adRequired: true,
    statBonus: { LUK: 4 },
    description: '신비로운 행운을 불러온다'
  },
  // Epic (이벤트)
  {
    id: 'dragon_scale',
    name: '용린 갑주',
    rarity: 'EPIC',
    eventOnly: true,
    statBonus: { STR: 3, WIL: 3 },
    description: '전설의 용에게서 얻은 비늘로 만든 갑옷'
  }
];

export function renderShop() {
  const app = document.getElementById('app');
  const hunter = stateManager.get('hunter');
  const daily = stateManager.get('daily');
  const ownedCostumes = stateManager.get('costumes') || [];

  if (!hunter) {
    window.location.hash = 'awakening';
    return;
  }

  app.innerHTML = `
    <div class="shop-screen">
      <div class="screen-header">
        <h1>상점</h1>
        <div class="gold-display">
          <span class="gold-icon">&#128176;</span>
          <span class="gold-amount">${hunter.gold.toLocaleString()} G</span>
        </div>
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
        <h3>코스튬</h3>
        <div class="costume-tabs">
          <button class="costume-tab active" data-rarity="all">전체</button>
          <button class="costume-tab" data-rarity="NORMAL">일반</button>
          <button class="costume-tab" data-rarity="RARE">레어</button>
          <button class="costume-tab" data-rarity="EPIC">에픽</button>
        </div>

        <div class="costume-grid" id="costumeGrid">
          ${renderCostumeGrid(COSTUMES, ownedCostumes, hunter.gold)}
        </div>
      </div>
    </div>
  `;

  setupShopEvents(ownedCostumes);
}

function renderCostumeGrid(costumes, owned, gold, filter = 'all') {
  const filtered = filter === 'all' ? costumes : costumes.filter(c => c.rarity === filter);

  return filtered.map(costume => {
    const isOwned = owned.includes(costume.id);
    const rarity = GAME_CONSTANTS.COSTUME_RARITY[costume.rarity];
    const canBuy = costume.price && gold >= costume.price && !isOwned;

    return `
      <div class="costume-card ${isOwned ? 'owned' : ''}" data-costume-id="${costume.id}">
        <div class="costume-header" style="border-color: ${rarity.color}">
          <span class="costume-rarity" style="color: ${rarity.color}">${rarity.name}</span>
        </div>
        <div class="costume-icon">&#128085;</div>
        <h4 class="costume-name">${costume.name}</h4>
        <p class="costume-desc">${costume.description}</p>
        <div class="costume-bonus">
          ${Object.entries(costume.statBonus).map(([stat, val]) =>
            `<span class="bonus-stat">+${val} ${stat}</span>`
          ).join('')}
        </div>
        <div class="costume-action">
          ${isOwned ? '<span class="owned-badge">보유중</span>' :
            costume.adRequired ? '<button class="btn-ad-costume">광고 시청</button>' :
            costume.eventOnly ? '<span class="event-badge">이벤트 전용</span>' :
            canBuy ? `<button class="btn-buy-costume" data-id="${costume.id}">${costume.price} G</button>` :
            `<span class="price-tag">${costume.price} G</span>`
          }
        </div>
      </div>
    `;
  }).join('');
}

function setupShopEvents(ownedCostumes) {
  // 광고 시청 버튼
  document.querySelectorAll('.btn-watch-ad').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;

      // 실제 광고 대신 시뮬레이션
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
      const hunter = stateManager.get('hunter');
      document.getElementById('costumeGrid').innerHTML =
        renderCostumeGrid(COSTUMES, ownedCostumes, hunter.gold, rarity);

      // 구매 버튼 재설정
      setupBuyButtons();
    });
  });

  setupBuyButtons();
}

function setupBuyButtons() {
  // 코스튬 구매
  document.querySelectorAll('.btn-buy-costume').forEach(btn => {
    btn.addEventListener('click', () => {
      const costumeId = btn.dataset.id;
      const costume = COSTUMES.find(c => c.id === costumeId);
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

  // 광고 코스튬
  document.querySelectorAll('.btn-ad-costume').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('광고를 시청하여 코스튬을 획득하시겠습니까?')) {
        const card = btn.closest('.costume-card');
        const costumeId = card.dataset.costumeId;
        const costume = COSTUMES.find(c => c.id === costumeId);

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
