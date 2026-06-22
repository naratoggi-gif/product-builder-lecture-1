import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../shared/public.decorator';

function isSuperModeAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ENABLE_SUPER_MODE === 'true';
}

@Controller('dev')
export class DevtoolsController {
  @Public()
  @Get('super-mode.js')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  getSuperModeScript(): string {
    if (!isSuperModeAllowed()) {
      return 'window.StepQuestSuperMode=undefined;';
    }

    return `
(() => {
  const storageKey = 'stepquest_local_super';
  const email = 'super@stepquest.local';
  const password = 'stepquest-super-1234';
  const nickname = '\\uC288\\uD37C \\uD14C\\uC2A4\\uD130';
  const costumeId = 'one_punch_hero';
  const costumeName = '\\uC6D0\\uD380\\uCE58 \\uD14C\\uC2A4\\uD2B8 \\uD788\\uC5B4\\uB85C';

  function injectStyles() {
    if (document.getElementById('stepquest-super-mode-style')) return;
    const style = document.createElement('style');
    style.id = 'stepquest-super-mode-style';
    style.textContent = \`
      .player-one_punch_hero {
        width: 30px;
        height: 34px;
        filter: drop-shadow(0 0 10px rgba(255, 209, 102, .5));
        animation: hero-dash 5.8s ease-in-out infinite;
      }
      .player-one_punch_hero i {
        border-color: #2b2522;
        border-radius: 50% 50% 7px 7px;
        background:
          radial-gradient(circle at 34% 27%, #2b2522 0 2px, transparent 3px),
          radial-gradient(circle at 66% 27%, #2b2522 0 2px, transparent 3px),
          linear-gradient(#f2c08b 0 38%, #f6d743 38% 70%, #f2f0dd 70%);
      }
      .player-one_punch_hero i::before {
        content: "";
        position: absolute;
        left: -15px;
        top: 9px;
        width: 18px;
        height: 21px;
        border: 3px solid #2b2522;
        border-right: 0;
        border-radius: 12px 0 0 12px;
        background: #e34f3f;
      }
      .player-one_punch_hero i::after {
        content: "";
        position: absolute;
        right: -12px;
        top: 11px;
        width: 12px;
        height: 10px;
        border: 3px solid #2b2522;
        border-radius: 50%;
        background: #e34f3f;
      }
      @keyframes hero-dash {
        0%, 100% { transform: translate(0, 0); }
        30% { transform: translate(150px, -42px) skewX(-8deg); }
        34% { transform: translate(164px, -42px) skewX(8deg); }
        70% { transform: translate(-110px, 22px) scaleX(-1); }
      }
      @media (max-width: 720px) {
        .player-one_punch_hero {
          width: 24px;
          height: 27px;
        }
      }
    \`;
    document.head.appendChild(style);
  }

  function makeGuest(context) {
    const now = new Date().toISOString();
    const categories = [
      ...Array.from({ length: 5 }, () => 'study'),
      ...Array.from({ length: 10 }, () => 'cleaning'),
      ...Array.from({ length: 10 }, () => 'writing'),
      ...Array.from({ length: 5 }, () => 'wake'),
    ];
    const doneSteps = categories.map((category, index) => ({
      id: 880000 + index,
      userId: 'local-super',
      weeklyMissionId: 880001,
      title: \`\\uC288\\uD37C \\uD574\\uAE08 \\uC2A4\\uD15D \${index + 1}\`,
      estimatedSeconds: 5,
      difficulty: 1,
      category,
      status: 'DONE',
      createdAt: now,
      completedAt: now,
    }));
    const activeStep = {
      id: 990001,
      userId: 'local-super',
      weeklyMissionId: 990000,
      title: '\\uC8FC\\uBA39 \\uD55C \\uBC88 \\uC950\\uAE30',
      estimatedSeconds: 5,
      difficulty: 1,
      category: 'study',
      status: 'OPEN',
      createdAt: now,
      completedAt: null,
    };
    const guest = {
      ...context.guestDefault(),
      player: {
        nickname,
        level: 99,
        goalCoin: 999999999,
        totalExp: 999999,
        returnMarks: 99,
        equippedCostumeId: costumeId,
        equippedCostumeName: costumeName,
      },
      consistency: {
        currentStreakDays: 365,
        bestStreakDays: 365,
        consistencyScore: 100,
      },
      weekly: [{
        id: 990000,
        title: '\\uC288\\uD37C \\uD14C\\uC2A4\\uD2B8 \\uB358\\uC804',
        category: 'study',
        targetCount: 1,
        completedCount: 0,
        status: 'ACTIVE',
        activeRevision: 1,
        createdAt: now,
      }],
      micro: [activeStep, ...doneSteps],
      nextMicro: activeStep,
      attempts: doneSteps.map((step) => ({
        stepId: step.id,
        action: 'complete',
        reason: null,
        createdAt: now,
      })),
      equippedCostumeId: costumeId,
      returnSessions: [1, 2, 3].map((id) => ({ id, startedAt: now, completedAt: now })),
      village: context.normalizeVillage(context.makeGuestVillage()).map((facility) => ({
        ...facility,
        level: 20,
        xp: 100,
        material: 100,
      })),
      sessionCombo: 8,
      comboChestCount: 99,
    };
    guest.costumes = context.buildCostumes(guest);
    return guest;
  }

  window.StepQuestSuperMode = {
    label: '\\uC288\\uD37C \\uD14C\\uC2A4\\uD2B8 \\uBAA8\\uB4DC',
    isActive: () => localStorage.getItem(storageKey) === '1',
    clear: () => localStorage.removeItem(storageKey),
    canLogin: (value, secret) => String(value || '').trim().toLowerCase() === email && String(secret || '') === password,
    extendCostumes(costumes) {
      if (!Array.isArray(costumes) || costumes.some((item) => item.id === costumeId)) return;
      costumes.push({
        id: costumeId,
        name: costumeName,
        role: '\\uC288\\uD37C QA',
        passiveAbility: '\\uBAA8\\uB4E0 Step \\uBCF4\\uC0C1 x3',
        activeAbility: '\\uB300\\uCDA9 \\uD55C \\uBC88: \\uD604\\uC7AC Step \\uC55E\\uC5D0 5\\uCD08 \\uD14C\\uC2A4\\uD2B8 Step \\uC0DD\\uC131',
        unlockText: '\\uC288\\uD37C \\uACC4\\uC815 \\uC804\\uC6A9',
        metric: 'total_completed',
        target: 1,
      });
    },
    costumeRewardMultiplier: (value) => value === costumeId ? 3 : 0,
    costumeActiveSteps: (value) => value === costumeId ? [['\\uC8FC\\uBA39 \\uD55C \\uBC88 \\uC950\\uAE30', 5]] : [],
    activate(context, value = email) {
      injectStyles();
      context.state.token = '';
      context.state.user = { id: 'local-super', email: value, nickname };
      context.state.localSuper = true;
      localStorage.setItem(storageKey, '1');
      context.persistAuth();
      const guest = makeGuest(context);
      context.saveGuest(guest);
      context.syncGuest(guest);
    },
    logout(context) {
      localStorage.removeItem(storageKey);
      const guest = context.guestDefault();
      context.saveGuest(guest);
      context.syncGuest(guest);
    },
  };
  injectStyles();
})();
`;
  }
}
