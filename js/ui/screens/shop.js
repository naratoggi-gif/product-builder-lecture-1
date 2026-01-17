// The Hunter System - Shop Screen (v6.1)
// v6.1: Costume-Skill Synergy - 코스튬 장착 시 외형 변화 + 골드 x2 배율
import { stateManager } from '../../core/stateManager.js';
import { SHOP_ITEMS } from '../../config/shopItems.js';
import { COSTUMES, getCostumeById, canEquipCostume } from '../../config/costumes.js';

// v6.1: 코스튬별 스프라이트 맵핑 (외형 변화 시스템)
const COSTUME_SPRITES = {
  'hunter_basic': '👨‍🦱',
  'shadow_cloak': '🥷',
  'warrior_armor': '⚔️',
  'scholar_robe': '🧙',
  'mage_robe': '🧙‍♂️',
  'lucky_charm': '🍀',
  'assassin_gear': '🗡️',
  'dragon_scale': '🐉',
  'esper_suit': '🔮',
  'monarch_regalia': '👑'
};

let activeTab = 'general'; // 'general' | 'hunter'

export function renderShop() {
  const app = document.getElementById('app');
  const hunter = stateManager.get('hunter');

  if (!hunter) {
    window.location.hash = 'awakening';
    return;
  }

  // --- Header & Currency Display ---
  app.innerHTML = `
    <div class="shop-screen">
      <div class="screen-header">
        <h1>상점</h1>
        <p class="screen-subtitle">필요한 물품과 장비를 구매하세요.</p>
      </div>

      <!-- Currency Bar -->
      <div class="currency-bar-card">
        <div class="currency-display gold">
          <span class="currency-icon">💰</span>
          <span class="currency-amount">${(hunter.gold || 0).toLocaleString()}</span>
        </div>
        <div class="currency-display essence">
          <span class="currency-icon">✨</span>
          <span class="currency-amount">${(hunter.essence || 0).toLocaleString()} E</span>
        </div>
      </div>

      <!-- Shop Tabs -->
      <div class="shop-tabs-container">
        <button class="shop-main-tab ${activeTab === 'general' ? 'active' : ''}" data-tab="general">
          🛒 잡화점 (골드)
        </button>
        <button class="shop-main-tab ${activeTab === 'hunter' ? 'active' : ''}" data-tab="hunter">
          🎭 헌터 상점 (에센스)
        </button>
      </div>

      <!-- Content Area -->
      <div id="shop-content">
        ${activeTab === 'general' ? renderGeneralShop(hunter) : renderHunterShop(hunter)}
      </div>
    </div>
  `;

  bindShopEvents();
}

// --- General Shop (Gold) ---
function renderGeneralShop(hunter) {
  const items = SHOP_ITEMS.GENERAL || [];

  if (items.length === 0) {
    return `<div class="empty-state">판매 중인 아이템이 없습니다.</div>`;
  }

  return `
    <div class="general-shop-section">
      <div class="guide-card gold-guide">
        <p>💡 골드로 소비 아이템이나 스탯 강화 도구를 구매할 수 있습니다.</p>
      </div>

      <div class="shop-grid">
        ${items.map(item => {
            const canAfford = hunter.gold >= item.price;
            return `
            <div class="shop-item-card">
              <div class="item-icon">${item.icon || '📦'}</div>
              <div class="item-info">
                <h4 class="item-name">${item.name}</h4>
                <p class="item-desc">${item.description}</p>
                <div class="item-price-row">
                  <span class="price-tag gold">💰 ${item.price.toLocaleString()}</span>
                </div>
              </div>
              <button class="btn-buy-item ${canAfford ? '' : 'disabled'}" 
                      data-id="${item.id}" 
                      data-type="general"
                      ${canAfford ? '' : 'disabled'}>
                구매
              </button>
            </div>
            `;
        }).join('')}
      </div>
    </div>
  `;
}

// --- v6.1: Hunter Shop (Essence Only) - Costumes with Synergy ---
function renderHunterShop(hunter) {
  const ownedCostumes = stateManager.get('costumes') || [];
  const equippedCostumeId = stateManager.get('equippedCostume');
  const equippedCostume = equippedCostumeId ? getCostumeById(equippedCostumeId) : null;

  return `
    <div class="hunter-shop-section">
      <!-- v6.1: Dual Economy 안내 -->
      <div class="guide-card essence-guide">
        <p>✨ <strong>에센스</strong>는 현실 퀘스트 완료로만 획득하는 증명의 화폐입니다.</p>
        <p>💰 <strong>골드</strong>는 자동 사냥으로 획득 → 스탯 연마에만 사용됩니다.</p>
      </div>

      <!-- v6.1: 코스튬 시너지 안내 -->
      <div class="synergy-info-card">
        <div class="synergy-header">
          <span class="synergy-icon">🎭</span>
          <span class="synergy-title">코스튬 시너지 효과</span>
        </div>
        <div class="synergy-effects">
          <div class="synergy-item">
            <span class="effect-icon">👤</span>
            <span class="effect-text">아바타 외형 변화</span>
          </div>
          <div class="synergy-item highlight">
            <span class="effect-icon">💰</span>
            <span class="effect-text">골드 획득량 x2 배율</span>
          </div>
          <div class="synergy-item">
            <span class="effect-icon">⚔️</span>
            <span class="effect-text">스킬 이름/효과 변경</span>
          </div>
        </div>
      </div>

      <!-- Currently Equipped -->
      <div class="card equipped-section">
        <h3>현재 장착</h3>
        ${equippedCostume ? `
          <div class="equipped-costume-display">
            <div class="equipped-sprite ${equippedCostume.rarity.toLowerCase()}">${COSTUME_SPRITES[equippedCostume.id] || '👤'}</div>
            <div class="equipped-info">
              <span class="equipped-name">${equippedCostume.name}</span>
              <div class="equipped-bonus">
                <span class="bonus-tag gold-bonus">💰 골드 x2</span>
                ${equippedCostume.statBonus?.expMult > 1 ? `<span class="bonus-tag exp-bonus">⭐ EXP +${Math.round((equippedCostume.statBonus.expMult - 1) * 100)}%</span>` : ''}
              </div>
            </div>
          </div>
        ` : `
          <div class="no-costume-equipped">
            <p>코스튬 미장착 (기본)</p>
          </div>
        `}
      </div>

      <h3 class="section-title">코스튬 목록</h3>
      <div class="costume-shop-grid">
        ${COSTUMES.filter(c => c.id !== 'hunter_basic').map(costume => {
          const isOwned = ownedCostumes.includes(costume.id);
          const isEquipped = equippedCostumeId === costume.id;
          const canBuy = hunter.essence >= costume.essencePrice;
          const equipCheck = canEquipCostume(costume.id, hunter.stats);
          const sprite = COSTUME_SPRITES[costume.id] || '👤';

          // Bonuses text
          const bonuses = [];
          if (costume.statBonus) {
            if (costume.statBonus.expMult > 1) bonuses.push(`EXP +${Math.round((costume.statBonus.expMult - 1) * 100)}%`);
            // Add other key stats if needed
          }

          let actionBtn = '';
          let statusClass = '';

          if (isEquipped) {
            actionBtn = `<button class="btn-costume-action equipped" disabled>✓ 장착 중</button>`;
            statusClass = 'is-equipped';
          } else if (isOwned) {
            if (equipCheck.canEquip) {
              actionBtn = `<button class="btn-costume-action equip" data-id="${costume.id}">장착하기</button>`;
              statusClass = 'is-owned';
            } else {
              actionBtn = `<button class="btn-costume-action locked" disabled title="${equipCheck.reason}">조건 미달</button>`;
              statusClass = 'is-locked';
            }
          } else {
            // STRICT RULE: Costumes buyable only with Essence
            actionBtn = `<button class="btn-costume-action buy" data-id="${costume.id}" ${!canBuy ? 'disabled' : ''}>
              ✨ ${costume.essencePrice} E
            </button>`;
            statusClass = canBuy ? 'can-buy' : 'cannot-buy';
          }

          return `
            <div class="costume-shop-card ${statusClass} rarity-${costume.rarity.toLowerCase()}">
              <div class="costume-sprite-container">
                <span class="costume-sprite">${sprite}</span>
                <span class="costume-rarity-badge ${costume.rarity.toLowerCase()}">${costume.rarity}</span>
              </div>
              <div class="costume-details">
                <h4 class="costume-name">${costume.name}</h4>
                <p class="costume-job">${costume.jobTitle}</p>
                <div class="costume-bonuses">
                  <span class="bonus-item gold">💰 x2</span>
                  ${bonuses.slice(0, 1).map(b => `<span class="bonus-item">${b}</span>`).join('')}
                </div>
                ${!equipCheck.canEquip ? `<p class="req-warning">조건 미달</p>` : ''}
              </div>
              <div class="costume-action">
                ${actionBtn}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      ${renderOtherHunterItems(hunter)}
    </div>
  `;
}

// Optional: Render other Hunter/Essence items (like Skill Books)
function renderOtherHunterItems(hunter) {
    const items = SHOP_ITEMS.HUNTER || [];
    if (items.length === 0) return '';

    return `
      <h3 class="section-title" style="margin-top: 24px;">특수 아이템</h3>
      <div class="shop-grid">
        ${items.map(item => {
            const canAfford = hunter.essence >= item.price;
            return `
            <div class="shop-item-card hunter-item">
              <div class="item-icon">${item.icon || '📘'}</div>
              <div class="item-info">
                <h4 class="item-name">${item.name}</h4>
                <p class="item-desc">${item.description}</p>
                <div class="item-price-row">
                  <span class="price-tag essence">✨ ${item.price} E</span>
                </div>
              </div>
              <button class="btn-buy-item ${canAfford && !item.disabled ? '' : 'disabled'}" 
                      data-id="${item.id}" 
                      data-type="hunter_item"
                      ${canAfford && !item.disabled ? '' : 'disabled'}>
                ${item.disabled ? '준비중' : '구매'}
              </button>
            </div>
            `;
        }).join('')}
      </div>
    `;
}

function bindShopEvents() {
  const app = document.getElementById('app');

  // Tab Switching
  app.querySelectorAll('.shop-main-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      renderShop();
    });
  });

  // General Item Purchase
  app.querySelectorAll('.btn-buy-item[data-type="general"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.id;
      const item = SHOP_ITEMS.GENERAL.find(i => i.id === itemId);
      
      if (item) {
        // Double check currency type to enforce rules
        if (item.currency !== 'gold') {
             window.showNotification('이 아이템은 골드로 구매할 수 없습니다.', 'error');
             return;
        }

        const result = stateManager.purchaseItem(item);
        if (result.success) {
          window.showNotification(`${item.name} 구매 완료!`, 'success');
          renderShop();
        } else {
          window.showNotification(result.error, 'error');
        }
      }
    });
  });

   // Hunter Item Purchase (Non-Costume)
   app.querySelectorAll('.btn-buy-item[data-type="hunter_item"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.id;
      const item = SHOP_ITEMS.HUNTER.find(i => i.id === itemId);
      
      if (item) {
         if (item.currency !== 'essence') {
             window.showNotification('이 아이템은 에센스로 구매해야 합니다.', 'error');
             return;
        }

        const result = stateManager.purchaseItem(item);
        if (result.success) {
          window.showNotification(`${item.name} 구매 완료!`, 'success');
          renderShop();
        } else {
          window.showNotification(result.error, 'error');
        }
      }
    });
  });

  // Costume Purchase
  app.querySelectorAll('.btn-costume-action.buy').forEach(btn => {
    btn.addEventListener('click', () => {
      const costumeId = btn.dataset.id;
      // Explicitly calling purchaseCostume which handles Essence logic
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

  // Costume Equip
  app.querySelectorAll('.btn-costume-action.equip').forEach(btn => {
    btn.addEventListener('click', () => {
      const costumeId = btn.dataset.id;
      const result = stateManager.equipCostume(costumeId);
      if (result.success) {
        const costume = getCostumeById(costumeId);
        window.showNotification(`${costume.name} 장착!`, 'success');
        renderShop();
      } else {
        window.showNotification(result.error, 'error');
      }
    });
  });
}
