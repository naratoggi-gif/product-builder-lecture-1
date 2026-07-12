(function exposeFun(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StepQuestV02Fun = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const REPORT_VERSION = 1;
  const ROUTES = Object.freeze({
    5: { key: 'camp_edge', label: '캠프 외곽' },
    10: { key: 'old_forest', label: '오래된 숲길' },
    25: { key: 'deep_ruins', label: '깊은 유적 입구' },
  });
  const CATALOG = Object.freeze({
    writing: { regular: [['writing_ink_slime', '잉크 슬라임'], ['writing_blank_ghost', '백지 유령'], ['writing_proof_crow', '교정 까마귀']], boss: [['writing_deadline_wraith', '마감의 망령']] },
    cleaning: { regular: [['cleaning_dust_golem', '먼지 골렘'], ['cleaning_stain_mimic', '얼룩 미믹'], ['cleaning_laundry_beast', '세탁 늪괴물']], boss: [['cleaning_clutter_king', '잡동사니 왕']] },
    study: { regular: [['study_forget_bat', '망각 박쥐'], ['study_distraction_imp', '산만 도깨비'], ['study_wrong_golem', '오답 골렘']], boss: [['study_exam_guard', '시험의 파수꾼']] },
    exercise: { regular: [['exercise_lazy_jelly', '게으름 젤리'], ['exercise_breath_wolf', '숨참 늑대'], ['exercise_armor_crab', '무거운 갑옷게']], boss: [['exercise_iron_troll', '철벽 트롤']] },
    wake: { regular: [['wake_blanket_mimic', '이불 미믹'], ['wake_sleep_fog', '졸음 안개'], ['wake_alarm_imp', '알람 임프']], boss: [['wake_dawn_nightmare', '새벽의 몽마']] },
    generic: { regular: [['generic_delay_slime', '미루기 슬라임'], ['generic_worry_ghost', '걱정 유령'], ['generic_complex_golem', '복잡함 골렘']], boss: [['generic_gatekeeper', '막막함의 문지기']] },
  });
  const REPORT_COPY = Object.freeze({
    completed: ['토벌 성공', '길을 열고 돌아왔어요'],
    partial: ['거점을 확보했어요', '다음 발판을 찾았어요'],
    interrupted: ['안전하게 야영하고 돌아왔어요', '흔적을 남겨 두었어요'],
    not_started: ['정찰을 마치고 돌아왔어요', '입구를 확인했어요'],
  });
  const DIALOGUE = Object.freeze({
    departure: ['{subject}, 다녀올게.', '{subject} 쪽 길을 먼저 보고 올게.'],
    ready: ['{subject}에게서 돌아왔어! 이거 봐.', '{subject} 원정 기록을 가져왔어.'],
    early_return: ['일찍 돌아와도 괜찮아. {subject}에서 챙긴 걸 보자.', '{subject}의 흔적은 그대로 남아 있어.'],
    reported: ['{subject}, 기록해 뒀어.', '다음 길은 {subject}에서 이어져.'],
    blocked: ['{subject} 재료가 오면 다시 이어 가자.', '{subject} 준비물은 여기서 기다리고 있어.'],
    waiting: ['{subject} 답이 오면 바로 꺼낼 수 있어.', '{subject} 자리는 그대로 남겨 뒀어.'],
    deferred: ['{subject}는 원할 때 다시 꺼내면 돼.', '{subject}를 안전하게 남겨 뒀어.'],
    long_absence: ['잘 돌아왔어. {subject}는 그대로야.', '캠프도 {subject}도 여기 있어.'],
    first_daily: ['오늘의 첫 걸음은 {subject}이야.', '{subject}부터 가볍게 열어 보자.'],
    idle: ['오늘의 첫 걸음은 {subject}이야.', '{subject}부터 같이 열어 보자.'],
  });

  function hash32(value) {
    let hash = 0x811c9dc5;
    for (const char of String(value)) {
      hash ^= char.codePointAt(0);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  function routeForMinutes(minutes) {
    const route = typeof minutes === 'number' ? ROUTES[minutes] : null;
    if (!route) throw new Error('EXPEDITION_DURATION_INVALID');
    return { ...route, plannedMinutes: minutes };
  }

  function deriveTimer(expedition, now) {
    const minutes = expedition && expedition.plannedMinutes;
    const rawExpiry = expedition && expedition.expiresAt;
    const expiresAt = Date.parse(rawExpiry);
    const current = Date.parse(now);
    if (!Number.isFinite(current)) throw new Error('CLOCK_TIME_INVALID');
    const canonicalExpiry = Number.isFinite(expiresAt) && new Date(expiresAt).toISOString() === rawExpiry;
    if (typeof minutes !== 'number' || !ROUTES[minutes] || !canonicalExpiry) {
      return { phase: 'legacy_ready', remainingMs: 0, plannedMinutes: null };
    }
    const remainingMs = Math.max(0, expiresAt - current);
    return { phase: remainingMs > 0 ? 'running' : 'ready', remainingMs, plannedMinutes: minutes };
  }

  function selectEncounter({ rewardLineage, category, boss = false }) {
    const normalized = CATALOG[category] ? category : 'generic';
    const pool = CATALOG[normalized][boss ? 'boss' : 'regular'];
    const [id, name] = pool[hash32(`${REPORT_VERSION}:${rewardLineage}`) % pool.length];
    return { id, name, category: normalized, boss };
  }

  function deriveEncounterHp(step, rewards) {
    if (step.status === 'completed') return 0;
    const progressed = rewards.some((row) => row.stage === 'progress'
      && (row.rewardLineage || row.sourceStepId) === step.rewardLineage);
    return progressed ? 1 : 2;
  }

  function buildBattleReport({ event, expedition = {} }) {
    const result = event.result || {};
    if (result.reportVersion !== REPORT_VERSION) throw new Error('REPORT_VERSION_UNSUPPORTED');
    const encounter = selectEncounter({
      rewardLineage: result.rewardLineage,
      category: result.category,
      boss: Boolean(result.goalMilestone),
    });
    const lines = REPORT_COPY[event.outcome] || REPORT_COPY.not_started;
    return {
      reportVersion: REPORT_VERSION,
      expeditionId: event.expeditionId,
      monsterId: encounter.id,
      monsterName: encounter.name,
      route: typeof expedition.plannedMinutes === 'number' && ROUTES[expedition.plannedMinutes]
        ? routeForMinutes(expedition.plannedMinutes)
        : { key: 'legacy_return', label: '기존 원정 경로', plannedMinutes: null },
      headline: lines[hash32(event.expeditionId) % lines.length],
      goldGranted: result.goldGranted,
      defeatCount: event.outcome === 'completed' ? 1 : 0,
    };
  }

  function buildCodex(events) {
    const counts = new Map();
    const seen = new Set();
    for (const event of events) {
      const result = event.result || {};
      const identity = `${event.idempotencyKey}:${event.expeditionId}`;
      if (
        seen.has(identity)
        || event.outcome !== 'completed'
        || result.reportVersion !== REPORT_VERSION
        || !result.rewardLineage
        || !CATALOG[result.category]
      ) continue;
      seen.add(identity);
      const encounter = selectEncounter({ rewardLineage: result.rewardLineage, category: result.category, boss: Boolean(result.goalMilestone) });
      counts.set(encounter.id, (counts.get(encounter.id) || 0) + 1);
    }
    const entries = Object.values(CATALOG).flatMap((group) => [...group.regular, ...group.boss]).map(([id, name]) => {
      const count = counts.get(id) || 0;
      return { id, discovered: count > 0, name: count > 0 ? name : null, count };
    });
    return { entries };
  }

  function selectDialogue({ context, entityId, localDate, subject = '다음 한 걸음', previousText = null }) {
    const lines = DIALOGUE[context] || DIALOGUE.idle;
    let index = hash32(`${context}:${entityId || 'none'}:${localDate || 'none'}`) % lines.length;
    let text = lines[index].replace('{subject}', subject);
    if (text === previousText && lines.length > 1) {
      index = (index + 1) % lines.length;
      text = lines[index].replace('{subject}', subject);
    }
    return text;
  }

  function buildNextDesire({ camp, wallet, activeStep, encounter, codex }) {
    if (camp.level < 5) {
      const shortfall = Math.max(0, camp.nextCost - wallet.gold);
      if (shortfall === 0) return { kind: 'camp', text: '캠프를 지금 확장할 수 있어요.' };
    }
    const current = encounter && codex.entries.find((entry) => entry.id === encounter.id);
    if (current && !current.discovered && activeStep) {
      return { kind: 'codex', text: `“${activeStep.title}” 완료 → ??? 발견` };
    }
    if (camp.level < 5) {
      const shortfall = Math.max(0, camp.nextCost - wallet.gold);
      return { kind: 'camp', text: `다음 캠프까지 골드 ${shortfall}.` };
    }
    if (activeStep) return { kind: 'milestone', text: `다음 이정표: ${activeStep.nextPhysicalAction || activeStep.title}` };
    return { kind: 'terminal', text: '새 목표가 다음 조우를 엽니다.' };
  }

  return { REPORT_VERSION, ROUTES, CATALOG, deriveTimer, routeForMinutes, hash32, selectEncounter, deriveEncounterHp, buildBattleReport, buildCodex, selectDialogue, buildNextDesire };
});
