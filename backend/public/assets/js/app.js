(() => {
  const guestStorageKey = 'stepquest_guest_state';
  const tokenStorageKey = 'stepquest_token';
  const userStorageKey = 'stepquest_user';
  const logsStorageKey = 'stepquest_today_traces';
  const motionStorageKey = 'stepquest_reduced_motion';
  const anonymousUserStorageKey = 'stepquest_anonymous_user_id';
  const sessionStorageKey = 'stepquest_session_id';
  const costumeActiveRechargeSteps = 3;

  const t = {
    today: '\uC624\uB298',
    expedition: '\uC5EC\uC815',
    character: '\uCE90\uB9AD\uD130',
    village: '\uB9C8\uC744',
    guestMode: '\uAC8C\uC2A4\uD2B8 \uBAA8\uB4DC',
    waiting: '\uB300\uAE30 \uC911',
    signup: '\uD68C\uC6D0\uAC00\uC785',
    login: '\uB85C\uADF8\uC778',
    logout: '\uB85C\uADF8\uC544\uC6C3',
    email: '\uC774\uBA54\uC77C',
    password: '\uBE44\uBC00\uBC88\uD638',
    nickname: '\uB2C9\uB124\uC784',
    guestRunner: '\uCD08\uB3D9 \uBAA8\uD5D8\uAC00',
    subtitle: '\uC624\uB298\uC740 \uC785\uAD6C\uB9CC \uC5F0\uB2E4',
    points: '\uC7AC\uB8CC',
    level: '\uB808\uBCA8',
    streak: '\uD750\uB984',
    score: '\uC2DC\uC791\uB825',
    log: '\uC624\uB298\uC758 \uD754\uC801',
    noLogs: '\uC544\uC9C1 \uB0A8\uAE34 \uD754\uC801\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.',
    authNeeded: '\uC800\uC7A5\uD558\uB824\uBA74 \uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.',
    created: '\uC624\uB298\uC758 \uCCAB \uD589\uB3D9\uC744 \uB9CC\uB4E4\uC5C8\uC2B5\uB2C8\uB2E4.',
    completed: '\uC9C4\uD589\uD55C \uAC83\uC740 \uC0AC\uB77C\uC9C0\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.',
    undone: '\uBC29\uAE08 \uC644\uB8CC\uB97C \uB418\uB3CC\uB838\uC2B5\uB2C8\uB2E4.',
    shrunk: '\uB354 \uC791\uC740 \uB2E8\uACC4\uB85C \uBC14\uAFC8\uC2B5\uB2C8\uB2E4.',
    skipped: '\uC9C0\uAE08\uC740 \uB118\uC5B4\uAC11\uB2C8\uB2E4. \uAE30\uB85D\uC740 \uB0A8\uC544 \uC788\uC2B5\uB2C8\uB2E4.',
    deferred: '\uC5EC\uAE30\uC11C \uBA48\uCDB0\uB3C4 \uC9C4\uD589\uD55C \uAC83\uC740 \uC0AC\uB77C\uC9C0\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.',
    returned: '\uB3CC\uC544\uC654\uB2E4. \uAE30\uB85D\uC740 \uB0A8\uC544 \uC788\uB2E4.',
    reminderSaved: '\uB2E4\uC74C \uD589\uB3D9 \uC54C\uB9BC\uC744 \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4.',
    reminderDue: '\uC54C\uB9BC\uC774 \uB3C4\uCC29\uD588\uC2B5\uB2C8\uB2E4.',
    reminderSnoozed: '\uC54C\uB9BC\uC744 5\uBD84 \uB4A4\uB85C \uBBF8\uB8E0\uC2B5\uB2C8\uB2E4.',
    costumeActivated: '\uCF54\uC2A4\uD2AC \uB2A5\uB825\uC73C\uB85C \uC791\uC740 \uC785\uAD6C\uB97C \uC5F4\uC5C8\uC2B5\uB2C8\uB2E4.',
    regenerated: '\uC6D0\uC815\uC744 \uB2E4\uC2DC \uC791\uC740 \uC785\uAD6C\uB85C \uCABC\uAC1C\uC5C8\uC2B5\uB2C8\uB2E4.',
    noValue: '\uC544\uC9C1 \uC5C6\uC74C',
    noNextAction: '\uB2E4\uC74C \uD589\uB3D9 \uC5C6\uC74C',
    reducedMotion: '\uBAA8\uC158 \uC904\uC774\uAE30',
    motionOn: '\uBAA8\uC158\uC744 \uC904\uC600\uC2B5\uB2C8\uB2E4.',
    motionOff: '\uBAA8\uC158\uC744 \uB2E4\uC2DC \uD45C\uC2DC\uD569\uB2C8\uB2E4.',
    guestImported: '\uAC8C\uC2A4\uD2B8 \uC9C4\uD589\uB3C4\uB97C \uACC4\uC815\uC73C\uB85C \uC62E\uACBC\uC2B5\uB2C8\uB2E4.',
    guestKeptAccount: '\uACC4\uC815 \uC9C4\uD589\uB3C4\uB97C \uC720\uC9C0\uD588\uC2B5\uB2C8\uB2E4.',
    guestImportChoice: '\uACC4\uC815 \uC9C4\uD589\uB3C4\uAC00 \uC774\uBBF8 \uC788\uC2B5\uB2C8\uB2E4. \uD655\uC778\uC744 \uB204\uB974\uBA74 \uAC8C\uC2A4\uD2B8 \uC9C4\uD589\uB3C4\uB97C \uC774\uC5B4\uBC1B\uACE0, \uCDE8\uC18C\uB97C \uB204\uB974\uBA74 \uACC4\uC815 \uC9C4\uD589\uB3C4\uB97C \uC0AC\uC6A9\uD569\uB2C8\uB2E4.',
  };

  const state = {
    token: localStorage.getItem(tokenStorageKey) || '',
    user: parseJson(localStorage.getItem(userStorageKey), null),
    localSuper: Boolean(window.StepQuestSuperMode?.isActive?.()),
    player: null,
    consistency: null,
    vision: [],
    weekly: [],
    micro: [],
    nextMicro: null,
    deferredStep: null,
    dungeons: [],
    shop: [],
    skills: [],
    battle: null,
    stats: null,
    returnInfo: null,
    reminder: null,
    reminderDue: false,
    village: [],
    sessionCombo: 0,
    gameEvent: null,
    logs: normalizeLogs(parseJson(localStorage.getItem(logsStorageKey), [])),
    reducedMotion: readReducedMotion(),
  };

  const routes = [
    ['goals.html', t.today],
    ['goals.html#expedition', t.expedition],
    ['goals.html#character', t.character],
    ['goals.html#village', t.village],
  ];

  const templates = {
    study: [
      '\uC758\uC790\uC5D0 \uC549\uAE30',
      '\uACF5\uCC45 \uD3B4\uAE30',
      '\uCCAB \uBB38\uC7A5\uB9CC \uC77D\uAE30',
      '\uC904 \uD558\uB098\uB9CC \uD45C\uC2DC\uD558\uAE30',
      '\uB2E4\uC74C 5\uBD84\uC744 \uC608\uC57D\uD558\uAE30',
    ],
    work: [
      '\uC791\uC5C5 \uD654\uBA74\uC744 \uC5F4\uAE30',
      '\uD544\uC694\uD55C \uD30C\uC77C \uD558\uB098\uB9CC \uC5F4\uAE30',
      '\uCCAB \uC904\uC5D0 \uD45C\uC2DC\uD558\uAE30',
      '\uC791\uC740 \uC218\uC815 \uD558\uB098\uB9CC \uD558\uAE30',
      '\uB2E4\uC74C \uB2E8\uACC4\uB97C \uC801\uAE30',
    ],
    writing: [
      '\uBB38\uC11C\uB97C \uC5F4\uAE30',
      '\uC81C\uBAA9\uB9CC \uC801\uAE30',
      '\uD55C \uBB38\uC7A5\uB9CC \uC4F0\uAE30',
      '\uC0AD\uC81C\uD574\uB3C4 \uB418\uB294 \uBA54\uBAA8 \uC4F0\uAE30',
      '\uB2E4\uC74C \uBB38\uC7A5\uC744 \uC608\uC57D\uD558\uAE30',
    ],
    cleaning: [
      '\uC790\uB9AC\uC5D0 \uC11C\uAE30',
      '\uB208\uC5D0 \uBCF4\uC774\uB294 \uAC83 \uD558\uB098\uB9CC \uC9D1\uAE30',
      '\uBC84\uB9AC\uAC70\uB098 \uC81C\uC790\uB9AC\uC5D0 \uB450\uAE30',
      '10\uCD08\uB9CC \uB354 \uBCF4\uAE30',
      '\uB2E4\uC74C \uD558\uB098\uB97C \uACE0\uB974\uAE30',
    ],
    exercise: [
      '\uC6B4\uB3D9\uBCF5\uC744 \uB208\uC5D0 \uB450\uAE30',
      '\uD55C \uBC1C\uB9CC \uC6C0\uC9C1\uC774\uAE30',
      '\uC2A4\uD2B8\uB808\uCE6D 10\uCD08',
      '\uBB3C \uD55C \uBAA8\uAE08 \uB9C8\uC2DC\uAE30',
      '\uC624\uB298 \uD560 \uAC83 \uD558\uB098\uB9CC \uACE0\uB974\uAE30',
    ],
    wake: [
      '\uD55C \uB2E4\uB9AC\uB9CC \uC774\uBD88 \uBC16\uC73C\uB85C \uB0B4\uAE30',
      '\uB2E4\uB978 \uB2E4\uB9AC\uB3C4 \uB0B4\uAE30',
      '\uC190\uC744 \uCE68\uB300 \uBC16\uC5D0 \uB450\uAE30',
      '\uC0C1\uCCB4\uB97C \uBC18\uB9CC \uC77C\uC73C\uD0A4\uAE30',
      '\uBC14\uB2E5\uC5D0 \uBC1C\uC744 \uB300\uAE30',
    ],
    sleep: [
      '\uD734\uB300\uD3F0\uC744 \uB4A4\uC9D1\uAE30',
      '\uC54C\uB78C\uC744 \uD655\uC778\uD558\uAE30',
      '\uC870\uBA85\uC744 \uD55C \uB2E8\uACC4 \uB0AE\uCD94\uAE30',
      '\uC774\uBD88\uC744 \uD3BC\uAE30',
      '\uB208\uC744 10\uCD08 \uAC10\uAE30',
    ],
    life_admin: [
      '\uD574\uC57C \uD560 \uD398\uC774\uC9C0\uB97C \uC5F4\uAE30',
      '\uC774\uB984\uB9CC \uC785\uB825\uD558\uAE30',
      '\uD544\uC694\uD55C \uC815\uBCF4 \uD558\uB098\uB9CC \uD655\uC778\uD558\uAE30',
      '\uCCAB \uCE78\uB9CC \uCC44\uC6B0\uAE30',
      '\uC800\uC7A5 \uBC84\uD2BC \uC704\uCE58 \uBCF4\uAE30',
    ],
    relationship: [
      '\uC5F0\uB77D\uD560 \uC0AC\uB78C \uC774\uB984\uB9CC \uBCF4\uAE30',
      '\uBA54\uC2DC\uC9C0\uCC3D\uC744 \uC5F4\uAE30',
      '\uCCAB \uC778\uC0AC\uB9CC \uC4F0\uAE30',
      '\uBCF4\uB0B4\uAE30 \uC804 10\uCD08 \uBCF4\uAE30',
      '\uB0B4\uC77C \uB2E4\uC2DC \uBCFC \uC2DC\uAC04 \uC801\uAE30',
    ],
  };

  const categoryWords = [
    ['study', ['\uACF5\uBD80', '\uCC45', '\uC77D', '\uBB38\uC81C', '\uAC15\uC758', '\uC2DC\uD5D8']],
    ['wake', ['\uC77C\uC5B4', '\uAE30\uC0C1', '\uCE68\uB300', '\uC544\uCE68']],
    ['sleep', ['\uC790\uAE30', '\uC218\uBA74', '\uC7A0', '\uCDE8\uCE68']],
    ['exercise', ['\uC6B4\uB3D9', '\uD5EC\uC2A4', '\uC2A4\uD2B8\uB808\uCE6D', '\uAC77']],
    ['cleaning', ['\uCCAD\uC18C', '\uC815\uB9AC', '\uC124\uAC70\uC9C0', '\uBC84\uB9AC']],
    ['writing', ['\uC4F0', '\uAE00', '\uC6D0\uACE0', '\uBA54\uBAA8']],
    ['relationship', ['\uC5F0\uB77D', '\uB2F5\uC7A5', '\uC804\uD654']],
  ];

  const facilityLabels = {
    knowledge_tower: '\uC9C0\uC2DD\uC758 \uD0D1',
    guild_office: '\uAE38\uB4DC \uC0AC\uBB34\uC18C',
    training_ground: '\uD6C8\uB828\uC18C',
    workshop: '\uACF5\uBC29',
    archive: '\uAE30\uB85D\uAD00',
    inn: '\uC5EC\uAD00',
    kitchen: '\uC8FC\uBC29',
    garden: '\uC815\uC6D0',
  };

  const facilityDetails = {
    knowledge_tower: '공부·독서 행동이 쌓입니다.',
    guild_office: '업무·생활 행정 행동이 쌓입니다.',
    training_ground: '운동 행동이 쌓입니다.',
    workshop: '청소·정리 행동이 쌓입니다.',
    archive: '글쓰기·기록 행동이 쌓입니다.',
    inn: '기상·수면 루틴이 쌓입니다.',
    kitchen: '몸 돌봄과 회복 행동이 쌓입니다.',
    garden: '연락과 관계 행동이 쌓입니다.',
  };

  const facilityExamples = {
    knowledge_tower: '의자에 앉기, 공책 펴기, 한 문장 읽기',
    guild_office: '화면 열기, 첫 줄 표시, 다음 단계 적기',
    training_ground: '한 발 움직이기, 10초 스트레칭, 물 한 모금',
    workshop: '눈앞의 물건 하나 집기, 제자리에 두기',
    archive: '제목 적기, 한 문장 쓰기, 다음 문장 예약',
    inn: '한 다리 빼기, 알람 확인, 조명 낮추기',
    kitchen: '물 마시기, 약 챙기기, 쉬는 시간 정하기',
    garden: '메시지창 열기, 첫 인사 쓰기, 보낼 시간 정하기',
  };

  const facilityOrder = [
    'knowledge_tower',
    'guild_office',
    'training_ground',
    'workshop',
    'archive',
    'inn',
    'kitchen',
    'garden',
  ];

  const facilityByCategory = {
    study: 'knowledge_tower',
    work: 'guild_office',
    writing: 'archive',
    cleaning: 'workshop',
    exercise: 'training_ground',
    wake: 'inn',
    sleep: 'inn',
    life_admin: 'guild_office',
    relationship: 'garden',
  };

  function facilityKeyForCategory(category) {
    return facilityByCategory[category] || 'knowledge_tower';
  }

  function facilityInfo(value) {
    const facilityKey = facilityOrder.includes(value) ? value : facilityKeyForCategory(value);
    return {
      facilityKey,
      label: facilityLabels[facilityKey] || facilityKey,
      detail: facilityDetails[facilityKey] || '',
      example: facilityExamples[facilityKey] || '',
    };
  }

  const basicCostumes = [
    {
      id: 'starter_mage',
      name: '\uCD08\uB3D9 \uB9C8\uBC95\uC0AC',
      role: '\uC2DC\uC791 \uC7A5\uBCBD \uC81C\uAC70',
      passiveAbility: '\uC138\uC158 \uCCAB Step XP +20%',
      activeAbility: '\uCCAB \uBD88\uC528: \uD604\uC7AC Step\uC744 10\uCD08 \uC774\uD558\uB85C \uBD84\uD574',
      unlockText: '\uAE30\uBCF8 \uC9C0\uAE09',
      metric: 'always',
      target: 1,
    },
    {
      id: 'focus_archer',
      name: '\uC9D1\uC911 \uC0AC\uC218',
      role: '\uC9E7\uC740 \uC9D1\uC911',
      passiveAbility: '\uACF5\uBD80 Step \uBCF4\uC0C1 +15%',
      activeAbility: '\uC870\uC900 \uACE0\uC815: \uBC29\uD574 \uC694\uC18C \uC810\uAC80 \uD6C4 3\uBD84 Step',
      unlockText: '\uACF5\uBD80 Step 5\uD68C \uC644\uB8CC',
      metric: 'category_completed',
      category: 'study',
      target: 5,
    },
    {
      id: 'return_paladin',
      name: '\uADC0\uD658 \uC131\uAE30\uC0AC',
      role: '\uBCF5\uADC0',
      passiveAbility: '24\uC2DC\uAC04 \uC774\uC0C1 \uBE44\uD65C\uC131 \uD6C4 \uCCAB Step \uBCF4\uC0C1 +30%',
      activeAbility: '\uADC0\uD658 \uC11C\uC57D: \uC77C\uC2DC\uC815\uC9C0 Goal\uC744 5~10\uCD08 \uBCF5\uAD6C Step\uC73C\uB85C \uC7AC\uAD6C\uC131',
      unlockText: '\uBCF5\uADC0 \uC138\uC158 3\uD68C',
      metric: 'return_sessions',
      target: 3,
    },
    {
      id: 'tidy_rogue',
      name: '\uC815\uB3C8 \uB3C4\uC801',
      role: '\uCCAD\uC18C\u00B7\uC815\uB9AC',
      passiveAbility: '\uC815\uB9AC Step \uBCF4\uC0C1 +20%',
      activeAbility: '\uD55C \uCE78 \uBE44\uC6B0\uAE30: \uB208\uC55E\uC758 \uBB3C\uAC74 \uD558\uB098\uB9CC \uCE58\uC6B0\uB294 Step \uC0DD\uC131',
      unlockText: '\uC815\uB9AC Step 10\uD68C \uC644\uB8CC',
      metric: 'category_completed',
      category: 'cleaning',
      target: 10,
    },
    {
      id: 'blank_scribe',
      name: '\uBC31\uC9C0 \uAE30\uB85D\uC790',
      role: '\uAE00\uC4F0\uAE30\u00B7\uCC3D\uC791',
      passiveAbility: '\uCCAB \uBB38\uC7A5\u00B7\uCD08\uC548 Step \uBCF4\uC0C1 +20%',
      activeAbility: '\uBC31\uC9C0 \uD30C\uAD34: 3\uBD84 \uC218\uC815 \uAE08\uC9C0 \uC9D1\uD544 Step \uC0DD\uC131',
      unlockText: '\uAE00\uC4F0\uAE30 Step 10\uD68C \uC644\uB8CC',
      metric: 'category_completed',
      category: 'writing',
      target: 10,
    },
    {
      id: 'dawn_knight',
      name: '\uC0C8\uBCBD \uAE30\uC0AC',
      role: '\uAE30\uC0C1\u00B7\uC544\uCE68 \uB8E8\uD2F4',
      passiveAbility: '\uAE30\uC0C1 Step \uBCF4\uC0C1 +20%',
      activeAbility: '\uCCAB \uBC1C: \uC774\uBD88 \uBC16\uC73C\uB85C \uD55C\uCABD \uB2E4\uB9AC\uB97C \uBE7C\uB294 Step \uC0DD\uC131',
      unlockText: '\uAE30\uC0C1 Step 5\uD68C \uC644\uB8CC',
      metric: 'category_completed',
      category: 'wake',
      target: 5,
    },
  ];
  window.StepQuestSuperMode?.extendCostumes?.(basicCostumes);

  function parseJson(raw, fallback) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function readReducedMotion() {
    const saved = localStorage.getItem(motionStorageKey);
    if (saved === '1') return true;
    if (saved === '0') return false;
    return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  }

  function applyReducedMotion() {
    document.body?.classList.toggle('reduce-motion', Boolean(state.reducedMotion));
  }

  function setReducedMotion(value) {
    state.reducedMotion = Boolean(value);
    localStorage.setItem(motionStorageKey, state.reducedMotion ? '1' : '0');
    applyReducedMotion();
    return state.reducedMotion;
  }

  function normalizeLogs(value) {
    return Array.isArray(value)
      ? value.filter((item) => typeof item === 'string' && item.trim()).slice(0, 80)
      : [];
  }

  function h(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }[char]));
  }

  function log(message, needsAttention = false) {
    const text = `${needsAttention ? '\uD655\uC778 \uD544\uC694: ' : ''}${String(message || '')}`;
    if (/StepQuest API fallback|service worker/i.test(text)) return;
    const line = `[${new Date().toLocaleTimeString()}] ${text}`;
    state.logs.unshift(line);
    state.logs = state.logs.slice(0, 80);
    localStorage.setItem(logsStorageKey, JSON.stringify(state.logs));
    const el = document.getElementById('debug-log');
    if (el) el.textContent = state.logs.length ? state.logs.join('\n') : t.noLogs;
  }

  function toast(message, error = false) {
    const el = document.getElementById('app-toast');
    if (el) {
      el.textContent = message;
      el.className = error ? 'app-toast meta danger' : 'app-toast meta';
    }
    log(message, error);
  }

  function persistAuth() {
    if (state.token) localStorage.setItem(tokenStorageKey, state.token);
    else localStorage.removeItem(tokenStorageKey);
    if (state.user) localStorage.setItem(userStorageKey, JSON.stringify(state.user));
    else localStorage.removeItem(userStorageKey);
  }

  function authHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    return headers;
  }

  async function api(method, path, body, noAuth = false) {
    const response = await fetch(path, {
      method,
      headers: noAuth ? { 'Content-Type': 'application/json' } : authHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    const raw = await response.text();
    const data = parseJson(raw, raw);
    if (!response.ok) {
      const message = typeof data === 'string'
        ? data
        : Array.isArray(data.message)
          ? data.message.join(', ')
          : data.message || JSON.stringify(data);
      if (response.status === 401) {
        state.token = '';
        state.user = null;
        persistAuth();
      }
      throw new Error(`${response.status} ${message}`);
    }
    return data;
  }

  function stableId(storage, key, prefix) {
    const existing = storage.getItem(key);
    if (existing) return existing;
    const id = `${prefix}-${window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
    storage.setItem(key, id);
    return id;
  }

  const anonymousUserId = stableId(localStorage, anonymousUserStorageKey, 'anon');
  const sessionId = stableId(sessionStorage, sessionStorageKey, 'session');

  function trackProductEvent(eventName, detail = {}) {
    const payload = {
      eventName,
      anonymousUserId,
      sessionId,
      goalId: detail.goalId ? String(detail.goalId) : undefined,
      stepId: detail.stepId ? String(detail.stepId) : undefined,
      category: detail.category || undefined,
      estimatedSeconds: detail.estimatedSeconds ? Number(detail.estimatedSeconds) : undefined,
    };
    fetch('/events/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  }

  function resolveCategory(title, requested) {
    if (requested && requested !== 'auto' && templates[requested]) return requested;
    const normalized = String(title || '').toLowerCase();
    const found = categoryWords.find(([, words]) => words.some((word) => normalized.includes(word.toLowerCase())));
    return found ? found[0] : 'study';
  }

  function makeGuestVillage() {
    return facilityOrder.map((facilityKey) => ({
      ...facilityInfo(facilityKey),
      facilityKey,
      level: 1,
      xp: 0,
      material: 0,
    }));
  }

  function normalizeVillage(village) {
    const rows = Array.isArray(village) ? village : [];
    const byKey = new Map(rows.map((item) => [item.facilityKey, item]));
    return facilityOrder.map((facilityKey) => {
      const item = byKey.get(facilityKey) || {};
      const info = facilityInfo(facilityKey);
      const xp = Number(item.xp || 0);
      const level = Number(item.level || Math.floor(xp / 5) + 1);
      return {
        ...item,
        ...info,
        facilityKey,
        label: item.label || info.label,
        detail: item.detail || info.detail,
        example: item.example || info.example,
        level: Math.max(1, level),
        xp,
        material: Number(item.material || 0),
      };
    });
  }

  function growGuestVillage(guest, category, amount = 1) {
    guest.village = normalizeVillage(guest.village);
    const facilityKey = facilityKeyForCategory(category);
    const facility = guest.village.find((item) => item.facilityKey === facilityKey);
    if (!facility) return;
    const previousLevel = Number(facility.level || 1);
    facility.xp += amount;
    facility.material += 1;
    facility.level = Math.floor(facility.xp / 5) + 1;
    return {
      ...facility,
      ...facilityInfo(facilityKey),
      leveledUp: facility.level > previousLevel,
    };
  }

  function shrinkGuestVillage(guest, category, amount = 1) {
    guest.village = normalizeVillage(guest.village);
    const facilityKey = facilityKeyForCategory(category);
    const facility = guest.village.find((item) => item.facilityKey === facilityKey);
    if (!facility) return null;
    facility.xp = Math.max(0, Number(facility.xp || 0) - amount);
    facility.material = Math.max(0, Number(facility.material || 0) - 1);
    facility.level = Math.floor(facility.xp / 5) + 1;
    return {
      ...facility,
      ...facilityInfo(facilityKey),
    };
  }

  function baseXpForSeconds(seconds) {
    const value = Number(seconds || 10);
    if (value <= 10) return 1;
    if (value <= 30) return 3;
    if (value <= 120) return 5;
    if (value <= 300) return 10;
    if (value <= 900) return 20;
    if (value <= 1800) return 40;
    return 70;
  }

  function comboMultiplier(combo) {
    const value = Number(combo || 0);
    if (value >= 5) return 1.2;
    if (value >= 3) return 1.1;
    return 1;
  }

  function costumeRewardMultiplier(costumeId, step, combo = 0, isReturnStep = false) {
    const superMultiplier = window.StepQuestSuperMode?.costumeRewardMultiplier?.(costumeId, step, combo, isReturnStep);
    if (Number(superMultiplier || 0) > 0) return Number(superMultiplier);
    const category = step?.category || 'study';
    if (costumeId === 'starter_mage' && Number(combo || 0) <= 1) return 1.2;
    if (costumeId === 'focus_archer' && category === 'study') return 1.15;
    if (costumeId === 'return_paladin' && isReturnStep) return 1.3;
    if (costumeId === 'tidy_rogue' && category === 'cleaning') return 1.2;
    if (costumeId === 'blank_scribe' && category === 'writing') return 1.2;
    if (costumeId === 'dawn_knight' && category === 'wake') return 1.2;
    return 1;
  }

  function rewardForStep(step, combo = state.sessionCombo || 0, guest = null, isReturnStep = false) {
    const base = baseXpForSeconds(step?.estimatedSeconds || 10);
    const equipped = guest?.equippedCostumeId || state.player?.equippedCostumeId || 'starter_mage';
    const costumeMultiplier = costumeRewardMultiplier(equipped, step, combo, isReturnStep);
    const multiplier = comboMultiplier(combo) * costumeMultiplier * (isReturnStep ? 1.3 : 1);
    const xp = Math.max(1, Math.round(base * multiplier));
    const facilityXp = Math.max(1, Math.round(base * 0.8));
    return {
      xp,
      material: facilityXp,
      facilityXp,
      comboMultiplier: comboMultiplier(combo),
      costumeMultiplier,
    };
  }

  function shrinkReasonInfo(reason = 'too_big') {
    return {
      too_big: {
        label: '너무 크다',
        strategy: '장소 보기와 손 움직이기처럼 몸이 바로 할 수 있는 단계로 낮췄습니다.',
        titles: [
          '그 행동을 할 곳 보기',
          '손을 가까이 가져가기',
          '10초만 시작하기',
        ],
      },
      no_material: {
        label: '준비물이 없다',
        strategy: '준비물 찾기 자체를 첫 행동으로 바꿨습니다.',
        titles: [
          '필요한 것 위치 보기',
          '필요한 것 하나만 앞에 두기',
          '10초만 시작하기',
        ],
      },
      unclear: {
        label: '애매하다',
        strategy: '생각을 끝내려 하지 않고 다음 단어 하나만 정하게 바꿨습니다.',
        titles: [
          '현재 행동 제목 보기',
          '뭐를 할지 한 단어로 적기',
          '10초만 시작하기',
        ],
      },
      tired: {
        label: '피곤하다',
        strategy: '수행 대신 몸을 낮은 에너지 상태로 진입시키는 단계로 바꿨습니다.',
        titles: [
          '숨 한 번 쉬기',
          '몸을 편한 쪽으로 기대기',
          '10초만 바라보기',
        ],
      },
      wrong_place: {
        label: '장소가 안 맞다',
        strategy: '이동 완료가 아니라 방향 확인과 첫 움직임만 남겼습니다.',
        titles: [
          '할 곳 한 번 보기',
          '그 방향으로 몸 돌리기',
          '이동 준비 하나 하기',
        ],
      },
      not_now: {
        label: '지금은 아니다',
        strategy: '포기 처리 대신 돌아올 수 있는 5초짜리 입구로 바꿨습니다.',
        titles: [
          '멈춘 행동 제목 한 번 보기',
          '다시 볼 시간 하나 정하기',
          '5초만 돌아오기',
        ],
      },
      costume_active: {
        label: '코스튬 능력',
        strategy: '장착한 코스튬 능력에 맞춰 첫 진입 장벽을 낮췄습니다.',
        titles: [
          '현재 행동 제목 보기',
          '가장 작은 시작만 고르기',
          '10초만 시작하기',
        ],
      },
    }[reason] || {
      label: '막힘',
      strategy: '현재 단계보다 더 작고 관찰 가능한 입구로 바꿨습니다.',
      titles: [
        '그 행동을 할 곳 보기',
        '손을 가까이 가져가기',
        '10초만 시작하기',
      ],
    };
  }

  function costumeProgressValue(costume, guest) {
    if (costume.metric === 'always') return costume.target || 1;
    if (costume.metric === 'return_sessions') return (guest.returnSessions || []).length;
    const done = (guest.micro || []).filter((item) => item.status === 'DONE');
    if (costume.metric === 'category_completed') {
      return done.filter((item) => item.category === costume.category).length;
    }
    return done.length;
  }

  function buildCostumes(guest) {
    const equippedId = guest.equippedCostumeId || 'starter_mage';
    return basicCostumes.map((costume) => {
      const current = costumeProgressValue(costume, guest);
      const target = costume.target || 1;
      const unlocked = costume.metric === 'always' || current >= target;
      const xp = costume.metric === 'always'
        ? (guest.micro || []).filter((item) => item.status === 'DONE').length
        : current;
      return {
        ...costume,
        ability: costume.activeAbility,
        activeCharge: costumeActiveCharge(guest, costume.id),
        unlocked,
        equipped: costume.id === equippedId,
        level: Math.floor(xp / 5) + 1,
        xp,
        progress: {
          current: Math.min(current, target),
          target,
          percent: Math.min(100, Math.round((current / Math.max(target, 1)) * 100)),
        },
      };
    });
  }

  function costumeActiveCharge(guest, costumeId) {
    const attempts = (guest?.attempts || []).slice();
    const lastUse = attempts
      .filter((attempt) => attempt.action === 'costume_active' && attempt.reason === costumeId)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];
    if (!lastUse) {
      return {
        available: true,
        completedSinceUse: costumeActiveRechargeSteps,
        required: costumeActiveRechargeSteps,
        remaining: 0,
        lastUsedAt: null,
      };
    }
    const completedSinceUse = attempts.filter((attempt) =>
      attempt.action === 'complete' && String(attempt.createdAt || '') > String(lastUse.createdAt || ''),
    ).length;
    const remaining = Math.max(0, costumeActiveRechargeSteps - completedSinceUse);
    return {
      available: remaining === 0,
      completedSinceUse,
      required: costumeActiveRechargeSteps,
      remaining,
      lastUsedAt: lastUse.createdAt || null,
    };
  }

  function assertGuestCostumeActiveAvailable(guest, costumeId) {
    const charge = costumeActiveCharge(guest, costumeId);
    if (!charge.available) {
      throw new Error(`\uCF54\uC2A4\uD2AC \uB2A5\uB825\uC740 ${charge.remaining}\uAC1C \uD589\uB3D9\uC744 \uB354 \uC644\uB8CC\uD558\uBA74 \uB2E4\uC2DC \uCDA9\uC804\uB429\uB2C8\uB2E4.`);
    }
    return charge;
  }

  function costumeName(costumeId, costumes = state.shop) {
    return (costumes || []).find((costume) => costume.id === costumeId)?.name
      || basicCostumes.find((costume) => costume.id === costumeId)?.name
      || t.guestRunner;
  }

  function costumeInfo(costumeId, costumes = state.shop) {
    return (costumes || []).find((costume) => costume.id === costumeId)
      || basicCostumes.find((costume) => costume.id === costumeId)
      || null;
  }

  function guestDefault() {
    return {
      player: {
        nickname: t.guestRunner,
        level: 1,
        goalCoin: 0,
        totalExp: 0,
        equippedCostumeName: t.guestRunner,
      },
      consistency: {
        currentStreakDays: 0,
        consistencyScore: 0,
      },
      weekly: [],
      micro: [],
      nextMicro: null,
      attempts: [],
      costumes: basicCostumes,
      equippedCostumeId: 'starter_mage',
      stoppedAt: null,
      returnSessions: [],
      reminder: null,
      reminderDue: false,
      village: makeGuestVillage(),
      sessionCombo: 0,
      comboChestCount: 0,
      gameEvent: null,
    };
  }

  function migrateGuest(guest) {
    const oldNotebookTitle = '\uACF5\uCC45\uC744 \uD3BC\uAE30';
    const newNotebookTitle = '\uACF5\uCC45 \uD3B4\uAE30';
    guest.micro = (guest.micro || []).map((item) => ({
      ...item,
      title: item.title === oldNotebookTitle ? newNotebookTitle : item.title,
    }));
    guest.village = normalizeVillage(guest.village);
    guest.equippedCostumeId = guest.equippedCostumeId || 'starter_mage';
    guest.sessionCombo = Number(guest.sessionCombo || 0);
    guest.comboChestCount = Number(guest.comboChestCount || 0);
    guest.gameEvent = guest.gameEvent || null;
    guest.costumes = buildCostumes(guest);
    guest.player = guest.player || guestDefault().player;
    guest.player.equippedCostumeName = costumeName(guest.equippedCostumeId, guest.costumes);
    return guest;
  }

  function loadGuest() {
    const saved = parseJson(localStorage.getItem(guestStorageKey), null);
    return migrateGuest(saved ? { ...guestDefault(), ...saved } : guestDefault());
  }

  function saveGuest(guest) {
    localStorage.setItem(guestStorageKey, JSON.stringify(guest));
  }

  function hasGuestProgress(guest) {
    return Boolean(
      (guest.weekly || []).length
      || (guest.micro || []).length
      || (guest.attempts || []).length
      || Number(guest.player?.totalExp || 0) > 0
      || Number(guest.player?.goalCoin || 0) > 0,
    );
  }

  function guestMigrationId(guest) {
    if (guest.migrationId) return guest.migrationId;
    const randomId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    guest.migrationId = `guest-${randomId}`;
    saveGuest(guest);
    return guest.migrationId;
  }

  async function maybeImportGuestProgress() {
    if (!state.token) return null;
    const guest = loadGuest();
    if (!hasGuestProgress(guest) || guest.migratedAt) return null;

    const migrationId = guestMigrationId(guest);
    let result = await api('POST', '/stepquest/guest/import', { migrationId, guestState: guest });
    if (result.status === 'needs_choice') {
      const choice = window.confirm(t.guestImportChoice) ? 'import_guest' : 'keep_account';
      result = await api('POST', '/stepquest/guest/import', { migrationId, guestState: guest, choice });
    }

    if (result.status === 'imported' || result.status === 'skipped') {
      guest.migratedAt = result.migratedAt || new Date().toISOString();
      saveGuest(guest);
      if (result.status === 'imported') {
        trackProductEvent('guest_import_completed');
      }
      toast(result.status === 'imported' ? t.guestImported : t.guestKeptAccount);
    }
    return result;
  }

  function syncGuest(guest = loadGuest()) {
    state.player = guest.player;
    state.consistency = guest.consistency;
    state.weekly = guest.weekly || [];
    state.micro = guest.micro || [];
    const activeWeeklyIds = new Set(state.weekly.filter((item) => item.status === 'ACTIVE').map((item) => item.id));
    state.nextMicro = state.micro.find((item) => item.status === 'OPEN' && activeWeeklyIds.has(item.weeklyMissionId)) || null;
    state.deferredStep = null;
    state.dungeons = buildGuestDungeons(guest);
    guest.costumes = buildCostumes(guest);
    guest.player.equippedCostumeName = costumeName(guest.equippedCostumeId, guest.costumes);
    state.shop = guest.costumes;
    state.stats = computeGuestStats(guest);
    state.returnInfo = computeGuestReturnInfo(guest);
    state.reminder = guest.reminder || null;
    state.reminderDue = Boolean(guest.reminderDue);
    state.village = normalizeVillage(guest.village);
    state.sessionCombo = Number(guest.sessionCombo || 0);
    state.gameEvent = guest.gameEvent || null;
    return guest;
  }

  function computeGuestStats(guest) {
    const attempts = (guest.attempts || []).reduce((memo, item) => {
      memo[item.action] = (memo[item.action] || 0) + 1;
      return memo;
    }, {});
    const recent = (guest.attempts || []).slice(-6).reverse().map((item, index) => {
      const step = (guest.micro || []).find((micro) => String(micro.id) === String(item.stepId));
      const goal = step ? (guest.weekly || []).find((weekly) => weekly.id === step.weeklyMissionId) : null;
      return {
        id: item.id || `${item.stepId || 'guest'}-${index}`,
        stepId: item.stepId,
        action: item.action,
        reason: item.reason || null,
        createdAt: item.createdAt,
        stepTitle: step?.title || item.stepTitle || t.noNextAction,
        goalTitle: goal?.title || '',
      };
    });
    return {
      attempts,
      steps: {
        totalSteps: (guest.micro || []).length,
        completedSteps: (guest.micro || []).filter((item) => item.status === 'DONE').length,
        replacedSteps: (guest.micro || []).filter((item) => item.status === 'REPLACED').length,
        skippedSteps: (guest.micro || []).filter((item) => item.status === 'SKIPPED').length,
      },
      rewards: {
        xp: guest.player?.totalExp || 0,
        facility_xp: guest.player?.goalCoin || 0,
        return_mark: guest.player?.returnMarks || 0,
      },
      recent,
    };
  }

  function computeGuestReturnInfo(guest) {
    const stoppedAt = guest.stoppedAt ? Date.parse(guest.stoppedAt) : 0;
    const inactiveHours = stoppedAt ? Math.max(0, (Date.now() - stoppedAt) / 36e5) : 0;
    const eligible = inactiveHours >= 24;
    return {
      eligible,
      inactiveHours,
      message: eligible ? t.returned : t.subtitle,
    };
  }

  function dungeonTheme(category) {
    return {
      study: 'library_ruins',
      work: 'guild_contract',
      writing: 'blank_archive',
      cleaning: 'dust_workshop',
      exercise: 'training_field',
      wake: 'dawn_gate',
      sleep: 'quiet_inn',
      life_admin: 'paper_citadel',
      relationship: 'message_garden',
    }[category] || 'library_ruins';
  }

  function buildGuestDungeons(guest) {
    return (guest.weekly || [])
      .filter((goal) => goal.status !== 'ARCHIVED')
      .map((goal) => {
        const activeRevision = Number(goal.activeRevision || 1);
        const steps = (guest.micro || []).filter((step) =>
          step.weeklyMissionId === goal.id && Number(step.chainRevision || 1) === activeRevision,
        );
        const completed = steps.filter((step) => step.status === 'DONE');
        const lastCompletedStep = completed.length
          ? completed.slice().sort((a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || '')))[0]
          : null;
        const nextStep = steps.find((step) => step.status === 'OPEN') || steps.find((step) => step.status === 'PENDING') || null;
        const total = Math.max(steps.length, goal.targetCount || 1);
        const progress = Math.round((completed.length / total) * 100);
        return {
          goalId: goal.id,
          name: `${goal.title} \uC6D0\uC815`,
          title: goal.title,
          category: goal.category || 'study',
          status: goal.status === 'PAUSED' ? 'paused' : goal.status === 'DONE' ? 'cleared' : 'active',
          progress,
          totalSteps: total,
          completedSteps: completed.length,
          skippedSteps: steps.filter((step) => step.status === 'SKIPPED').length,
          themeKey: dungeonTheme(goal.category || 'study'),
          lastCompletedStep: lastCompletedStep ? { title: lastCompletedStep.title, completedAt: lastCompletedStep.completedAt } : null,
          nextStep: nextStep ? { id: nextStep.id, title: nextStep.title, estimatedSeconds: nextStep.estimatedSeconds } : null,
        };
      });
  }

  function obstacleCap(obstacle) {
    if (['too_big', 'tired', 'anxious', 'not_now', 'forgot'].includes(obstacle)) return 5;
    if (['no_material', 'unclear', 'wrong_place'].includes(obstacle)) return 10;
    return 30;
  }

  function availableCap(minutes) {
    const value = Number(minutes || 0);
    if (!value) return 30;
    if (value <= 3) return 5;
    if (value <= 10) return 10;
    return 30;
  }

  function personalizeGuestSource(source, input) {
    const prefix = [];
    if (input.location) prefix.push(`${input.location} \uBC29\uD5A5 \uBCF4\uAE30`);
    if (input.obstacle === 'wrong_place') prefix.push('\uD560 \uACF3 \uD55C \uBC88 \uBCF4\uAE30');
    if (input.obstacle === 'no_material') prefix.push('\uD544\uC694\uD55C \uAC83 \uD558\uB098 \uC774\uB984 \uC801\uAE30');
    if (input.obstacle === 'unclear') prefix.push('\uB2E4\uC74C \uD560 \uB2E8\uC5B4 \uD558\uB098 \uC801\uAE30');
    if (input.obstacle === 'tired' || input.obstacle === 'anxious') prefix.push('\uC228 \uD55C \uBC88 \uC26C\uAE30');
    return [...prefix, ...source].filter((title, index, all) => all.indexOf(title) === index).slice(0, 8);
  }

  function makeGuestGoal(input) {
    const now = new Date().toISOString();
    const category = resolveCategory(input.title, input.category);
    const source = personalizeGuestSource(templates[category] || templates.study, input);
    const firstCap = Math.min(
      input.energyLevel === 'low' || Number(input.burdenLevel) >= 4 ? 5 : 10,
      obstacleCap(input.obstacle),
      availableCap(input.availableMinutes),
    );
    const weeklyId = Date.now();
    const weekly = {
      id: weeklyId,
      visionGoalId: weeklyId,
      userId: 'guest',
      title: input.title,
      weekStartDate: now.slice(0, 10),
      weekEndDate: now.slice(0, 10),
      targetCount: source.length,
      completedCount: 0,
      category,
      targetAt: input.targetAt || null,
      recurrenceRule: input.recurrenceRule || null,
      location: input.location || null,
      availableMinutes: input.availableMinutes || null,
      obstacle: input.obstacle || null,
      burdenLevel: input.burdenLevel || 4,
      energyLevel: input.energyLevel || 'medium',
      activeRevision: 1,
      status: 'ACTIVE',
      createdAt: now,
      completedAt: null,
    };
    const micro = source.map((title, index) => ({
      id: weeklyId + index + 1,
      userId: 'guest',
      weeklyMissionId: weeklyId,
      title,
      estimatedSeconds: index === 0 ? firstCap : (title.includes('10') ? 10 : 30),
      difficulty: index < 2 ? 1 : 2,
      category,
      chainRevision: 1,
      status: index === 0 ? 'OPEN' : 'PENDING',
      createdAt: now,
      completedAt: null,
    }));
    return { weekly, micro };
  }

  function makeReplacementSteps(baseStep, reason, now) {
    const titles = shrinkReasonInfo(reason).titles;
    return titles.map((title, index) => ({
      id: Number(`${baseStep.id}${index + 1}${String(Date.now()).slice(-3)}`),
      userId: 'guest',
      weeklyMissionId: baseStep.weeklyMissionId,
      title,
      estimatedSeconds: index === 0 ? 5 : 10,
      difficulty: 1,
      category: baseStep.category || 'study',
      status: index === 0 ? 'OPEN' : 'PENDING',
      createdAt: now,
      completedAt: null,
    }));
  }

  function mapUser(rawUser) {
    if (!rawUser) return state.player;
    return {
      ...rawUser,
      nickname: rawUser.nickname || state.user?.nickname || t.guestRunner,
      level: rawUser.level || 1,
      goalCoin: rawUser.goalCoin ?? rawUser.material ?? 0,
      totalExp: rawUser.totalExp ?? rawUser.xp ?? 0,
      equippedCostumeId: rawUser.equippedCostumeId || 'starter_mage',
      equippedCostumeName: rawUser.equippedCostumeName || costumeName(rawUser.equippedCostumeId || 'starter_mage'),
    };
  }

  function mapCurrent(data) {
    const step = data.currentStep || data.firstStep || data.step || null;
    const deferredStep = data.deferredStep || null;
    state.player = mapUser(data.user) || state.player || {
      nickname: state.user?.nickname || t.guestRunner,
      level: 1,
      goalCoin: 0,
      equippedCostumeName: t.guestRunner,
    };
    state.consistency = data.consistency || state.consistency || {
      currentStreakDays: 0,
      consistencyScore: 0,
    };
    state.weekly = data.chain ? [{
      id: data.chain.chainId || data.chain.id,
      title: data.chain.goalTitle || data.chain.title || data.goal?.title,
      targetCount: data.chain.totalSteps || 1,
      completedCount: data.chain.completedSteps || 0,
      status: data.chain.status || 'ACTIVE',
    }] : data.goal ? [{
      id: data.goal.id,
      title: data.goal.title,
      targetCount: (data.steps || []).length || 1,
      completedCount: 0,
      status: data.goal.status || 'ACTIVE',
    }] : [];
    state.micro = (data.steps || []).map((item) => ({
      id: item.stepId || item.id,
      title: item.title,
      estimatedSeconds: item.estimatedSeconds || item.seconds || 10,
      difficulty: item.difficulty || 1,
      status: item.status === 'active' ? 'OPEN' : item.status === 'completed' ? 'DONE' : item.status === 'skipped' ? 'SKIPPED' : item.status || 'OPEN',
      category: item.category || data.currentStep?.category || data.goal?.category || 'study',
    }));
    state.nextMicro = step ? {
      id: step.stepId || step.id,
      title: step.title,
      estimatedSeconds: step.estimatedSeconds || step.seconds || 10,
      difficulty: step.difficulty || 1,
      category: step.category || data.goal?.category || 'study',
      status: 'OPEN',
    } : (state.micro.find((item) => item.status === 'OPEN') || null);
    state.deferredStep = !state.nextMicro && deferredStep ? {
      id: deferredStep.stepId || deferredStep.id,
      title: deferredStep.title,
      estimatedSeconds: deferredStep.estimatedSeconds || deferredStep.seconds || 10,
      difficulty: deferredStep.difficulty || 1,
      category: deferredStep.category || data.goal?.category || 'study',
      status: 'DEFERRED',
      deferredAt: deferredStep.deferredAt || null,
    } : null;
    if (state.nextMicro && !state.micro.some((item) => item.id === state.nextMicro.id)) {
      state.micro.unshift(state.nextMicro);
    }
    state.village = normalizeVillage(data.village || state.village);
  }

  async function hydrateStepQuest() {
    const [current, stats, returnInfo, reminder, costumes, dungeons] = await Promise.all([
      api('GET', '/stepquest/current'),
      api('GET', '/stepquest/stats'),
      api('GET', '/stepquest/return/eligibility'),
      api('GET', '/stepquest/reminder'),
      api('GET', '/stepquest/costumes'),
      api('GET', '/stepquest/dungeons'),
    ]);
    mapCurrent(current);
    state.stats = stats;
    state.returnInfo = returnInfo;
    state.reminder = reminder?.enabled ? reminder : null;
    state.dungeons = dungeons || [];
    state.shop = costumes || [];
    if (state.player) {
      state.player.equippedCostumeName = costumeName(state.player.equippedCostumeId || 'starter_mage', state.shop);
    }
    state.skills = [];
    state.battle = null;
  }

  async function hydrateLegacy() {
    const [player, consistency, vision, weekly] = await Promise.all([
      api('GET', '/player/me'),
      api('GET', '/consistency/me'),
      api('GET', '/goals/vision'),
      api('GET', '/goals/weekly'),
    ]);
    const firstWeekly = weekly[0];
    const micro = firstWeekly ? await api('GET', `/goals/weekly/${firstWeekly.id}/micro`) : [];
    let nextMicro = null;
    try {
      nextMicro = await api('GET', '/actions/next-micro');
    } catch {
      nextMicro = micro.find((item) => item.status === 'OPEN') || null;
    }
    state.player = player;
    state.consistency = consistency;
    state.vision = vision;
    state.weekly = weekly;
    state.micro = micro;
    state.nextMicro = nextMicro;
    state.deferredStep = null;
    state.stats = null;
    state.returnInfo = null;
  }

  async function refresh() {
    if (!state.token) {
      syncGuest();
      return;
    }
    try {
      await hydrateStepQuest();
    } catch (error) {
      log(`StepQuest API fallback: ${error.message}`);
      await hydrateLegacy();
    }
  }

  async function createStepQuestGoal(input) {
    if (!state.token) {
      const guest = loadGuest();
      const made = makeGuestGoal(input);
      guest.weekly = [made.weekly];
      guest.micro = made.micro;
      guest.nextMicro = made.micro[0] || null;
      guest.sessionCombo = 0;
      guest.gameEvent = null;
      saveGuest(guest);
      syncGuest(guest);
      trackProductEvent('goal_created', { goalId: made.weekly.id, category: made.weekly.category });
      if (made.micro[0]) {
        trackProductEvent('first_step_shown', {
          goalId: made.weekly.id,
          stepId: made.micro[0].id,
          category: made.micro[0].category,
          estimatedSeconds: made.micro[0].estimatedSeconds,
        });
      }
      return made;
    }
    const result = await api('POST', '/stepquest/goals', input);
    mapCurrent(result);
    state.sessionCombo = 0;
    state.gameEvent = null;
    trackProductEvent('goal_created', { goalId: result.goal?.id, category: result.goal?.category });
    if (result.firstStep) {
      trackProductEvent('first_step_shown', {
        goalId: result.goal?.id,
        stepId: result.firstStep.id,
        category: result.goal?.category,
        estimatedSeconds: result.firstStep.estimatedSeconds,
      });
    }
    return result;
  }

  async function completeMicro(id) {
    if (!state.token) {
      const guest = loadGuest();
      const step = guest.micro.find((item) => String(item.id) === String(id));
      if (step) {
        step.status = 'DONE';
        step.completedAt = new Date().toISOString();
        guest.attempts = guest.attempts || [];
        guest.attempts.push({ stepId: step.id, action: 'complete', createdAt: step.completedAt });
        guest.weekly = guest.weekly.map((item) => {
          const activeRevision = Number(item.activeRevision || 1);
          return {
            ...item,
            completedCount: guest.micro.filter((micro) =>
              micro.weeklyMissionId === item.id
                && Number(micro.chainRevision || 1) === activeRevision
                && micro.status === 'DONE',
            ).length,
          };
        });
        const hasOpenStep = guest.micro.some((micro) => micro.status === 'OPEN');
        if (!hasOpenStep) {
          const nextStep = guest.micro.find((micro) => micro.status === 'PENDING');
          if (nextStep) nextStep.status = 'OPEN';
        }
        guest.sessionCombo = Number(guest.sessionCombo || 0) + 1;
        const returnSession = (guest.returnSessions || []).find((session) =>
          String(session.recoveryStepId) === String(step.id) && !session.completedAt,
        );
        const reward = rewardForStep(step, guest.sessionCombo, guest, Boolean(returnSession));
        step.rewardSnapshot = {
          xp: reward.xp,
          material: reward.material,
          facilityXp: reward.facilityXp,
          facilityKey: facilityKeyForCategory(step.category || guest.weekly[0]?.category || 'study'),
          costumeMultiplier: reward.costumeMultiplier,
        };
        if (returnSession) returnSession.completedAt = step.completedAt;
        guest.player.goalCoin += reward.material;
        guest.player.totalExp += reward.xp;
        guest.player.returnMarks = guest.player.returnMarks || 0;
        guest.player.level = Math.floor(guest.player.totalExp / 50) + 1;
        const grownFacility = growGuestVillage(guest, step.category || guest.weekly[0]?.category || 'study', reward.facilityXp);
        guest.consistency.currentStreakDays = Math.max(1, guest.consistency.currentStreakDays || 0);
        guest.consistency.consistencyScore = Math.min(100, guest.consistency.consistencyScore + 8);
        const goal = guest.weekly.find((item) => item.id === step.weeklyMissionId) || guest.weekly[0] || null;
        const activeRevision = Number(goal?.activeRevision || step.chainRevision || 1);
        const total = Math.max((guest.micro || []).filter((item) =>
          item.weeklyMissionId === step.weeklyMissionId && Number(item.chainRevision || 1) === activeRevision,
        ).length, goal?.targetCount || 1);
        const completed = (guest.micro || []).filter((item) =>
          item.weeklyMissionId === step.weeklyMissionId
            && Number(item.chainRevision || 1) === activeRevision
            && item.status === 'DONE',
        ).length;
        if (goal && completed >= total) {
          goal.status = 'DONE';
          goal.completedAt = step.completedAt;
        }
        const chestReady = guest.sessionCombo > 0 && guest.sessionCombo % 8 === 0;
        if (chestReady) {
          guest.comboChestCount = Number(guest.comboChestCount || 0) + 1;
          guest.player.goalCoin += 5;
        }
        const next = guest.micro.find((micro) =>
          micro.status === 'OPEN'
            && micro.weeklyMissionId === step.weeklyMissionId
            && Number(micro.chainRevision || 1) === activeRevision,
        ) || null;
        guest.gameEvent = {
          type: 'complete',
          stepId: step.id,
          stepTitle: step.title,
          nextStepTitle: next?.title || '',
          clearedGoalTitle: goal && completed >= total ? goal.title : '',
          returnCompleted: Boolean(returnSession),
          xp: reward.xp,
          material: reward.material + (chestReady ? 5 : 0),
          facilityXp: reward.facilityXp,
          facilityKey: grownFacility?.facilityKey || facilityInfo(step.category || 'study').facilityKey,
          facilityLabel: grownFacility?.label || facilityInfo(step.category || 'study').label,
          facilityLevel: grownFacility?.level || 1,
          facilityDetail: grownFacility?.detail || facilityInfo(step.category || 'study').detail,
          facilityExample: grownFacility?.example || facilityInfo(step.category || 'study').example,
          facilityLeveledUp: Boolean(grownFacility?.leveledUp),
          combo: guest.sessionCombo,
          comboMultiplier: reward.comboMultiplier,
          costumeMultiplier: reward.costumeMultiplier,
          dungeonProgress: Math.round((completed / total) * 100),
          chestReady,
          createdAt: step.completedAt,
        };
      }
      saveGuest(guest);
      syncGuest(guest);
      trackProductEvent('step_completed', {
        goalId: step?.weeklyMissionId,
        stepId: step?.id,
        category: step?.category,
        estimatedSeconds: step?.estimatedSeconds,
      });
      if (guest.gameEvent?.returnCompleted) trackProductEvent('return_completed', { stepId: step?.id, category: step?.category });
      if (guest.gameEvent?.clearedGoalTitle) trackProductEvent('goal_cleared', { goalId: step?.weeklyMissionId, category: step?.category });
      return { message: t.completed, step, reward: guest.gameEvent };
    }
    const current = state.nextMicro;
    const key = `web:${id}:complete`;
    const result = await api('POST', `/stepquest/steps/${id}/complete?idempotencyKey=${encodeURIComponent(key)}`);
    await refresh();
    state.sessionCombo = Number(result.sessionCombo || state.sessionCombo || 0);
    const facility = facilityInfo(current?.category || 'study');
    const villageFacility = (state.village || []).find((item) => item.facilityKey === facility.facilityKey);
    state.gameEvent = {
      type: 'complete',
      stepTitle: current?.title || '',
      xp: result.reward?.xp || 1,
      material: (result.reward?.facilityXp || 1) + (result.comboBonus || 0),
      facilityXp: result.reward?.facilityXp || 1,
      facilityKey: facility.facilityKey,
      facilityLabel: villageFacility?.label || facility.label,
      facilityLevel: villageFacility?.level || 1,
      facilityDetail: villageFacility?.detail || facility.detail,
      facilityExample: villageFacility?.example || facility.example,
      facilityLeveledUp: false,
      combo: state.sessionCombo,
      comboMultiplier: comboMultiplier(state.sessionCombo),
      costumeMultiplier: result.costumeMultiplier || 1,
      nextStepTitle: result.currentStep?.title || state.nextMicro?.title || '',
      clearedGoalTitle: result.clearedGoal?.title || '',
      dungeonProgress: result.clearedGoal ? 100 : (state.dungeons || [])[0]?.progress || 0,
      chestReady: Boolean(result.comboBonus),
      returnCompleted: Boolean(result.returnCompleted),
      createdAt: new Date().toISOString(),
    };
    trackProductEvent('step_completed', {
      stepId: id,
      category: current?.category,
      estimatedSeconds: current?.estimatedSeconds,
    });
    if (result.returnCompleted) trackProductEvent('return_completed', { stepId: id, category: current?.category });
    if (result.clearedGoal) trackProductEvent('goal_cleared', { goalId: result.clearedGoal.id, category: result.clearedGoal.category });
    return result;
  }

  async function undoMicro(id) {
    if (!state.token) {
      const guest = loadGuest();
      const index = guest.micro.findIndex((item) => String(item.id) === String(id) && item.status === 'DONE');
      if (index < 0) throw new Error('\uB418\uB3CC\uB9B4 \uC644\uB8CC \uD589\uB3D9\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.');
      const step = guest.micro[index];
      const laterProgress = guest.micro
        .slice(index + 1)
        .some((item) => item.weeklyMissionId === step.weeklyMissionId && ['DONE', 'SKIPPED', 'REPLACED'].includes(item.status));
      if (laterProgress) throw new Error('\uBC29\uAE08 \uC644\uB8CC\uD55C \uD589\uB3D9\uB9CC \uB418\uB3CC\uB9B4 \uC218 \uC788\uC2B5\uB2C8\uB2E4.');

      const active = guest.micro.find((item) => item.weeklyMissionId === step.weeklyMissionId && item.status === 'OPEN');
      if (active) active.status = 'PENDING';
      step.status = 'OPEN';
      step.completedAt = null;
      const snapshot = step.rewardSnapshot || rewardForStep(step, Math.max(1, guest.sessionCombo || 1));
      guest.player.totalExp = Math.max(0, Number(guest.player.totalExp || 0) - Number(snapshot.xp || 0));
      guest.player.goalCoin = Math.max(0, Number(guest.player.goalCoin || 0) - Number(snapshot.material || snapshot.facilityXp || 0));
      guest.player.level = Math.floor(guest.player.totalExp / 50) + 1;
      guest.sessionCombo = Math.max(0, Number(guest.sessionCombo || 0) - 1);
      shrinkGuestVillage(guest, step.category || guest.weekly[0]?.category || 'study', Number(snapshot.facilityXp || 1));
      delete step.rewardSnapshot;
      const goal = guest.weekly.find((item) => item.id === step.weeklyMissionId) || guest.weekly[0] || null;
      if (goal) {
        goal.status = 'ACTIVE';
        goal.completedAt = null;
        goal.completedCount = guest.micro.filter((micro) => micro.weeklyMissionId === goal.id && micro.status === 'DONE').length;
      }
      guest.attempts = guest.attempts || [];
      guest.attempts.push({ stepId: step.id, action: 'undo', createdAt: new Date().toISOString() });
      guest.gameEvent = {
        type: 'undo',
        stepId: step.id,
        stepTitle: step.title,
        reversedXp: Number(snapshot.xp || 0),
        reversedMaterial: Number(snapshot.material || snapshot.facilityXp || 0),
        nextStepTitle: step.title,
        createdAt: new Date().toISOString(),
      };
      saveGuest(guest);
      syncGuest(guest);
      trackProductEvent('step_undone', {
        goalId: step.weeklyMissionId,
        stepId: step.id,
        category: step.category,
        estimatedSeconds: step.estimatedSeconds,
      });
      return { message: t.undone, step };
    }
    const result = await api('POST', `/stepquest/steps/${id}/undo`);
    await refresh();
    state.gameEvent = {
      type: 'undo',
      stepId: id,
      stepTitle: result.currentStep?.title || '',
      reversedXp: result.reversedReward?.xp || 0,
      reversedMaterial: result.reversedReward?.facilityXp || 0,
      nextStepTitle: result.currentStep?.title || '',
      createdAt: new Date().toISOString(),
    };
    state.sessionCombo = Math.max(0, Number(state.sessionCombo || 0) - 1);
    trackProductEvent('step_undone', { stepId: id });
    return result;
  }

  async function startReturnFlow(sourceCostumeId = '') {
    if (!state.token) {
      const guest = loadGuest();
      const current = guest.micro.find((item) => item.status === 'OPEN');
      const now = new Date().toISOString();
      if (current) current.status = 'PENDING';
      const baseId = Date.now();
      const recovery = {
        id: baseId,
        userId: 'guest',
        weeklyMissionId: current?.weeklyMissionId || guest.weekly[0]?.id || baseId,
        title: '\uC9C0\uB09C \uBAA9\uD45C \uC81C\uBAA9 \uD55C \uBC88 \uBCF4\uAE30',
        estimatedSeconds: 5,
        difficulty: 1,
        category: current?.category || guest.weekly[0]?.category || 'study',
        status: 'OPEN',
        createdAt: now,
        completedAt: null,
      };
      guest.micro.unshift(recovery);
      guest.returnSessions = guest.returnSessions || [];
      guest.returnSessions.push({ id: baseId, recoveryStepId: recovery.id, startedAt: now });
      guest.attempts = guest.attempts || [];
      guest.attempts.push({ stepId: recovery.id, action: 'return', createdAt: now });
      if (sourceCostumeId) {
        guest.attempts.push({ stepId: recovery.id, action: 'costume_active', reason: sourceCostumeId, createdAt: now });
      }
      guest.player.returnMarks = (guest.player.returnMarks || 0) + 1;
      guest.stoppedAt = null;
      guest.sessionCombo = 0;
      guest.gameEvent = {
        type: 'return',
        stepTitle: recovery.title,
        xp: 0,
        material: 0,
        facilityXp: 0,
        combo: 0,
        dungeonProgress: buildGuestDungeons(guest)[0]?.progress || 0,
        chestReady: false,
        createdAt: now,
      };
      saveGuest(guest);
      syncGuest(guest);
      trackProductEvent('return_started', {
        goalId: recovery.weeklyMissionId,
        stepId: recovery.id,
        category: recovery.category,
        estimatedSeconds: recovery.estimatedSeconds,
      });
      return { message: t.returned, recoveryStep: recovery };
    }
    const result = await api('POST', '/stepquest/return/start');
    await refresh();
    trackProductEvent('return_started', {
      goalId: result.restoredGoalId,
      stepId: result.firstStep?.id,
      estimatedSeconds: result.firstStep?.estimatedSeconds,
    });
    return result;
  }

  function armLocalReminder(reminder) {
    if (!reminder?.at) return;
    const delay = Date.parse(reminder.at) - Date.now();
    if (delay <= 0 || delay > 2147483647) return;
    window.clearTimeout(window.__stepquestReminderTimer);
    window.__stepquestReminderTimer = window.setTimeout(() => {
      const title = 'STEPQUEST';
      const body = state.nextMicro?.title || '\uC9C0\uAE08 \uD560 \uD558\uB098';
      if ('Notification' in window && Notification.permission === 'granted') {
        const options = {
          body,
          tag: `stepquest-reminder-${reminder.stepId || 'next'}`,
          renotify: true,
          data: {
            url: '/goals.html?reminder=1#today',
            stepId: reminder.stepId || state.nextMicro?.id || null,
          },
        };
        if (navigator.serviceWorker?.ready) {
          navigator.serviceWorker.ready
            .then((registration) => registration.showNotification(title, options))
            .catch(() => new Notification(title, options));
        } else {
          new Notification(title, options);
        }
      } else {
        toast(body);
      }
      const guest = loadGuest();
      guest.reminderDue = true;
      saveGuest(guest);
      syncGuest(guest);
      window.dispatchEvent(new CustomEvent('stepquest:refresh'));
    }, delay);
  }

  async function saveReminder(minutes) {
    const safeMinutes = Math.max(1, Math.min(1440, Number(minutes) || 10));
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {
        // Local toast fallback is enough when browser notification permission is unavailable.
      }
    }
    const reminder = {
      at: new Date(Date.now() + safeMinutes * 60000).toISOString(),
      minutes: safeMinutes,
      stepId: state.nextMicro?.id || null,
    };
    if (!state.token) {
      const guest = loadGuest();
      guest.reminder = reminder;
      guest.reminderDue = false;
      saveGuest(guest);
      syncGuest(guest);
    } else {
      state.reminder = await api('POST', '/stepquest/reminder', reminder);
    }
    armLocalReminder(reminder);
    return reminder;
  }

  async function handleReminderAction(action, minutes = 5) {
    const stepId = state.reminder?.stepId || state.nextMicro?.id;
    if (!stepId) throw new Error('\uC54C\uB9BC\uC5D0 \uC5F0\uACB0\uD560 \uD589\uB3D9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.');
    if (state.token) {
      const result = await api('POST', '/stepquest/reminder/action', { action, minutes });
      await refresh();
      return result;
    }
    if (action === 'complete') {
      const result = await completeMicro(stepId);
      const guest = loadGuest();
      guest.reminder = null;
      guest.reminderDue = false;
      saveGuest(guest);
      syncGuest(guest);
      return result;
    }
    if (action === 'snooze') {
      const reminder = await saveReminder(minutes || 5);
      return { action, reminder, message: t.reminderSnoozed };
    }
    if (action === 'shrink') {
      const result = await shrinkMicro(stepId, 'too_big');
      const guest = loadGuest();
      guest.reminder = null;
      guest.reminderDue = false;
      saveGuest(guest);
      syncGuest(guest);
      return result;
    }
    const result = await skipMicro(stepId);
    const guest = loadGuest();
    guest.reminder = null;
    guest.reminderDue = false;
    saveGuest(guest);
    syncGuest(guest);
    return result;
  }

  async function shrinkMicro(id, reason = 'too_big') {
    const shrinkInfo = shrinkReasonInfo(reason);
    if (!state.token) {
      const guest = loadGuest();
      const index = guest.micro.findIndex((item) => String(item.id) === String(id));
      if (index >= 0) {
        const now = new Date().toISOString();
        const original = guest.micro[index];
        original.status = 'REPLACED';
        guest.attempts = guest.attempts || [];
        guest.attempts.push({ stepId: original.id, action: 'shrink', reason, createdAt: now });
        const replacements = makeReplacementSteps(original, reason, now);
        guest.micro.splice(index + 1, 0, ...replacements);
        guest.gameEvent = {
          type: 'shrink',
          stepTitle: replacements[0]?.title || original.title,
          originalStepTitle: original.title,
          shrinkReason: reason,
          shrinkReasonLabel: shrinkInfo.label,
          shrinkStrategy: shrinkInfo.strategy,
          replacementCount: replacements.length,
          nextStepTitle: replacements[0]?.title || original.title,
          xp: 0,
          material: 0,
          facilityXp: 0,
          combo: guest.sessionCombo || 0,
          dungeonProgress: buildGuestDungeons(guest)[0]?.progress || 0,
          chestReady: false,
          createdAt: now,
        };
      }
      saveGuest(guest);
      syncGuest(guest);
      const original = guest.micro[index];
      const firstReplacement = guest.micro[index + 1];
      trackProductEvent('step_shrunk', {
        goalId: original?.weeklyMissionId,
        stepId: original?.id,
        category: firstReplacement?.category || original?.category,
        estimatedSeconds: firstReplacement?.estimatedSeconds || original?.estimatedSeconds,
      });
      return { message: t.shrunk, step: guest.micro[index] };
    }
    const current = state.nextMicro;
    const result = await api('POST', `/stepquest/steps/${id}/shrink`, { reason });
    await refresh();
    const firstStep = result.firstStep || result.replacementSteps?.[0] || state.nextMicro;
    state.gameEvent = {
      type: 'shrink',
      stepTitle: firstStep?.title || current?.title || '',
      originalStepTitle: current?.title || '',
      shrinkReason: reason,
      shrinkReasonLabel: shrinkInfo.label,
      shrinkStrategy: shrinkInfo.strategy,
      replacementCount: result.replacementSteps?.length || 1,
      nextStepTitle: firstStep?.title || state.nextMicro?.title || '',
      xp: 0,
      material: 0,
      facilityXp: 0,
      combo: state.sessionCombo || 0,
      dungeonProgress: (state.dungeons || [])[0]?.progress || 0,
      chestReady: false,
      createdAt: new Date().toISOString(),
    };
    trackProductEvent('step_shrunk', {
      stepId: id,
      category: firstStep?.category || current?.category,
      estimatedSeconds: firstStep?.estimatedSeconds || current?.estimatedSeconds,
    });
    return result;
  }

  async function skipMicro(id) {
    if (!state.token) {
      const guest = loadGuest();
      const step = guest.micro.find((item) => String(item.id) === String(id));
      const now = new Date().toISOString();
      if (step) {
        step.status = 'SKIPPED';
        guest.attempts = guest.attempts || [];
        guest.attempts.push({ stepId: step.id, action: 'skip', createdAt: now });
        const hasOpenStep = guest.micro.some((micro) => micro.status === 'OPEN');
        if (!hasOpenStep) {
          const nextStep = guest.micro.find((micro) => micro.status === 'PENDING');
          if (nextStep) nextStep.status = 'OPEN';
        }
        const next = guest.micro.find((micro) => micro.status === 'OPEN') || null;
        const goal = guest.weekly.find((item) => item.id === step.weeklyMissionId) || guest.weekly[0] || null;
        const activeRevision = Number(goal?.activeRevision || step.chainRevision || 1);
        const total = Math.max((guest.micro || []).filter((item) =>
          item.weeklyMissionId === step.weeklyMissionId && Number(item.chainRevision || 1) === activeRevision,
        ).length, goal?.targetCount || 1);
        const completed = (guest.micro || []).filter((item) =>
          item.weeklyMissionId === step.weeklyMissionId
            && Number(item.chainRevision || 1) === activeRevision
            && item.status === 'DONE',
        ).length;
        guest.gameEvent = {
          type: 'skip',
          skippedStepTitle: step.title,
          nextStepTitle: next?.title || '',
          stepTitle: next?.title || step.title,
          keptRecord: true,
          combo: guest.sessionCombo || 0,
          dungeonProgress: Math.round((completed / total) * 100),
          createdAt: now,
        };
      }
      saveGuest(guest);
      syncGuest(guest);
      trackProductEvent('step_skipped', {
        goalId: step?.weeklyMissionId,
        stepId: step?.id,
        category: step?.category,
        estimatedSeconds: step?.estimatedSeconds,
      });
      return { message: t.skipped, step };
    }
    const current = state.nextMicro;
    const result = await api('POST', `/stepquest/steps/${id}/skip`);
    await refresh();
    state.gameEvent = {
      type: 'skip',
      skippedStepTitle: current?.title || '',
      nextStepTitle: result.currentStep?.title || state.nextMicro?.title || '',
      stepTitle: result.currentStep?.title || state.nextMicro?.title || current?.title || '',
      keptRecord: true,
      combo: state.sessionCombo || 0,
      dungeonProgress: (state.dungeons || [])[0]?.progress || 0,
      createdAt: new Date().toISOString(),
    };
    trackProductEvent('step_skipped', {
      stepId: id,
      category: current?.category,
      estimatedSeconds: current?.estimatedSeconds,
    });
    return result;
  }

  async function deferMicro(id, reason = 'not_now') {
    if (!state.token) {
      const guest = loadGuest();
      const step = guest.micro.find((item) => String(item.id) === String(id));
      const now = new Date().toISOString();
      if (step) {
        step.status = 'DEFERRED';
        guest.attempts = guest.attempts || [];
        guest.attempts.push({ stepId: step.id, action: 'defer', reason, createdAt: now });
        guest.stoppedAt = now;
        guest.sessionCombo = 0;
      }
      saveGuest(guest);
      syncGuest(guest);
      trackProductEvent('session_deferred', {
        goalId: step?.weeklyMissionId,
        stepId: step?.id,
        category: step?.category,
        estimatedSeconds: step?.estimatedSeconds,
      });
      return { message: t.deferred, step };
    }
    const result = await api('POST', `/stepquest/steps/${id}/defer`, { reason });
    await refresh();
    trackProductEvent('session_deferred', { stepId: id });
    return result;
  }

  async function resumeMicro(id) {
    if (!state.token) {
      const guest = loadGuest();
      const step = guest.micro.find((item) => String(item.id) === String(id));
      const now = new Date().toISOString();
      if (step) {
        const active = guest.micro.find((item) => item.status === 'OPEN' && String(item.id) !== String(id));
        if (active) active.status = 'PENDING';
        step.status = 'OPEN';
        step.activatedAt = now;
        guest.stoppedAt = null;
        guest.gameEvent = null;
      }
      saveGuest(guest);
      syncGuest(guest);
      return { message: t.returned, step };
    }
    const result = await api('POST', `/stepquest/steps/${id}/resume`);
    await refresh();
    return result;
  }

  async function setDungeonStatus(goalId, status) {
    if (!state.token) {
      const guest = loadGuest();
      const goal = (guest.weekly || []).find((item) => String(item.id) === String(goalId));
      if (!goal) throw new Error('\uC6D0\uC815\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.');
      if (status === 'ACTIVE') {
        guest.weekly = guest.weekly.map((item) => ({
          ...item,
          status: item.id === goal.id ? 'ACTIVE' : item.status === 'ACTIVE' ? 'PAUSED' : item.status,
        }));
      } else {
        goal.status = status;
      }
      saveGuest(guest);
      syncGuest(guest);
      return { dungeon: buildGuestDungeons(guest).find((item) => String(item.goalId) === String(goalId)) || null };
    }
    const action = status === 'ACTIVE' ? 'resume' : status === 'PAUSED' ? 'pause' : 'archive';
    const result = await api('POST', `/stepquest/goals/${goalId}/${action}`);
    await refresh();
    return result;
  }

  async function regenerateGoal(goalId, reason = 'too_big') {
    if (!state.token) {
      const guest = loadGuest();
      const goal = (guest.weekly || []).find((item) => String(item.id) === String(goalId)) || guest.weekly[0];
      if (!goal) throw new Error('\uB2E4\uC2DC \uCABC\uAC24 \uC6D0\uC815\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.');
      const now = new Date().toISOString();
      const nextRevision = Number(goal.activeRevision || 1) + 1;
      goal.activeRevision = nextRevision;
      goal.status = 'ACTIVE';
      goal.completedAt = null;
      goal.completedCount = 0;
      const input = {
        title: goal.title,
        category: goal.category || 'auto',
        burdenLevel: goal.burdenLevel || 4,
        energyLevel: goal.energyLevel || 'medium',
        location: goal.location || undefined,
        availableMinutes: goal.availableMinutes || undefined,
        obstacle: reason,
      };
      const made = makeGuestGoal(input);
      const oldSteps = (guest.micro || []).map((step) => {
        if (String(step.weeklyMissionId) !== String(goal.id) || step.status === 'DONE') return step;
        return { ...step, status: 'REPLACED' };
      });
      const newSteps = made.micro.map((step) => ({
        ...step,
        id: Number(`${goal.id}${nextRevision}${String(step.id).slice(-3)}`),
        weeklyMissionId: goal.id,
        chainRevision: nextRevision,
        createdAt: now,
      }));
      guest.micro = [...oldSteps, ...newSteps];
      goal.targetCount = newSteps.length;
      guest.nextMicro = newSteps[0] || null;
      guest.attempts = guest.attempts || [];
      guest.attempts.push({ stepId: newSteps[0]?.id || goal.id, action: 'shrink', reason: `regenerate:${reason}`, createdAt: now });
      guest.gameEvent = {
        type: 'regenerate',
        stepTitle: newSteps[0]?.title || goal.title,
        originalStepTitle: goal.title,
        shrinkReason: reason,
        shrinkReasonLabel: shrinkReasonInfo(reason).label,
        shrinkStrategy: '\uC6D0\uB798 \uBCF4\uC0C1\uC740 \uB0A8\uAE30\uACE0 \uD604\uC7AC \uC785\uAD6C\uB9CC \uB2E4\uC2DC \uC5FD\uB2C8\uB2E4.',
        replacementCount: newSteps.length,
        nextStepTitle: newSteps[0]?.title || '',
        combo: guest.sessionCombo || 0,
        dungeonProgress: 0,
        createdAt: now,
      };
      saveGuest(guest);
      syncGuest(guest);
      return { message: t.regenerated, firstStep: newSteps[0] };
    }
    const result = await api('POST', `/stepquest/goals/${goalId}/regenerate`, { reason });
    await refresh();
    state.gameEvent = {
      type: 'regenerate',
      stepTitle: result.firstStep?.title || state.nextMicro?.title || '',
      originalStepTitle: result.goal?.title || '',
      shrinkReason: result.reason || reason,
      shrinkReasonLabel: shrinkReasonInfo(result.reason || reason).label,
      shrinkStrategy: '\uC6D0\uB798 \uBCF4\uC0C1\uC740 \uB0A8\uAE30\uACE0 \uD604\uC7AC \uC785\uAD6C\uB9CC \uB2E4\uC2DC \uC5FD\uB2C8\uB2E4.',
      replacementCount: result.steps?.length || 1,
      nextStepTitle: result.firstStep?.title || state.nextMicro?.title || '',
      combo: state.sessionCombo || 0,
      dungeonProgress: 0,
      createdAt: new Date().toISOString(),
    };
    return result;
  }

  async function equipCostume(costumeId) {
    if (!state.token) {
      const guest = loadGuest();
      const costumes = buildCostumes(guest);
      const costume = costumes.find((item) => item.id === costumeId);
      if (!costume?.unlocked) throw new Error('\uC544\uC9C1 \uD574\uAE08\uB418\uC9C0 \uC54A\uC740 \uCF54\uC2A4\uD2AC\uC785\uB2C8\uB2E4.');
      guest.equippedCostumeId = costumeId;
      guest.costumes = buildCostumes(guest);
      guest.player.equippedCostumeName = costumeName(costumeId, guest.costumes);
      saveGuest(guest);
      syncGuest(guest);
      return { equippedCostume: costume };
    }
    const result = await api('POST', `/stepquest/costumes/${encodeURIComponent(costumeId)}/equip`);
    await refresh();
    return result;
  }

  function costumeActiveSteps(costumeId) {
    const sets = {
      focus_archer: [
        ['\uBC29\uD574 \uC694\uC18C \uD558\uB098 \uBCF4\uAE30', 10],
        ['\uD654\uBA74 \uD558\uB098\uB9CC \uB0A8\uAE30\uAE30', 10],
        ['3\uBD84 \uD0C0\uC774\uBA38 \uC2DC\uC791\uD558\uAE30', 180],
      ],
      tidy_rogue: [
        ['\uB208\uC55E\uC758 \uBB3C\uAC74 \uD558\uB098 \uBCF4\uAE30', 5],
        ['\uADF8 \uBB3C\uAC74\uC744 \uC190\uC5D0 \uB4E4\uAE30', 10],
        ['\uB458 \uACF3\uC744 \uBC14\uB77C\uBCF4\uAE30', 10],
      ],
      blank_scribe: [
        ['\uC791\uC131\uD560 \uBB38\uC11C \uC5F4\uAE30', 10],
        ['\uCEE4\uC11C\uB97C \uBCF8\uBB38\uC5D0 \uB193\uAE30', 10],
        ['3\uBD84 \uB3D9\uC548 \uC218\uC815\uD558\uC9C0 \uC54A\uACE0 \uC4F0\uAE30', 180],
      ],
      dawn_knight: [
        ['\uD55C\uCABD \uB2E4\uB9AC\uB97C \uC774\uBD88 \uBC16\uC73C\uB85C \uBE7C\uAE30', 8],
        ['\uBC1C\uBC14\uB2E5\uC744 \uBC14\uB2E5\uC5D0 \uBD99\uC774\uAE30', 10],
      ],
    };
    const superSteps = window.StepQuestSuperMode?.costumeActiveSteps?.(costumeId);
    if (Array.isArray(superSteps) && superSteps.length) return superSteps;
    return sets[costumeId] || [];
  }

  function insertGuestCostumeSteps(guest, costumeId) {
    assertGuestCostumeActiveAvailable(guest, costumeId);
    const steps = costumeActiveSteps(costumeId);
    if (!steps.length) return null;
      const current = guest.micro.find((item) => item.status === 'OPEN')
        || guest.micro.find((item) => item.status === 'DEFERRED')
        || guest.micro.find((item) => item.status === 'PENDING');
      const now = new Date().toISOString();
      if (current) current.status = 'PENDING';
    const weeklyId = current?.weeklyMissionId || guest.weekly[0]?.id || Date.now();
    const category = costumeId === 'tidy_rogue'
      ? 'cleaning'
      : costumeId === 'blank_scribe'
        ? 'writing'
        : costumeId === 'dawn_knight'
          ? 'wake'
          : current?.category || guest.weekly[0]?.category || 'study';
    const created = steps.map(([title, seconds], index) => ({
      id: Number(`${Date.now()}${index}`),
      userId: 'guest',
      weeklyMissionId: weeklyId,
      title,
      estimatedSeconds: seconds,
      difficulty: seconds <= 10 ? 1 : 2,
      category,
      status: index === 0 ? 'OPEN' : 'PENDING',
      source: 'costume',
      costumeId,
      createdAt: now,
      completedAt: null,
    }));
    guest.micro.unshift(...created);
    guest.attempts = guest.attempts || [];
    guest.attempts.push({ stepId: created[0].id, action: 'costume_active', reason: costumeId, createdAt: now });
    return created[0];
  }

  async function activateCostume(costumeId = 'starter_mage') {
    if (!state.nextMicro && costumeId !== 'return_paladin') return { message: t.waiting };
    if (state.token) {
      const previousStep = state.nextMicro;
      const result = await api('POST', `/stepquest/costumes/${encodeURIComponent(costumeId)}/activate`);
      await refresh();
      const costume = costumeInfo(costumeId);
      const firstStep = result.firstStep || result.replacementSteps?.[0] || state.nextMicro;
      if (result.replacementSteps?.length) {
        const shrinkInfo = shrinkReasonInfo('costume_active');
        state.gameEvent = {
          type: 'shrink',
          stepTitle: firstStep?.title || '',
          originalStepTitle: previousStep?.title || '',
          shrinkReason: 'costume_active',
          shrinkReasonLabel: shrinkInfo.label,
          shrinkStrategy: shrinkInfo.strategy,
          replacementCount: result.replacementSteps.length,
          nextStepTitle: firstStep?.title || '',
          xp: 0,
          material: 0,
          facilityXp: 0,
          combo: state.sessionCombo || 0,
          dungeonProgress: (state.dungeons || [])[0]?.progress || 0,
          chestReady: false,
          createdAt: new Date().toISOString(),
        };
      } else if (firstStep) {
        state.gameEvent = {
          type: 'costume_active',
          costumeId,
          costumeName: costume?.name || costumeName(costumeId),
          costumeRole: costume?.role || '',
          activeAbility: costume?.activeAbility || costume?.ability || '',
          stepTitle: firstStep.title,
          createdSteps: result.createdSteps?.length || result.insertedSteps?.length || result.replacementSteps?.length || 1,
          combo: state.sessionCombo || 0,
          dungeonProgress: (state.dungeons || [])[0]?.progress || 0,
          createdAt: new Date().toISOString(),
        };
      }
      return result;
    }
    if (costumeId === 'starter_mage') {
      const guest = loadGuest();
      assertGuestCostumeActiveAvailable(guest, costumeId);
      const activeStepId = state.nextMicro.id;
      const result = await shrinkMicro(activeStepId, 'costume_active');
      const updated = loadGuest();
      const now = new Date().toISOString();
      updated.attempts = updated.attempts || [];
      updated.attempts.push({ stepId: activeStepId, action: 'costume_active', reason: costumeId, createdAt: now });
      updated.costumes = buildCostumes(updated);
      saveGuest(updated);
      syncGuest(updated);
      return { ...result, activeCharge: costumeActiveCharge(updated, costumeId) };
    }
    if (!state.token && costumeId === 'return_paladin') {
      const guest = loadGuest();
      assertGuestCostumeActiveAvailable(guest, costumeId);
      return startReturnFlow(costumeId);
    }
    if (!state.token) {
      const guest = loadGuest();
      const firstStep = insertGuestCostumeSteps(guest, costumeId);
      if (firstStep) {
        const costume = costumeInfo(costumeId, buildCostumes(guest));
        guest.gameEvent = {
          type: 'costume_active',
          costumeId,
          costumeName: costume?.name || costumeName(costumeId, guest.costumes),
          costumeRole: costume?.role || '',
          activeAbility: costume?.activeAbility || costume?.ability || '',
          stepTitle: firstStep.title,
          createdSteps: costumeActiveSteps(costumeId).length,
          combo: guest.sessionCombo || 0,
          dungeonProgress: buildGuestDungeons(guest)[0]?.progress || 0,
          createdAt: firstStep.createdAt,
        };
        saveGuest(guest);
        syncGuest(guest);
        return { message: t.created, firstStep };
      }
    }
    toast('\uC774 \uCF54\uC2A4\uD2AC\uC740 \uD328\uC2DC\uBE0C \uB2A5\uB825\uC785\uB2C8\uB2E4.');
    return { message: '\uD328\uC2DC\uBE0C \uB2A5\uB825' };
  }

  function stat(label, value) {
    return `<div class="stat"><label>${h(label)}</label><strong>${h(value ?? t.noValue)}</strong></div>`;
  }

  function renderShell(pageTitle = t.subtitle) {
    applyReducedMotion();
    const root = document.getElementById('app');
    root.innerHTML = `
      <div class="app-shell">
        <header class="topbar">
          <div class="branding">
            <h1>STEPQUEST</h1>
            <p>${h(pageTitle)}</p>
          </div>
          <div class="authbar">
            <input id="auth-email" type="email" placeholder="${t.email}" />
            <input id="auth-password" type="password" placeholder="${t.password}" />
            <input id="auth-nickname" type="text" placeholder="${t.nickname}" />
            <button id="btn-signup" class="alt">${t.signup}</button>
            <button id="btn-login">${t.login}</button>
            <button id="btn-logout" class="ghost">${t.logout}</button>
          </div>
        </header>
        <main class="main-layout">
          <aside class="sidebar">
            <div class="user-card">
              <strong id="user-name">${h(state.player?.nickname || t.guestRunner)}</strong>
              <span>${state.localSuper ? h(window.StepQuestSuperMode?.label || t.guestMode) : state.token ? h(state.user?.email || t.waiting) : t.guestMode}</span>
            </div>
            <nav class="nav-list">
              ${routes.map(([href, label], index) => `<a class="nav-link ${index === 0 ? 'active' : ''}" href="${href}">${h(label)}</a>`).join('')}
            </nav>
            <div class="log-card">
              <h2>${t.log}</h2>
              <div id="debug-log" class="log-panel">${h(state.logs.length ? state.logs.join('\n') : t.noLogs)}</div>
            </div>
            <label class="settings-toggle">
              <input id="reduced-motion-toggle" type="checkbox" ${state.reducedMotion ? 'checked' : ''} />
              <span>${t.reducedMotion}</span>
            </label>
            <div id="app-toast" class="app-toast meta"></div>
          </aside>
          <section class="content">
            <section class="panel hero">
              <div class="avatar" aria-hidden="true"></div>
              <div>
                <span class="badge good">${t.subtitle}</span>
                <h2>${h(state.nextMicro?.title || '\uC791\uC740 \uD589\uB3D9 \uD558\uB098\uB9CC \uACE0\uB974\uBA74 \uC2DC\uC791\uB429\uB2C8\uB2E4.')}</h2>
                <div class="stat-grid">
                  ${stat(t.level, state.player?.level || 1)}
                  ${stat(t.points, state.player?.goalCoin || 0)}
                  ${stat(t.streak, state.sessionCombo || 0)}
                  ${stat(t.score, state.consistency?.consistencyScore || 0)}
                </div>
                <div class="progress">
                  <div class="progress-head"><span>${t.score}</span><span>${state.consistency?.consistencyScore || 0}</span></div>
                  <div class="progress-bar"><i style="width:${Math.min(state.consistency?.consistencyScore || 0, 100)}%"></i></div>
                </div>
              </div>
            </section>
            <div id="page-root"></div>
          </section>
        </main>
      </div>
    `;
    wireAuth();
    document.getElementById('reduced-motion-toggle')?.addEventListener('change', (event) => {
      const enabled = setReducedMotion(event.currentTarget.checked);
      toast(enabled ? t.motionOn : t.motionOff);
    });
  }

  function wireAuth() {
    document.getElementById('btn-signup')?.addEventListener('click', async () => {
      try {
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const nickname = document.getElementById('auth-nickname').value.trim() || t.guestRunner;
        const result = await api('POST', '/auth/signup', { email, password, nickname }, true);
        state.token = result.accessToken;
        state.user = result.user;
        persistAuth();
        const migration = await maybeImportGuestProgress();
        await refresh();
        if (!migration) toast(t.login);
        window.dispatchEvent(new CustomEvent('stepquest:refresh'));
      } catch (error) {
        toast(error.message, true);
      }
    });

    document.getElementById('btn-login')?.addEventListener('click', async () => {
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      try {
        const result = await api('POST', '/auth/login', { email, password }, true);
        state.token = result.accessToken;
        state.user = result.user;
        state.localSuper = false;
        window.StepQuestSuperMode?.clear?.();
        persistAuth();
        const migration = await maybeImportGuestProgress();
        await refresh();
        if (!migration) toast(t.login);
        window.dispatchEvent(new CustomEvent('stepquest:refresh'));
      } catch (error) {
        const superMode = window.StepQuestSuperMode;
        if (superMode?.canLogin?.(email, password)) {
          superMode.activate({
            state,
            persistAuth,
            saveGuest,
            syncGuest,
            guestDefault,
            buildCostumes,
            normalizeVillage,
            makeGuestVillage,
          }, email);
          state.localSuper = Boolean(superMode.isActive?.());
          toast(superMode.label || t.guestMode);
          window.dispatchEvent(new CustomEvent('stepquest:refresh'));
          return;
        }
        toast(error.message, true);
      }
    });

    document.getElementById('btn-logout')?.addEventListener('click', () => {
      const wasLocalSuper = state.localSuper;
      state.token = '';
      state.user = null;
      state.localSuper = false;
      window.StepQuestSuperMode?.clear?.();
      persistAuth();
      if (wasLocalSuper) {
        const superMode = window.StepQuestSuperMode;
        if (superMode?.logout) {
          superMode.logout({ state, persistAuth, saveGuest, syncGuest, guestDefault });
        } else {
          const guest = guestDefault();
          saveGuest(guest);
          syncGuest(guest);
        }
        toast(t.logout);
        window.dispatchEvent(new CustomEvent('stepquest:refresh'));
        return;
      }
      refresh().then(() => {
        toast(t.logout);
        window.dispatchEvent(new CustomEvent('stepquest:refresh'));
      });
    });
  }

  function requireAuthMessage() {
    return state.token ? '' : t.authNeeded;
  }

  window.StepQuestApp = {
    state,
    t,
    api,
    h,
    log,
    toast,
    trackProductEvent,
    refresh,
    renderShell,
    requireAuthMessage,
    createStepQuestGoal,
    completeMicro,
    undoMicro,
    shrinkMicro,
    skipMicro,
    deferMicro,
    resumeMicro,
    setDungeonStatus,
    regenerateGoal,
    equipCostume,
    activateCostume,
    setReducedMotion,
    applyReducedMotion,
    startReturnFlow,
    saveReminder,
    handleReminderAction,
    rewardForStep,
    facilityInfo,
    shrinkReasonInfo,
    costumeInfo,
    basicCostumes,
  };
  trackProductEvent('app_opened');
})();
