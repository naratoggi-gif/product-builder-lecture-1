// The Hunter System - 상점 화면 (코스튬 기반 직업 전직 & 아이템)
import { stateManager } from '../../core/stateManager.js';
import { GAME_CONSTANTS } from '../../config/constants.js';
import { COSTUMES, getCostumeById, canEquipCostume, getCostumeStatBonus } from '../../config/costumes.js';
import { SHOP_ITEMS } from '../../config/shopItems.js';

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

  // Current state
  const gold = hunter.gold || 0;
  const essence = hunter.essence || 0;
  
  // Tab state (default to General if not set)
  let activeTab = 'general'; 

  const render = () => {
    app.innerHTML = `
      <div class="shop-screen">
        <div class="screen-header">
          <h1>상점</h1>
          <div class="currency-container">
            <div class="currency-display gold">
              <span class="currency-icon">&#128176;</span>
              <span class="currency-amount">${gold.toLocaleString()} G</span>
            </div>
            <div class="currency-display essence">
              <span class="currency-icon">&#10024;</span>
              <span class="currency-amount">${essence.toLocaleString()} E</span>
            </div>
          </div>
        </div>

        <!-- 상점 탭 -->
        <div class="shop-tabs">
            <button class="shop-tab ${activeTab === 'general' ? 'active' : ''}" data-tab="general">
                일반 상점 (Gold)
            </button>
            <button class="shop-tab ${activeTab === 'hunter' ? 'active' : ''}" data-tab="hunter">
                헌터 상점 (Essence)
            </button>
        </div>

        <div class="shop-content">
            ${activeTab === 'general' ? renderGeneralShop(gold) : renderHunterShop(essence, ownedCostumes, equippedCostume, hunter)}
        </div>
      </div>
    `;
    
    bindEvents();
  };

  const bindEvents = () => {
      // 탭 전환
      app.querySelectorAll('.shop-tab').forEach(btn => {
          btn.addEventListener('click', () => {
              activeTab = btn.dataset.tab;
              render();
          });
      });

      // 일반 아이템 구매
      app.querySelectorAll('.btn-buy-item').forEach(btn => {
          btn.addEventListener('click', () => {
              const itemId = btn.dataset.id;
              const item = SHOP_ITEMS.GENERAL.find(i => i.id === itemId);
              if (item) {
                  const result = stateManager.purchaseItem(item);
                  if (result.success) {
                      window.showNotification(`${item.name} 구매 완료!`, 'success');
                      renderShop(); // Re-render to update currency
                  } else {
                      window.showNotification(result.error, 'error');
                  }
              }
          });
      });

      // 코스튬 구매
      app.querySelectorAll('.btn-buy-costume').forEach(btn => {
          btn.addEventListener('click', () => {
              const costumeId = btn.dataset.id;
              // Hard Rule: Costumes use Essence, never Gold logic here (handled by purchaseCostume)
              const result = stateManager.purchaseCostume(costumeId);
              if (result.success) {
                  const costume = getCostumeById(costumeId);
                  window.showNotification(`${costume.name} 구매 완료!`, 'success');
                  renderShop();
              } else {
                  window.showNotification(result.error, 'error');
              }
          });
      });

      // 코스튬 장착 (편의성)
      app.querySelectorAll('.btn-equip-costume').forEach(btn => {
          btn.addEventListener('click', () => {
              const costumeId = btn.dataset.id;
              const result = stateManager.equipCostume(costumeId);
              if (result.success) {
                  window.showNotification('코스튬 장착 완료!', 'success');
                  renderShop();
              } else {
                  window.showNotification(result.error, 'error');
              }
          });
      });
  };

  render();
}

function renderGeneralShop(gold) {
    return `
        <div class="shop-grid">
            ${SHOP_ITEMS.GENERAL.map(item => `
                <div class="card shop-item-card">
                    <div class="item-icon">${item.icon}</div>
                    <div class="item-info">
                        <h4 class="item-name">${item.name}</h4>
                        <p class="item-desc">${item.description}</p>
                    </div>
                    <button class="btn-buy-item" data-id="${item.id}" ${gold < item.price ? 'disabled' : ''}>
                        <span class="price-val">${item.price.toLocaleString()} G</span>
                    </button>
                </div>
            `).join('')}
        </div>
        <div class="shop-notice">
            <p>* 일반 아이템은 골드로 구매할 수 있습니다.</p>
        </div>
    `;
}

function renderHunterShop(essence, owned, equippedId, hunter) {
    return `
        <div class="shop-section-title">
            <h3>코스튬 (전직)</h3>
            <p>에센스로 구매 가능한 헌터 전용 장비입니다.</p>
        </div>
        <div class="costume-grid">
            ${COSTUMES.map(costume => {
                const isOwned = owned.includes(costume.id) || costume.id === 'hunter_basic';
                const isEquipped = equippedId === costume.id;
                const canBuy = essence >= costume.essencePrice;
                const equipCheck = canEquipCostume(costume.id, hunter.stats);

                let actionBtn = '';
                if (isEquipped) {
                    actionBtn = `<button class="btn-action equipped" disabled>장착 중</button>`;
                } else if (isOwned) {
                    if (equipCheck.canEquip) {
                        actionBtn = `<button class="btn-equip-costume" data-id="${costume.id}">장착하기</button>`;
                    } else {
                        actionBtn = `<button class="btn-action locked" disabled>조건 미달</button>`;
                    }
                } else {
                    // Purchase Button - Display Essence Price
                    actionBtn = `<button class="btn-buy-costume" data-id="${costume.id}" ${!canBuy ? 'disabled' : ''}>
                        ${costume.essencePrice} Essence
                    </button>`;
                }

                return `
                    <div class="costume-card ${isOwned ? 'owned' : ''} ${isEquipped ? 'equipped' : ''}">
                        <div class="costume-header">
                            <span class="costume-rarity ${costume.rarity.toLowerCase()}">${costume.rarity}</span>
                        </div>
                        <div class="costume-icon">&#128085;</div>
                        <h4 class="costume-name">${costume.name}</h4>
                        <p class="costume-job-title">${costume.jobTitle}</p>
                        
                        <div class="costume-action">
                            ${actionBtn}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}
