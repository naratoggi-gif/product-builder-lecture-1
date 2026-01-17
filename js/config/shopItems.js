// The Hunter System - Shop Items Configuration
// v5.0 Dual Economy: Gold (General) vs Essence (Hunter)

export const SHOP_ITEMS = {
  GENERAL: [
    {
      id: 'potion_hp_small',
      name: '소형 HP 포션',
      description: '체력을 50 회복합니다.',
      price: 100,
      currency: 'gold',
      icon: '🧪',
      type: 'consumable',
      effect: { type: 'heal', value: 50 }
    },
    {
      id: 'potion_hp_medium',
      name: '중형 HP 포션',
      description: '체력을 150 회복합니다.',
      price: 250,
      currency: 'gold',
      icon: '🧪',
      type: 'consumable',
      effect: { type: 'heal', value: 150 }
    },
    {
        id: 'whetstone',
        name: '숫돌',
        description: '다음 전투에서 공격력이 10% 증가합니다.',
        price: 500,
        currency: 'gold',
        icon: '🪨',
        type: 'consumable',
        effect: { type: 'buff', stat: 'attack', value: 0.1, duration: 1 }
    }
  ],
  HUNTER: [
    // Costumes are loaded dynamically from COSTUMES array in costumes.js
    // This section is for Elite Skills or other Essence items in the future
    {
        id: 'skill_book_mystery',
        name: '신비한 스킬북 (비활성)',
        description: '랜덤한 스킬을 획득합니다. (준비중)',
        price: 100,
        currency: 'essence',
        icon: '📘',
        type: 'consumable',
        disabled: true
    }
  ]
};