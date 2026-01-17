// The Hunter System - Shop Items Configuration
// v6.1 Dual Economy (엄격한 분리):
// - Gold: 자동사냥/방치로 획득 → 스탯 연마에만 사용 (General Shop)
// - Essence: 현실 퀘스트로 획득 → 특별 코스튬 구매에만 사용 (Hunter Shop)

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