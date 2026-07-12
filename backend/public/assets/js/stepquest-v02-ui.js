(function exposeUi(root) {
  let App;
  let Core;
  let reporting = false;
  let reportingEntry = null;
  let selectedOutcome = null;
  let selectedReason = null;
  let tiredShrink = false;
  let campMessage = null;
  let characterPanelOpen = false;
  let selectedMinutes = 5;
  let timerInterval = null;
  let timerExpeditionId = null;
  let readyLatch = null;
  let readyAnnounced = null;
  let lifecycleBound = false;
  let hashRouteBound = false;
  let mounted = false;
  let refreshQueue = Promise.resolve();
  let combatState = null;
  let pendingBattleReport = null;
  let combatPlayback = null;
  let combatLifecycleRefreshPending = false;
  let reportCommitInFlight = false;
  let foregroundSession = { firstLocalDate: false, longAbsence: false };
  let dialogueCache = null;
  let dialoguePendingKey = null;
  const failedCharacterMedia = new Map();

  const outcomeLabels = {
    completed: '완료',
    partial: '조금 진행',
    interrupted: '시작했지만 멈춤',
    not_started: '시작 못 함',
  };
  const reasons = {
    waiting_person: '다른 사람의 답을 기다림',
    too_big: '너무 큼',
    no_material: '준비물 없음',
    unclear: '무엇을 할지 모름',
    tired: '피곤함',
    wrong_place: '장소가 안 맞음',
    not_now: '지금은 아님',
    anxious: '불안·부담',
  };
  const misTapReason = 'mis_tap';
  const campLevels = [
    ['⛺', '빈 야영지'],
    ['🏕️', '작은 텐트'],
    ['🔥', '모닥불 캠프'],
    ['🛖', '정찰 기지'],
    ['🏡', '환한 쉼터'],
    ['🏰', '중앙 캠프'],
  ];
  const h = (value) => App.h(String(value ?? ''));
  const key = (name, id) => `v02:${name}:${id}`;
  const anchorDraftKey = (expeditionId) => `stepquest_v02_anchor_draft_${expeditionId}`;

  function normalizeRouteHash() {
    if (['#today', '#codex'].includes(root.location.hash)) return root.location.hash;
    root.history.replaceState(null, '', '#today');
    return '#today';
  }

  function readAnchorDraft(expeditionId) {
    if (!expeditionId) return null;
    try {
      return JSON.parse(root.localStorage.getItem(anchorDraftKey(expeditionId)) || 'null');
    } catch (_error) {
      return null;
    }
  }

  function writeAnchorDraft(expeditionId, draft) {
    if (!expeditionId) return;
    try {
      root.localStorage.setItem(anchorDraftKey(expeditionId), JSON.stringify({
        ...draft,
        updatedAt: new Date().toISOString(),
      }));
    } catch (_error) {
      // The report remains usable even if the browser denies draft storage.
    }
  }

  function clearAnchorDraft(expeditionId) {
    if (!expeditionId) return;
    try {
      root.localStorage.removeItem(anchorDraftKey(expeditionId));
    } catch (_error) {
      // A stale draft is ignored when its expedition is no longer active.
    }
  }

  function captureAnchorDraft(expeditionId) {
    writeAnchorDraft(expeditionId, {
      outcome: selectedOutcome,
      lastCompletedAction: document.getElementById('v02-last-action')?.value || '',
      nextPhysicalAction: document.getElementById('v02-next-action')?.value || '',
      location: document.getElementById('v02-location')?.value || '',
      requiredMaterial: document.getElementById('v02-material')?.value || '',
      note: document.getElementById('v02-note')?.value || '',
    });
  }

  function alignTimerSession(expedition) {
    const expeditionId = expedition?.id || null;
    if (timerExpeditionId === expeditionId) return;
    timerExpeditionId = expeditionId;
    readyLatch = null;
    readyAnnounced = null;
  }

  function timerView(expedition) {
    alignTimerSession(expedition);
    if (!expedition) return null;
    const timer = Core.getTimerView(new Date().toISOString());
    if (!timer) return null;
    if (timer.phase === 'ready') readyLatch = expedition.id;
    if (timer.phase === 'running' && readyLatch === expedition.id) {
      return { ...timer, phase: 'ready', remainingMs: 0 };
    }
    return timer;
  }

  function formatCountdown(remainingMs) {
    const totalSeconds = Math.max(0, Math.ceil(Number(remainingMs || 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function routeLabel(minutes) {
    return root.StepQuestV02Fun?.ROUTES?.[minutes]?.label || '원정 경로';
  }

  function teaserText(minutes) {
    return `${minutes}분 · ${routeLabel(minutes)} · ???의 흔적`;
  }

  function durationChooser() {
    return `
      <div role="radiogroup" aria-labelledby="v02-expedition-duration-label">
        <span id="v02-expedition-duration-label">원정 시간</span>
        ${[5, 10, 25].map((minutes) => `
          <label>
            <input type="radio" name="v02-expedition-minutes" value="${minutes}" ${selectedMinutes === minutes ? 'checked' : ''} />
            ${minutes}분
          </label>
        `).join('')}
      </div>
      <p data-v02-expedition-teaser>${h(teaserText(selectedMinutes))}</p>
    `;
  }

  function reportPresentation() {
    if (reportingEntry === 'early') {
      return {
        kicker: '조기 귀환',
        cancel: '원정 계속하기',
      };
    }
    if (reportingEntry === 'legacy') {
      return {
        kicker: '이전 원정 귀환 기록',
        cancel: '이전 원정으로 돌아가기',
      };
    }
    return {
      kicker: '전리품 확인',
      cancel: '수확 준비 화면으로 돌아가기',
    };
  }

  function clearTimer() {
    if (timerInterval === null) return;
    root.clearInterval(timerInterval);
    timerInterval = null;
  }

  function announceReady(expeditionId) {
    if (!expeditionId || readyAnnounced === expeditionId) return;
    readyAnnounced = expeditionId;
    const live = document.getElementById('v02-live');
    if (live) live.textContent = '원정 전리품을 확인할 준비가 되었습니다.';
  }

  function updateCountdown(timer, expeditionId) {
    const countdown = document.querySelector('[data-v02-countdown]');
    if (countdown?.dataset.v02ExpeditionId === String(expeditionId)) {
      countdown.textContent = formatCountdown(timer.remainingMs);
    }
  }

  function renderedTimerPhase() {
    if (document.getElementById('v02-expedition-active')) return 'running';
    if (document.getElementById('v02-expedition-ready')) return 'ready';
    if (document.getElementById('v02-expedition-legacy-ready')) return 'legacy_ready';
    return null;
  }

  function stableCharacter() {
    const {
      imageUrl,
      portraitUrl,
      idleUrl,
      skillUrl,
      ...value
    } = Core.getCharacter();
    return value;
  }

  const domainArrayKeys = new Set([
    'goals',
    'steps',
    'expeditions',
    'anchors',
    'resumeAnchors',
    'events',
    'rewards',
  ]);

  function volatilePresentationKey(name) {
    return /url$/i.test(name) || ['objectUrl', 'previewSrc'].includes(name);
  }

  function compareDomainRecords(left, right) {
    const leftOrder = Number(left?.orderIndex);
    const rightOrder = Number(right?.orderIndex);
    const leftHasOrder = Number.isFinite(leftOrder);
    const rightHasOrder = Number.isFinite(rightOrder);
    if (leftHasOrder && rightHasOrder && leftOrder !== rightOrder) return leftOrder - rightOrder;
    if (leftHasOrder !== rightHasOrder) return leftHasOrder ? -1 : 1;

    for (const name of ['id', 'idempotencyKey', 'goalId', 'stepId', 'expeditionId']) {
      const compared = String(left?.[name] ?? '').localeCompare(String(right?.[name] ?? ''));
      if (compared) return compared;
    }
    return JSON.stringify(left).localeCompare(JSON.stringify(right));
  }

  function canonicalProjection(value, parentKey = '') {
    if (Array.isArray(value)) {
      const projected = value.map((item) => canonicalProjection(item));
      return domainArrayKeys.has(parentKey) ? projected.sort(compareDomainRecords) : projected;
    }
    if (!value || typeof value !== 'object') return value;
    return Object.keys(value).sort().reduce((projected, name) => {
      if (!volatilePresentationKey(name)) {
        projected[name] = canonicalProjection(value[name], name);
      }
      return projected;
    }, {});
  }

  function canonicalString(value) {
    return JSON.stringify(canonicalProjection(value));
  }

  function lifecyclePresentation() {
    const snapshot = Core.getSnapshot();
    const expedition = snapshot.expeditions.find((item) => item.status === 'active') || null;
    return {
      snapshot: canonicalString(snapshot),
      status: canonicalString(Core.getStatus()),
      character: canonicalString(stableCharacter()),
      selectedMinutes,
      expedition,
      expeditionRecord: canonicalString(expedition),
      pendingReportKey: pendingBattleReport?.key || null,
      renderedPhase: renderedTimerPhase(),
    };
  }

  async function hydratePendingBattleReport() {
    pendingBattleReport = await Core.getPendingBattleReport();
    return pendingBattleReport;
  }

  function refreshCharacterUrlInPlace() {
    const character = Core.getCharacter();
    document.querySelectorAll('[data-v02-character-media]').forEach((element) => {
      const slot = element.dataset.v02CharacterMedia;
      const nextUrl = character[`${slot}Url`];
      if (nextUrl && element.getAttribute('src') !== nextUrl) element.setAttribute('src', nextUrl);
    });
    const image = document.getElementById('v02-character-image');
    if (image && character.imageUrl && image.getAttribute('src') !== character.imageUrl) {
      image.setAttribute('src', character.imageUrl);
    }
  }

  function timerTick() {
    const expedition = Core.getSnapshot().expeditions.find((item) => item.status === 'active');
    const timer = timerView(expedition);
    if (!timer || timer.phase !== 'running') {
      clearTimer();
      if (timer?.phase === 'ready' && !reporting && !document.getElementById('v02-expedition-ready')) {
        render('#v02-open-report');
      }
      return;
    }
    updateCountdown(timer, expedition.id);
  }

  function syncTimer(timer) {
    if (!timer || timer.phase !== 'running') {
      clearTimer();
      return;
    }
    if (timerInterval === null) timerInterval = root.setInterval(timerTick, 1000);
  }

  function viewModel() {
    const state = Core.getSnapshot();
    const active = state.steps.find((item) => item.status === 'active');
    const interrupted = state.steps.find((item) => item.status === 'interrupted');
    const parked = state.steps
      .filter((item) => ['deferred', 'blocked', 'waiting'].includes(item.status))
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))[0];
    const expedition = state.expeditions.find((item) => item.status === 'active');
    const anchor = interrupted
      ? [...state.resumeAnchors]
        .reverse()
        .find((item) => item.stepId === interrupted.id && !item.consumedAt)
      : null;
    const notStartedReports = state.events
      .filter((event) => event.type === 'expedition_reported' && event.outcome === 'not_started')
      .sort((left, right) => (
        String(right.createdAt).localeCompare(String(left.createdAt))
        || String(right.idempotencyKey).localeCompare(String(left.idempotencyKey))
      ));
    const lastNotStarted = notStartedReports.find((report) => !state.events.some((event) => {
      const routed = event.type === 'obstacle_routed'
        && event.stepId === report.stepId
        && (
          event.resolvesEventKey === report.idempotencyKey
          || (!event.resolvesEventKey && String(event.createdAt) >= String(report.createdAt))
        );
      const legacyRetry = event.type === 'step_started'
        && event.stepId === report.stepId
        && event.expeditionId !== report.expeditionId
        && String(event.createdAt || '') >= String(report.createdAt || '');
      return routed || legacyRetry;
    })) || null;
    return {
      state,
      active,
      interrupted,
      parked,
      expedition,
      anchor,
      pendingObstacle: lastNotStarted,
    };
  }

  function shrinkPanel(reason) {
    const placeholders = {
      too_big: '지금 할 수 있는 가장 작은 행동',
      unclear: '생각 말고 볼 수 있는 첫 신호',
      anxious: '파일을 열어서 보기만 하기',
      tired: '지금 가능한 더 가벼운 버전',
    };
    return `
      ${reason === 'anxious' ? '<p id="v02-anxious-helper">결과를 만들지 않아도 됩니다. 보기만 하는 행동도 진행입니다.</p>' : ''}
      <label>더 작은 행동<input id="v02-smaller-action" placeholder="${h(placeholders[reason])}" autocomplete="off" /></label>
      <button id="v02-manual-shrink">이걸로 바꾸기</button>
    `;
  }

  function obstacleActionPanel() {
    if (['too_big', 'unclear', 'anxious'].includes(selectedReason)) {
      return shrinkPanel(selectedReason);
    }
    if (selectedReason === 'tired') {
      if (tiredShrink) return shrinkPanel('tired');
      return `
        <div class="primary-actions">
          <button id="v02-tired-smaller">더 가벼운 버전으로</button>
          <button id="v02-tired-defer" class="ghost">오늘은 쉬기</button>
        </div>
      `;
    }
    if (selectedReason === 'no_material') {
      return `
        <label>무엇이 필요한가요?<input id="v02-block-note" autocomplete="off" /></label>
        <button id="v02-block-material">준비되면 다시 하기</button>
      `;
    }
    if (selectedReason === 'waiting_person') {
      return `
        <label>누구의 어떤 답을 기다리나요?<input id="v02-block-note" autocomplete="off" /></label>
        <button id="v02-block-person">답을 기다리는 중</button>
      `;
    }
    if (selectedReason === 'wrong_place') {
      return `
        <label>어디에서 할 수 있나요?<input id="v02-defer-note" autocomplete="off" /></label>
        <button id="v02-defer-place">그 장소에서 다시</button>
      `;
    }
    if (selectedReason === 'not_now') return '<button id="v02-defer">나중에</button>';
    return '';
  }

  function campVisual(level) {
    const [icon, label] = campLevels[level] || campLevels[0];
    return `
      <div class="v02-camp-visual" data-camp-level="${level}">
        <span aria-hidden="true">${icon}</span>
        <strong>중앙 캠프 Lv.${level}</strong>
        <small>${label}</small>
      </div>
    `;
  }

  function reducedMotionEnabled() {
    return Boolean(
      App.state?.reducedMotion
      || root.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    );
  }

  function currentLocalDate() {
    const observed = new Date();
    return [
      observed.getFullYear(),
      String(observed.getMonth() + 1).padStart(2, '0'),
      String(observed.getDate()).padStart(2, '0'),
    ].join('-');
  }

  function dialogueProjection(vm, timer) {
    const localDate = currentLocalDate();
    const expeditionStep = vm.expedition
      ? vm.state.steps.find((item) => item.id === vm.expedition.stepId)
      : null;
    const campSubject = `캠프 Lv.${vm.state.camp?.level || 0}`;
    if (pendingBattleReport) {
      return {
        context: 'reported',
        entityId: pendingBattleReport.key,
        localDate,
        subject: pendingBattleReport.monsterName,
      };
    }
    if (vm.expedition && timer?.phase === 'ready') {
      return {
        context: 'ready',
        entityId: vm.expedition.id,
        localDate,
        subject: Core.getEncounterView()?.name || expeditionStep?.title || campSubject,
      };
    }
    if (vm.expedition && reporting && reportingEntry === 'early') {
      return {
        context: 'early_return',
        entityId: vm.expedition.id,
        localDate,
        subject: expeditionStep?.title || campSubject,
      };
    }
    if (vm.expedition && timer?.phase === 'running') {
      return {
        context: 'departure',
        entityId: vm.expedition.id,
        localDate,
        subject: expeditionStep?.title || campSubject,
      };
    }
    if (vm.parked) {
      return {
        context: vm.parked.status,
        entityId: vm.parked.id,
        localDate,
        subject: vm.parked.title,
      };
    }
    const fallbackSubject = vm.anchor?.nextPhysicalAction
      || vm.active?.title
      || vm.interrupted?.title
      || campSubject;
    const fallbackEntityId = vm.anchor?.id
      || vm.active?.id
      || vm.interrupted?.id
      || `camp:${vm.state.camp?.level || 0}`;
    if (foregroundSession.longAbsence) {
      return {
        context: 'long_absence',
        entityId: vm.anchor?.id || vm.active?.id || vm.interrupted?.id || `camp:${vm.state.camp?.level || 0}`,
        localDate,
        subject: fallbackSubject,
      };
    }
    if (foregroundSession.firstLocalDate) {
      return {
        context: 'first_daily',
        entityId: vm.anchor?.id || vm.active?.id || vm.interrupted?.id || `camp:${vm.state.camp?.level || 0}`,
        localDate,
        subject: fallbackSubject,
      };
    }
    if (
      ['first_daily', 'long_absence'].includes(dialogueCache?.input?.context)
      && dialogueCache.input.entityId === fallbackEntityId
      && dialogueCache.input.localDate === localDate
    ) return dialogueCache.input;
    return {
      context: 'idle',
      entityId: fallbackEntityId,
      localDate,
      subject: fallbackSubject,
    };
  }

  function dialogueTriggerKey(input) {
    return `${input.context}:${input.entityId || 'none'}:${input.localDate}`;
  }

  function syncDialogue(input) {
    if (combatState) return;
    const triggerKey = dialogueTriggerKey(input);
    if (dialogueCache?.triggerKey === triggerKey || dialoguePendingKey === triggerKey) return;
    dialoguePendingKey = triggerKey;
    Core.chooseDialogue({ ...input, triggerKey }).then((text) => {
      if (dialoguePendingKey !== triggerKey) return;
      dialoguePendingKey = null;
      dialogueCache = { triggerKey, text, input };
      if (input.context === 'first_daily') foregroundSession.firstLocalDate = false;
      if (input.context === 'long_absence') {
        foregroundSession.longAbsence = false;
        foregroundSession.firstLocalDate = false;
      }
      const bubble = document.getElementById('v02-dialogue');
      if (bubble?.dataset.v02DialogueTrigger === triggerKey) {
        bubble.textContent = text;
        bubble.removeAttribute('aria-busy');
      }
    }).catch((error) => {
      if (dialoguePendingKey === triggerKey) dialoguePendingKey = null;
      App.toast(error.message, true);
    });
  }

  function characterMediaKey(character, slot) {
    const metadata = character.mediaMetadata?.[slot] || {};
    return [
      slot,
      metadata.mimeType,
      metadata.byteLength,
      metadata.width,
      metadata.height,
      metadata.durationMs,
      character.updatedAt,
    ].join(':');
  }

  function createPortraitElement(character) {
    if (character.portraitUrl || character.imageUrl) {
      const image = document.createElement('img');
      image.id = 'v02-character-image';
      image.dataset.v02CharacterMedia = 'portrait';
      image.src = character.portraitUrl || character.imageUrl;
      image.alt = character.name;
      return image;
    }
    const fallback = document.createElement('span');
    fallback.className = 'v02-default-character';
    fallback.setAttribute('aria-hidden', 'true');
    fallback.append(document.createElement('i'));
    return fallback;
  }

  function downgradeCharacterMedia(element) {
    if (!element?.matches?.('[data-v02-character-media][data-v02-animated]')) return;
    if (!element.isConnected) return;
    const slot = element.dataset.v02CharacterMedia;
    if (!['idle', 'skill'].includes(slot)) return;
    const character = Core.getCharacter();
    const currentKey = characterMediaKey(character, slot);
    if (element.dataset.v02MediaKey !== currentKey) return;
    failedCharacterMedia.set(slot, currentKey);
    if (element.tagName === 'VIDEO') {
      try { element.pause(); } catch (_error) { /* no-op */ }
    }
    element.replaceWith(createPortraitElement(character));
  }

  function handleCharacterMediaError(event) {
    downgradeCharacterMedia(event.target);
  }

  function observeCharacterVideoPlayback(video) {
    if (!video?.isConnected) return;
    video.muted = true;
    video.playsInline = true;
    try {
      const started = video.play();
      if (started?.catch) started.catch(() => downgradeCharacterMedia(video));
    } catch (_error) {
      downgradeCharacterMedia(video);
    }
  }

  function characterArt(slot = 'idle') {
    const character = Core.getCharacter();
    const metadata = character.mediaMetadata?.[slot];
    const mediaUrl = character[`${slot}Url`];
    const mediaKey = characterMediaKey(character, slot);
    const mediaFailed = failedCharacterMedia.get(slot) === mediaKey;
    if (!mediaFailed && !reducedMotionEnabled() && mediaUrl && metadata?.mimeType === 'image/webp') {
      return `<img data-v02-character-media="${slot}" data-v02-media-key="${h(mediaKey)}" data-v02-animated src="${h(mediaUrl)}" alt="${h(character.name)}" />`;
    }
    if (!mediaFailed && !reducedMotionEnabled() && mediaUrl && metadata?.mimeType === 'video/webm') {
      const playback = slot === 'idle' ? ' autoplay loop' : '';
      return `<video data-v02-character-media="${slot}" data-v02-media-key="${h(mediaKey)}" data-v02-animated src="${h(mediaUrl)}" muted playsinline${playback} aria-label="${h(character.name)}"></video>`;
    }
    return character.portraitUrl || character.imageUrl
      ? `<img id="v02-character-image" data-v02-character-media="portrait" src="${h(character.portraitUrl || character.imageUrl)}" alt="${h(character.name)}" />`
      : '<span class="v02-default-character" aria-hidden="true"><i></i></span>';
  }

  function characterStage(slot = 'idle') {
    const character = Core.getCharacter();
    return `
      <div class="v02-character-stage" data-v02-character-stage style="--v02-character-accent:${h(character.accentColor)}">
        <div class="v02-character-art">${characterArt(slot)}</div>
        <div class="v02-character-caption">
          <strong data-v02-character-name>${h(character.name)}</strong>
          <small>${h(character.skillName)} · ${h(character.skillPreset)}</small>
        </div>
        ${character.missingImage ? '<p class="v02-character-notice">저장된 이미지를 찾지 못해 기본 캐릭터를 표시합니다.</p>' : ''}
      </div>
    `;
  }

  function characterSettings(status, previewAvailable) {
    const character = Core.getCharacter();
    const Character = root.StepQuestV02Character;
    const palette = Character?.PALETTE || ['#65d9ff'];
    const presets = [
      ['impact', '임팩트'],
      ['dash', '대시'],
      ['slash', '참격'],
      ['cast', '마법'],
    ];
    const supported = status.characterStorageSupported;
    return `
      <details id="v02-character-settings" class="panel v02-character-settings" ${characterPanelOpen ? 'open' : ''}>
        <summary>캐릭터와 기술 연출</summary>
        <p>가져온 이미지는 이 기기에만 저장되며 개인 사용 범위에서만 쓰세요.</p>
        ${supported ? `
          <div class="v02-character-form">
            <label>캐릭터 이미지
              <input id="v02-character-file" type="file" accept="image/png,image/webp,image/jpeg" />
            </label>
            <label>대기 애니메이션
              <input id="v02-character-idle-file" type="file" accept="image/webp,video/webm" ${character.usingDefault ? 'disabled' : ''} />
            </label>
            <button id="v02-save-character-idle" type="button" class="ghost" ${character.usingDefault ? 'disabled' : ''}>대기 애니메이션 저장</button>
            <label>기술 애니메이션
              <input id="v02-character-skill-file" type="file" accept="image/webp,video/webm" ${character.usingDefault ? 'disabled' : ''} />
            </label>
            <button id="v02-save-character-skill" type="button" class="ghost" ${character.usingDefault ? 'disabled' : ''}>기술 애니메이션 저장</button>
            <label>캐릭터 이름
              <input id="v02-character-name" maxlength="40" value="${h(character.name)}" autocomplete="off" />
            </label>
            <label>기술 프리셋
              <select id="v02-character-preset">
                ${presets.map(([value, label]) => (
                  `<option value="${value}" ${character.skillPreset === value ? 'selected' : ''}>${label}</option>`
                )).join('')}
              </select>
            </label>
            <label>기술명
              <input id="v02-character-skill-name" maxlength="40" value="${h(character.skillName)}" autocomplete="off" />
            </label>
            <label>강조색
              <select id="v02-character-color">
                ${palette.map((value, index) => (
                  `<option value="${value}" ${character.accentColor === value ? 'selected' : ''}>색상 ${index + 1}</option>`
                )).join('')}
              </select>
            </label>
            <div class="v02-fx-previews" role="group" aria-label="기술 연출 미리보기">
              ${presets.map(([value, label]) => (
                `<button type="button" class="ghost" data-v02-fx-preview="${value}" ${previewAvailable ? '' : 'disabled'}>${label} 미리보기</button>`
              )).join('')}
            </div>
            ${previewAvailable ? '' : '<small class="v02-character-notice">현재 행동이나 원정 화면으로 돌아가면 연출을 미리 볼 수 있습니다.</small>'}
            <button id="v02-save-character">이 캐릭터 저장</button>
            ${character.usingDefault ? '' : '<button id="v02-export-character-full" class="ghost">이미지 포함 전체 내보내기</button>'}
          </div>
        ` : `
          <p class="v02-character-notice">이 브라우저에서는 캐릭터 이미지를 저장할 수 없어 기본 캐릭터를 사용합니다.</p>
        `}
      </details>
    `;
  }

  function storagePanel(status) {
    const backupTime = status.lastExternalBackupAt
      ? `마지막 외부 파일 백업: ${h(status.lastExternalBackupAt)}`
      : '외부 파일 백업 기록 없음';
    const needsWarning = (
      status.mode === 'localStorage'
      || !status.persisted
      || status.manualBackupDue
      || status.externalBackupStale
      || status.migrationError
      || status.quarantinedRecords
    );
    let message = '이 브라우저의 저장 공간은 나중에 정리될 수 있습니다.';
    if (status.migrationError) {
      message = '이전 기록을 자동으로 옮기지 못했습니다. 원본은 그대로 보존되어 있습니다.';
    } else if (status.quarantinedRecords) {
      message = `읽을 수 없는 기록 ${status.quarantinedRecords}개를 격리하고 나머지 기록을 열었습니다.`;
    } else if (status.manualBackupDue) {
      message = '변경 사항이 5회 쌓였습니다. 외부 JSON 백업을 갱신하세요.';
    } else if (status.externalBackupStale) {
      message = '외부 자동 백업을 갱신하지 못했습니다. 다시 시도하거나 JSON을 내려받으세요.';
    }
    const className = needsWarning ? 'panel v02-storage-warning' : 'v02-storage-status';
    return `
      <section class="${className}">
        ${needsWarning ? `<p>${message}</p>` : ''}
        <small>${backupTime}</small>
        <div class="v02-storage-actions">
          <button id="v02-export" class="ghost">JSON 백업</button>
          <button id="v02-enable-backup" class="ghost">자동 백업 파일 선택</button>
        </div>
      </section>
    `;
  }

  function combatPanel() {
    const state = combatState;
    const monsterState = state.monsterState || 'ready';
    return `
      <section class="panel v02-expedition" data-v02-combat data-v02-combat-phase="${h(state.phase)}">
        <span class="v02-kicker">전투 기록</span>
        <h2>${h(state.encounter?.name || '알 수 없는 존재')}</h2>
        ${characterStage(state.attack ? 'skill' : 'portrait')}
        <div data-v02-monster-state="${h(monsterState)}">
          <div
            data-v02-monster-hp
            role="progressbar"
            aria-label="${h(state.encounter?.name || '조우')} 체력"
            aria-valuemin="0"
            aria-valuemax="2"
            aria-valuenow="${state.currentHp}"
          ></div>
          <p data-v02-combat-status>${h(state.statusText || '')}</p>
          <p data-v02-damage aria-live="polite">${state.damage ? `${state.damage} 데미지` : ''}</p>
        </div>
        ${state.attack ? '<button id="v02-combat-skip" data-v02-combat-skip type="button">연출 건너뛰기</button>' : ''}
      </section>
    `;
  }

  function battleReportPanel() {
    return `
      <section
        id="v02-battle-report"
        class="panel v02-runner"
        data-v02-report-key="${h(pendingBattleReport.key)}"
      >
        <span class="v02-kicker">전투 리포트</span>
        <h2 data-v02-report-headline>${h(pendingBattleReport.headline)}</h2>
        <p data-v02-report-monster>${h(pendingBattleReport.monsterName)}</p>
        <p data-v02-report-route>${h(pendingBattleReport.route?.label)}</p>
        <p data-v02-report-discovery>${pendingBattleReport.newDiscovery ? '새 발견' : '기존 조우'}</p>
        <p data-v02-report-defeats>몬스터 ${h(pendingBattleReport.defeatCount)}</p>
        <p data-v02-report-gold>골드 ${h(pendingBattleReport.goldGranted)}</p>
        <button id="v02-continue-report" type="button">계속</button>
      </section>
    `;
  }

  function codexPanel(codex) {
    const discovered = codex.entries.filter((entry) => entry.discovered);
    return `
      <section id="v02-codex" class="panel v02-runner">
        <span class="v02-kicker">몬스터 도감</span>
        <h2 id="v02-codex-heading" tabindex="-1">원정에서 만난 존재</h2>
        ${discovered.length ? '' : '<p id="v02-codex-empty">첫 토벌 기록이 여기에 남습니다.</p>'}
        <div class="v02-codex-grid">
          ${codex.entries.map((entry) => entry.discovered ? `
            <article data-v02-codex-entry="${h(entry.id)}">
              <h3>${h(entry.name)}</h3>
              <span data-v02-codex-count>${h(entry.count)}</span>
            </article>
          ` : `
            <article data-v02-codex-entry aria-label="미발견 몬스터"><span aria-hidden="true">???</span></article>
          `).join('')}
        </div>
      </section>
    `;
  }

  function render(focusSelector = null) {
    root.StepQuestV02FX?.cancel();
    App.renderShell('지금 할 한 동작');
    document.body.classList.add('v02-mode');
    const rootNode = document.getElementById('page-root');
    const vm = viewModel();
    const status = Core.getStatus();
    const route = normalizeRouteHash();
    const codex = root.StepQuestV02Fun.buildCodex(vm.state.events);
    const timer = timerView(vm.expedition);
    const anchorDraft = vm.expedition ? readAnchorDraft(vm.expedition.id) : null;
    const campLevel = vm.state.camp?.level || 0;
    const nextCampCost = root.StepQuestV02Domain.campUpgradeCost(campLevel);
    const canUpgradeCamp = campLevel < 5 && vm.state.wallet.gold >= nextCampCost;
    const showNextDesire = route === '#today' || Boolean(pendingBattleReport);
    const expeditionStep = vm.expedition
      ? vm.state.steps.find((item) => item.id === vm.expedition.stepId)
      : null;
    const desireStep = vm.active || expeditionStep || (vm.interrupted ? {
      ...vm.interrupted,
      nextPhysicalAction: vm.anchor?.nextPhysicalAction || vm.interrupted.nextPhysicalAction,
    } : null) || vm.parked;
    const nextDesire = showNextDesire ? root.StepQuestV02Fun.buildNextDesire({
      camp: { ...vm.state.camp, nextCost: nextCampCost },
      wallet: vm.state.wallet,
      activeStep: desireStep,
      encounter: Core.getEncounterView(),
      codex,
    }) : null;
    const stage = characterStage();
    const wallet = `
      <div id="v02-wallet" class="v02-wallet" aria-label="보유 재화">
        <span>스텝코인 <b>${vm.state.wallet.stepCoin}</b></span>
        <span>골드 <b>${vm.state.wallet.gold}</b></span>
        <span id="v02-camp-badge" class="v02-camp-badge" data-camp-level="${campLevel}">${campLevels[campLevel][0]} 캠프 Lv.${campLevel}</span>
      </div>
    `;
    let body;
    let hasCharacterStage = false;

    if (pendingBattleReport) {
      body = battleReportPanel();
    } else if (combatState) {
      hasCharacterStage = true;
      body = combatPanel();
    } else if (status.pendingAccountImport) {
      body = `
        <section class="panel v02-runner">
          <span class="v02-kicker">기기 저장소가 비어 있습니다</span>
          <h2>계정의 현재 행동을 이 기기로 가져올까요?</h2>
          <p>선택하기 전에는 계정이나 이 기기의 기록을 바꾸지 않습니다.</p>
          <div class="primary-actions">
            <button id="v02-import-account">계정 진행 복사</button>
            <button id="v02-empty-local" class="ghost">이 기기에서 새로 시작</button>
          </div>
        </section>
      `;
    } else if (route === '#codex') {
      body = codexPanel(codex);
    } else if (vm.pendingObstacle) {
      body = `
        <section class="panel v02-obstacle">
          <span class="v02-kicker">멈춘 이유를 탓하지 않습니다</span>
          <h2>지금 무엇이 막고 있나요?</h2>
          <button id="v02-retry-step" class="ghost">잘못 눌렀어요 → 지금 다시 시작</button>
          <div class="reason-grid">
            ${Object.entries(reasons).map(([value, label]) => (
              `<button class="reason-button" data-v02-reason="${value}">${label}</button>`
            )).join('')}
          </div>
          ${obstacleActionPanel()}
        </section>
      `;
    } else if (vm.expedition && reporting) {
      const presentation = reportPresentation();
      body = `
        <section id="v02-return-report" class="panel v02-runner">
          <span class="v02-kicker">${presentation.kicker}</span>
          <h2>어떻게 돌아왔나요?</h2>
          <button id="v02-cancel-report" class="ghost">${presentation.cancel}</button>
          <div class="v02-outcome-grid">
            ${Object.entries(outcomeLabels).map(([value, label]) => (
              `<button data-v02-outcome="${value}">${label}</button>`
            )).join('')}
          </div>
          ${['partial', 'interrupted'].includes(selectedOutcome) ? `
            <div class="v02-anchor">
              <label>마지막으로 한 것<input id="v02-last-action" value="${h(anchorDraft?.lastCompletedAction || '')}" autocomplete="off" /></label>
              <label>다음 손동작<input id="v02-next-action" value="${h(anchorDraft?.nextPhysicalAction || '')}" aria-required="true" autocomplete="off" /></label>
              <label>장소<input id="v02-location" value="${h(anchorDraft?.location || '')}" autocomplete="off" /></label>
              <label>필요한 준비물<input id="v02-material" value="${h(anchorDraft?.requiredMaterial || '')}" autocomplete="off" /></label>
              <label>메모<textarea id="v02-note">${h(anchorDraft?.note || '')}</textarea></label>
              <button id="v02-save-outcome">기록 저장</button>
            </div>
          ` : ''}
        </section>
      `;
    } else if (vm.expedition && timer?.phase === 'running') {
      const step = vm.state.steps.find((item) => item.id === vm.expedition.stepId);
      const encounter = Core.getEncounterView();
      hasCharacterStage = true;
      body = `
        <section id="v02-expedition-active" class="panel v02-expedition">
          <span class="v02-kicker">원정 진행 중</span>
          <h2>${h(step?.title)}</h2>
          ${stage}
          <div data-v02-encounter>
            <span>${h(routeLabel(timer.plannedMinutes))}에서 마주친 존재</span>
            <strong>${h(encounter?.name || '알 수 없는 존재')}</strong>
          </div>
          <time data-v02-countdown data-v02-expedition-id="${h(vm.expedition.id)}" aria-label="남은 원정 시간">${formatCountdown(timer.remainingMs)}</time>
          <p>앱을 닫아도 됩니다.</p>
          <button id="v02-open-report">일찍 돌아왔어요</button>
        </section>
      `;
    } else if (vm.expedition && timer?.phase === 'ready') {
      const step = vm.state.steps.find((item) => item.id === vm.expedition.stepId);
      hasCharacterStage = true;
      body = `
        <section id="v02-expedition-ready" class="panel v02-expedition">
          <span class="v02-kicker">수확 준비 완료</span>
          <h2>${h(step?.title)} 원정 기록이 도착했습니다.</h2>
          ${stage}
          <p>돌아온 기록을 차분히 확인할 수 있습니다.</p>
          <button id="v02-open-report">전리품 확인</button>
        </section>
      `;
    } else if (vm.expedition) {
      const step = vm.state.steps.find((item) => item.id === vm.expedition.stepId);
      body = `
        <section id="v02-expedition-legacy-ready" class="panel v02-expedition">
          <span class="v02-kicker">이전 원정 기록</span>
          <h2>${h(step?.title)}</h2>
          <p>이전 버전에서 시작한 원정입니다. 남은 시간을 계산하지 않고 기존 귀환 기록을 이어갑니다.</p>
          <button id="v02-open-report">귀환 기록 열기</button>
        </section>
      `;
    } else if (vm.interrupted && vm.anchor) {
      body = `
        <section id="v02-resume-anchor" class="panel v02-anchor">
          <span class="v02-kicker">마지막 위치</span>
          <p>${h(vm.anchor.lastCompletedAction || '시작한 기록이 남아 있습니다.')}</p>
          <span>다음 손동작</span>
          <h2>${h(vm.anchor.nextPhysicalAction)}</h2>
          <button id="v02-resume-step">재개</button>
        </section>
      `;
    } else if (vm.active) {
      hasCharacterStage = true;
      body = `
        <section class="panel v02-runner">
          <span class="v02-kicker">지금 할 하나</span>
          <h2 data-v02-current-step>${h(vm.active.title)}</h2>
          ${stage}
          <p>완료를 약속하지 않아도 됩니다. 시작 위치만 남깁니다.</p>
          ${durationChooser()}
          <button id="v02-start-step">시작</button>
        </section>
      `;
    } else if (vm.parked) {
      const panelId = {
        deferred: 'v02-deferred-step',
        blocked: 'v02-blocked-step',
        waiting: 'v02-waiting-step',
      }[vm.parked.status];
      const statusText = {
        deferred: '나중에 하기로 함',
        blocked: '준비물을 기다리는 중',
        waiting: '답을 기다리는 중',
      }[vm.parked.status];
      const context = vm.parked.blockContext?.note || vm.parked.deferContext?.note;
      const actionId = vm.parked.status === 'deferred' ? 'v02-undefer-step' : 'v02-unblock-step';
      body = `
        <section id="${panelId}" class="panel v02-runner">
          <span class="v02-kicker">${statusText}</span>
          <h2>${h(vm.parked.title)}</h2>
          ${context ? `<p>${h(context)}</p>` : ''}
          <button id="${actionId}">다시 꺼내기</button>
        </section>
      `;
    } else {
      hasCharacterStage = true;
      body = `
        <section class="panel v02-runner">
          <span class="v02-kicker">큰 목표는 한 줄이면 충분합니다</span>
          ${stage}
          <label class="v02-goal-label">목표 한 줄<input id="v02-goal-title" maxlength="140" autocomplete="off" /></label>
          <button id="v02-create-goal">첫 행동 만들기</button>
        </section>
      `;
    }

    const showCamp = route === '#today' && !combatState && !pendingBattleReport && Boolean(
      vm.expedition
      || vm.parked
      || !vm.state.goals.length
      || canUpgradeCamp
      || campMessage,
    );
    const campPanel = showCamp ? `
      <section class="panel v02-camp">
        ${campVisual(campLevel)}
        ${vm.expedition ? '<p>캐릭터가 캠프에서 원정을 준비합니다.</p>' : ''}
        ${canUpgradeCamp ? `<button id="v02-upgrade-camp" class="ghost">캠프 확장 · 골드 ${nextCampCost}</button>` : ''}
        ${campMessage ? `
          <div id="v02-camp-message" class="v02-camp-message" aria-live="polite">
            <span>${h(campMessage)}</span>
            <button id="v02-dismiss-camp-message" class="ghost" aria-label="캠프 알림 닫기">닫기</button>
          </div>
        ` : ''}
      </section>
    ` : '';
    const navigation = `
      <nav class="v02-navigation" aria-label="주요 화면">
        <a id="v02-nav-today" href="#today"${route === '#today' ? ' aria-current="page"' : ''}>오늘</a>
        <a id="v02-nav-codex" href="#codex"${route === '#codex' ? ' aria-current="page"' : ''}>도감</a>
      </nav>
    `;
    const dialogueInput = dialogueProjection(vm, timer);
    const dialogueKey = dialogueTriggerKey(dialogueInput);
    const dialogueText = dialogueCache?.triggerKey === dialogueKey ? dialogueCache.text : '';
    const dialogue = `<p id="v02-dialogue" data-v02-dialogue-trigger="${h(dialogueKey)}"${dialogueText ? '' : ' aria-busy="true"'}>${h(dialogueText || '…')}</p>`;
    const desire = nextDesire ? `<p id="v02-next-desire">${h(nextDesire.text)}</p>` : '';
    rootNode.innerHTML = `${navigation}${wallet}${dialogue}${body}${desire}${campPanel}${characterSettings(status, hasCharacterStage)}${storagePanel(status)}<p id="v02-live" aria-live="polite"></p>`;
    wire();
    syncDialogue(dialogueInput);
    syncTimer(timer);
    if (!reporting && timer?.phase === 'ready') announceReady(vm.expedition.id);
    if (focusSelector) {
      Promise.resolve().then(() => {
        const target = document.querySelector(focusSelector);
        if (!target) return;
        if (/^H[1-6]$/.test(target.tagName) && !target.hasAttribute('tabindex')) {
          target.setAttribute('tabindex', '-1');
        }
        target.focus();
      });
    }
  }

  function playCharacterFx(mode, preset, restoreFocus, options = {}) {
    const stage = document.querySelector('[data-v02-character-stage]');
    const characterElement = stage?.querySelector('[data-v02-character-media], #v02-character-image, .v02-default-character');
    const characterValue = Core.getCharacter();
    return root.StepQuestV02FX?.play({
      stage,
      character: characterElement,
      preset: preset || characterValue.skillPreset,
      skillName: characterValue.skillName,
      color: characterValue.accentColor,
      mode,
      reducedMotion: reducedMotionEnabled(),
      restoreFocus,
      ...options,
    });
  }

  function createCombatPlaybackSession() {
    const controller = new AbortController();
    return {
      controller,
      signal: controller.signal,
      timers: new Set(),
      hitAnimation: null,
      finalized: false,
    };
  }

  function waitForCombat(playback, duration) {
    if (playback.signal.aborted) return Promise.resolve();
    return new Promise((resolve) => {
      let timer = null;
      const finish = () => {
        if (timer !== null) {
          root.clearTimeout(timer);
          playback.timers.delete(timer);
        }
        playback.signal.removeEventListener('abort', finish);
        resolve();
      };
      timer = root.setTimeout(finish, duration);
      playback.timers.add(timer);
      playback.signal.addEventListener('abort', finish, { once: true });
    });
  }

  function stopCombatMedia() {
    const media = document.querySelector('[data-v02-character-media="skill"]');
    if (media?.tagName !== 'VIDEO') return;
    try { media.pause(); } catch (_error) { /* no-op */ }
    try { media.currentTime = 0; } catch (_error) { /* no-op */ }
  }

  function playSkillMedia(playback) {
    const media = document.querySelector('[data-v02-character-media="skill"]');
    if (!media || reducedMotionEnabled()) return Promise.resolve();
    const duration = Math.max(1, Number(Core.getCharacter().mediaMetadata?.skill?.durationMs || 1));
    if (media.tagName === 'VIDEO') {
      media.muted = true;
      media.playsInline = true;
      media.loop = false;
      try { media.currentTime = 0; } catch (_error) { /* no-op */ }
      observeCharacterVideoPlayback(media);
    }
    return waitForCombat(playback, duration);
  }

  function applyCombatFinalDom(state, showDamage) {
    const hp = document.querySelector('[data-v02-monster-hp]');
    const monster = document.querySelector('[data-v02-monster-state]');
    const statusText = document.querySelector('[data-v02-combat-status]');
    const damage = document.querySelector('[data-v02-damage]');
    hp?.setAttribute('aria-valuenow', String(state.afterHp));
    monster?.setAttribute(
      'data-v02-monster-state',
      state.afterHp === 0 ? 'defeated' : state.delta > 0 ? 'hit' : 'guarded',
    );
    if (statusText) {
      statusText.textContent = state.afterHp === 0
        ? '조우를 마쳤습니다.'
        : state.delta > 0
          ? '진행이 체력에 반영되었습니다.'
          : '흔적은 그대로 남아 있습니다.';
    }
    if (damage) damage.textContent = showDamage && state.delta > 0 ? `${state.delta} 데미지` : '';
  }

  function finalizeCombat(playback, skipped = false) {
    if (!playback || playback.finalized || combatPlayback !== playback || !combatState) return;
    playback.finalized = true;
    applyCombatFinalDom(combatState, !skipped && combatState.delta > 0);
    playback.controller.abort();
    playback.timers.forEach((timer) => root.clearTimeout(timer));
    playback.timers.clear();
    stopCombatMedia();
    root.StepQuestV02FX?.cancel();
    try { playback.hitAnimation?.cancel(); } catch (_error) { /* no-op */ }
    pendingBattleReport = combatState.pending;
    combatState = null;
    combatPlayback = null;
    render('#v02-battle-report h2');
    if (combatLifecycleRefreshPending) {
      combatLifecycleRefreshPending = false;
      enqueueLifecycle(refreshFromLifecycle);
    }
  }

  async function playMonsterHit(playback) {
    if (playback.signal.aborted || combatPlayback !== playback) return;
    combatState.currentHp = combatState.afterHp;
    combatState.damage = combatState.delta;
    combatState.monsterState = combatState.afterHp === 0 ? 'defeated' : 'hit';
    applyCombatFinalDom(combatState, true);
    const monster = document.querySelector('[data-v02-monster-state]');
    if (monster?.animate) {
      playback.hitAnimation = monster.animate(
        combatState.afterHp === 0
          ? [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(18px)' }]
          : [{ transform: 'translateX(0)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }],
        { duration: 320, easing: 'ease-out', fill: 'forwards' },
      );
    }
    await waitForCombat(playback, 450);
  }

  async function startCombatSequence(context) {
    const playback = createCombatPlaybackSession();
    combatPlayback = playback;
    const delta = context.beforeHp - context.afterHp;
    const attacks = delta > 0 && ['completed', 'partial'].includes(context.outcome);
    combatState = {
      ...context,
      delta,
      attack: attacks && !reducedMotionEnabled(),
      phase: attacks ? 'playback' : context.outcome === 'partial' ? 'guard' : 'handoff',
      currentHp: attacks && !reducedMotionEnabled() ? context.beforeHp : context.afterHp,
      damage: attacks && reducedMotionEnabled() ? delta : 0,
      monsterState: attacks && reducedMotionEnabled()
        ? context.afterHp === 0 ? 'defeated' : 'hit'
        : context.outcome === 'partial' ? 'guarded' : 'ready',
      statusText: context.outcome === 'partial' && delta === 0
        ? '막아냈지만 흔적은 그대로 남아 있습니다.'
        : '',
    };

    if (!attacks && context.outcome !== 'partial') {
      finalizeCombat(playback);
      return;
    }

    render();
    if (!attacks) {
      await waitForCombat(playback, 360);
      if (!playback.signal.aborted) finalizeCombat(playback);
      return;
    }

    if (reducedMotionEnabled()) {
      applyCombatFinalDom(combatState, delta > 0);
      await Promise.allSettled([
        playCharacterFx(context.outcome === 'partial' ? 'progress' : context.result.goalMilestone ? 'milestone' : 'completed', null, null, {
          signal: playback.signal,
          interactive: false,
        }),
      ]);
      if (!playback.signal.aborted) finalizeCombat(playback);
      return;
    }

    await Promise.allSettled([
      playSkillMedia(playback),
      playCharacterFx(context.outcome === 'partial' ? 'progress' : context.result.goalMilestone ? 'milestone' : 'completed', null, null, {
        signal: playback.signal,
        interactive: false,
      }),
    ]);
    if (playback.signal.aborted) return;
    await playMonsterHit(playback);
    if (!playback.signal.aborted) finalizeCombat(playback);
  }

  async function commitCombatOutcome(command) {
    const before = Core.getSnapshot();
    const expedition = before.expeditions.find((item) => item.status === 'active');
    if (!expedition) throw new Error('ACTIVE_EXPEDITION_NOT_FOUND');
    const originalStep = before.steps.find((item) => item.id === expedition.stepId);
    if (!originalStep) throw new Error('ACTIVE_STEP_NOT_FOUND');
    const Fun = root.StepQuestV02Fun;
    if (!Fun?.deriveEncounterHp) throw new Error('FUN_MODULE_NOT_LOADED');
    const beforeHp = Fun.deriveEncounterHp(originalStep, before.rewards);
    const encounter = Core.getEncounterView();
    const result = await Core.reportCurrentExpedition(command);
    const after = Core.getSnapshot();
    const sameStep = after.steps.find((item) => item.id === originalStep.id);
    if (!sameStep) throw new Error('REPORTED_STEP_NOT_FOUND');
    const afterHp = Fun.deriveEncounterHp(sameStep, after.rewards);
    const pending = await Core.getPendingBattleReport();
    if (!pending || pending.key !== command.idempotencyKey) throw new Error('BATTLE_REPORT_HANDOFF_MISSING');
    return {
      outcome: command.outcome,
      result,
      pending,
      encounter,
      stepId: originalStep.id,
      rewardLineage: originalStep.rewardLineage,
      beforeHp,
      afterHp,
    };
  }

  function setReportCommitControlsDisabled(disabled) {
    document.querySelectorAll(
      '#v02-return-report button, #v02-return-report input, #v02-return-report textarea, #v02-return-report select',
    ).forEach((control) => {
      control.disabled = disabled;
    });
  }

  function beginReportCommit() {
    if (reportCommitInFlight) return false;
    reportCommitInFlight = true;
    setReportCommitControlsDisabled(true);
    return true;
  }

  function finishReportCommit(restoreControls = false) {
    reportCommitInFlight = false;
    if (restoreControls) setReportCommitControlsDisabled(false);
  }

  async function run(button, action, afterRender) {
    if (button.disabled) return;
    button.disabled = true;
    try {
      const result = await action();
      if (result === false) button.disabled = false;
      else {
        render();
        if (afterRender) Promise.resolve().then(() => afterRender(result)).catch(() => {});
      }
    } catch (error) {
      button.disabled = false;
      App.toast(error.message, true);
    }
  }

  async function routeSelectedObstacle(route, extra = {}) {
    const report = viewModel().pendingObstacle;
    await Core.routeCurrentObstacle({
      ...extra,
      reason: selectedReason,
      route,
      reportIdempotencyKey: report.idempotencyKey,
      idempotencyKey: key(`obstacle:${selectedReason}:${route}`, report.idempotencyKey),
    });
    selectedReason = null;
    tiredShrink = false;
  }

  function wire() {
    observeCharacterVideoPlayback(
      document.querySelector('video[data-v02-character-media="idle"]'),
    );
    document.querySelectorAll('[name="v02-expedition-minutes"]').forEach((field) => {
      field.addEventListener('change', () => {
        const minutes = Number(field.value);
        if (!field.checked || ![5, 10, 25].includes(minutes)) return;
        selectedMinutes = minutes;
        const teaser = document.querySelector('[data-v02-expedition-teaser]');
        if (teaser) teaser.textContent = teaserText(minutes);
      });
    });
    document.getElementById('v02-character-settings')?.addEventListener('toggle', (event) => {
      characterPanelOpen = event.currentTarget.open;
    });
    document.getElementById('v02-save-character')?.addEventListener('click', (event) => (
      run(event.currentTarget, async () => {
        const fileField = document.getElementById('v02-character-file');
        const file = fileField.files?.[0];
        if (!file) {
          fileField.focus();
          App.toast('저장할 캐릭터 이미지를 먼저 선택해 주세요.', true);
          return false;
        }
        characterPanelOpen = true;
        await Core.importCharacter({
          file,
          name: document.getElementById('v02-character-name').value,
          skillPreset: document.getElementById('v02-character-preset').value,
          skillName: document.getElementById('v02-character-skill-name').value,
          accentColor: document.getElementById('v02-character-color').value,
        });
        return true;
      })
    ));
    ['idle', 'skill'].forEach((slot) => {
      document.getElementById(`v02-save-character-${slot}`)?.addEventListener('click', (event) => (
        run(event.currentTarget, async () => {
          const fileField = document.getElementById(`v02-character-${slot}-file`);
          const file = fileField.files?.[0];
          if (!file) {
            fileField.focus();
            App.toast('저장할 애니메이션을 먼저 선택해 주세요.', true);
            return false;
          }
          characterPanelOpen = true;
          await Core.importCharacterMedia(slot, file);
          return true;
        })
      ));
    });
    document.getElementById('v02-export-character-full')?.addEventListener('click', (event) => (
      run(event.currentTarget, async () => {
        root.StepQuestV02Backup.downloadJson(
          await Core.exportFullJson(),
          document,
          root.URL,
          'stepquest-full-backup-with-images.json',
        );
        return false;
      })
    ));
    document.querySelectorAll('[data-v02-fx-preview]').forEach((button) => {
      button.addEventListener('click', () => {
        characterPanelOpen = true;
        playCharacterFx('preview', button.dataset.v02FxPreview, button)?.catch(() => {});
      });
    });
    document.getElementById('v02-create-goal')?.addEventListener('click', (event) => (
      run(event.currentTarget, async () => {
        const field = document.getElementById('v02-goal-title');
        const title = field.value.trim();
        if (!title) {
          field.focus();
          return false;
        }
        await Core.createGoal({
          title,
          category: 'auto',
          burdenLevel: 4,
          energyLevel: 'medium',
        });
        return true;
      })
    ));
    document.getElementById('v02-start-step')?.addEventListener('click', (event) => (
      run(event.currentTarget, async () => {
        const state = Core.getSnapshot();
        const step = state.steps.find((item) => item.status === 'active');
        const attempt = state.events.filter((item) => (
          item.type === 'step_started' && item.stepId === step.id
        )).length;
        const minutes = Number(document.querySelector('[name="v02-expedition-minutes"]:checked')?.value);
        const result = await Core.startCurrentStep(key('start', `${step.id}:${attempt}`), minutes);
        selectedMinutes = minutes;
        reporting = false;
        reportingEntry = null;
        return result;
      }, () => playCharacterFx('departure'))
    ));
    document.getElementById('v02-open-report')?.addEventListener('click', () => {
      const expedition = Core.getSnapshot().expeditions.find((item) => item.status === 'active');
      const timer = timerView(expedition);
      reporting = true;
      reportingEntry = timer?.phase === 'running'
        ? 'early'
        : timer?.phase === 'legacy_ready'
          ? 'legacy'
          : 'harvest';
      render(selectedOutcome ? '#v02-next-action' : '[data-v02-outcome]');
    });
    document.getElementById('v02-cancel-report')?.addEventListener('click', () => {
      reporting = false;
      reportingEntry = null;
      selectedOutcome = null;
      render('#v02-open-report');
    });
    document.querySelectorAll('[data-v02-outcome]').forEach((button) => {
      button.addEventListener('click', (event) => {
        if (reportCommitInFlight) return;
        const outcome = button.dataset.v02Outcome;
        selectedOutcome = outcome;
        if (outcome === 'partial' || outcome === 'interrupted') {
          const expedition = Core.getSnapshot().expeditions.find((item) => item.status === 'active');
          writeAnchorDraft(expedition.id, { outcome });
          render('#v02-next-action');
          return;
        }
        if (event.currentTarget.disabled || !beginReportCommit()) return;
        (async () => {
          const expedition = Core.getSnapshot().expeditions.find((item) => item.status === 'active');
          const context = await commitCombatOutcome({
            outcome,
            idempotencyKey: key('report', expedition.id),
          });
          clearAnchorDraft(expedition.id);
          reporting = false;
          reportingEntry = null;
          selectedOutcome = null;
          selectedReason = null;
          await startCombatSequence(context);
          finishReportCommit();
        })().catch((error) => {
          finishReportCommit(true);
          App.toast(error.message, true);
        });
      });
    });
    document.getElementById('v02-save-outcome')?.addEventListener('click', (event) => {
      if (reportCommitInFlight || event.currentTarget.disabled) return;
      const nextField = document.getElementById('v02-next-action');
      const nextPhysicalAction = nextField.value.trim();
      if (!nextPhysicalAction) {
        nextField.focus();
        return;
      }
      const reportOutcome = selectedOutcome;
      if (!beginReportCommit()) return;
      (async () => {
        const expedition = Core.getSnapshot().expeditions.find((item) => item.status === 'active');
        const context = await commitCombatOutcome({
          outcome: reportOutcome,
          idempotencyKey: key('report', expedition.id),
          anchor: {
            lastCompletedAction: document.getElementById('v02-last-action').value.trim(),
            nextPhysicalAction,
            location: document.getElementById('v02-location').value.trim(),
            requiredMaterial: document.getElementById('v02-material').value.trim(),
            note: document.getElementById('v02-note').value.trim(),
          },
        });
        clearAnchorDraft(expedition.id);
        reporting = false;
        reportingEntry = null;
        selectedOutcome = null;
        await startCombatSequence(context);
        finishReportCommit();
      })().catch((error) => {
        finishReportCommit(true);
        App.toast(error.message, true);
      });
    });
    ['v02-last-action', 'v02-next-action', 'v02-location', 'v02-material', 'v02-note']
      .forEach((id) => document.getElementById(id)?.addEventListener('input', () => {
        const expedition = Core.getSnapshot().expeditions.find((item) => item.status === 'active');
        captureAnchorDraft(expedition?.id);
      }));
    document.getElementById('v02-resume-step')?.addEventListener('click', (event) => (
      run(event.currentTarget, async () => {
        const state = Core.getSnapshot();
        const step = state.steps.find((item) => item.status === 'interrupted');
        const attempt = state.events.filter((item) => (
          item.type === 'step_resumed' && item.stepId === step.id
        )).length;
        await Core.resumeCurrentStep(step.id, key('resume', `${step.id}:${attempt}`));
      })
    ));
    document.getElementById('v02-undefer-step')?.addEventListener('click', (event) => (
      run(event.currentTarget, async () => {
        const state = Core.getSnapshot();
        const step = state.steps.find((item) => item.status === 'deferred');
        const attempt = state.events.filter((item) => (
          item.type === 'step_undeferred' && item.stepId === step.id
        )).length;
        await Core.undeferCurrentStep(step.id, key('undefer', `${step.id}:${attempt}`));
      })
    ));
    document.getElementById('v02-unblock-step')?.addEventListener('click', (event) => (
      run(event.currentTarget, async () => {
        const state = Core.getSnapshot();
        const step = state.steps.find((item) => item.status === 'blocked' || item.status === 'waiting');
        const attempt = state.events.filter((item) => (
          item.type === 'step_unblocked' && item.stepId === step.id
        )).length;
        await Core.unblockCurrentStep(step.id, key('unblock', `${step.id}:${attempt}`));
      })
    ));
    document.querySelectorAll('[data-v02-reason]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedReason = button.dataset.v02Reason;
        tiredShrink = false;
        render();
      });
    });
    document.getElementById('v02-tired-smaller')?.addEventListener('click', () => {
      tiredShrink = true;
      render();
    });
    document.getElementById('v02-retry-step')?.addEventListener('click', (event) => (
      run(event.currentTarget, async () => {
        const report = viewModel().pendingObstacle;
        await Core.routeCurrentObstacle({
          reason: misTapReason,
          route: 'retry',
          reportIdempotencyKey: report.idempotencyKey,
          idempotencyKey: key(`obstacle:${misTapReason}:retry`, report.idempotencyKey),
        });
        selectedReason = null;
      })
    ));
    document.getElementById('v02-manual-shrink')?.addEventListener('click', (event) => (
      run(event.currentTarget, async () => {
        const field = document.getElementById('v02-smaller-action');
        const nextPhysicalAction = field.value.trim();
        if (!nextPhysicalAction) {
          field.focus();
          return false;
        }
        await routeSelectedObstacle('manual_shrink', { nextPhysicalAction });
      })
    ));
    document.getElementById('v02-defer')?.addEventListener('click', (event) => (
      run(event.currentTarget, () => routeSelectedObstacle('defer'))
    ));
    document.getElementById('v02-tired-defer')?.addEventListener('click', (event) => (
      run(event.currentTarget, () => routeSelectedObstacle('defer'))
    ));
    document.getElementById('v02-defer-place')?.addEventListener('click', (event) => (
      run(event.currentTarget, async () => {
        const field = document.getElementById('v02-defer-note');
        const deferNote = field.value.trim();
        if (!deferNote) {
          field.focus();
          return false;
        }
        await routeSelectedObstacle('defer', { deferNote });
        return true;
      })
    ));
    document.getElementById('v02-block-material')?.addEventListener('click', (event) => (
      run(event.currentTarget, async () => {
        const field = document.getElementById('v02-block-note');
        const blockNote = field.value.trim();
        if (!blockNote) {
          field.focus();
          return false;
        }
        await routeSelectedObstacle('block', { blockKind: 'material', blockNote });
        return true;
      })
    ));
    document.getElementById('v02-block-person')?.addEventListener('click', (event) => (
      run(event.currentTarget, async () => {
        const field = document.getElementById('v02-block-note');
        const blockNote = field.value.trim();
        if (!blockNote) {
          field.focus();
          return false;
        }
        await routeSelectedObstacle('block', { blockKind: 'person', blockNote });
        return true;
      })
    ));
    document.getElementById('v02-upgrade-camp')?.addEventListener('click', (event) => (
      run(event.currentTarget, async () => {
        const level = Core.getSnapshot().camp?.level || 0;
        await Core.upgradeCamp(key('camp-upgrade', level + 1));
        campMessage = '캠프가 조금 더 편안해졌습니다.';
      })
    ));
    document.getElementById('v02-dismiss-camp-message')?.addEventListener('click', () => {
      campMessage = null;
      render();
    });
    document.getElementById('v02-import-account')?.addEventListener('click', (event) => (
      run(event.currentTarget, () => Core.importAccountProgress())
    ));
    document.getElementById('v02-empty-local')?.addEventListener('click', (event) => (
      run(event.currentTarget, () => Core.keepLocalProfileEmpty())
    ));
    document.getElementById('v02-export')?.addEventListener('click', (event) => (
      run(event.currentTarget, async () => {
        root.StepQuestV02Backup.downloadJson(await Core.exportJson());
        return false;
      })
    ));
    document.getElementById('v02-enable-backup')?.addEventListener('click', (event) => (
      run(event.currentTarget, () => Core.enableExternalBackup())
    ));
    document.getElementById('v02-combat-skip')?.addEventListener('click', () => {
      finalizeCombat(combatPlayback, true);
    });
    document.getElementById('v02-continue-report')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      const reportKey = pendingBattleReport?.key;
      if (!reportKey || button.disabled) return;
      button.disabled = true;
      try {
        const acknowledged = await Core.acknowledgeBattleReport(reportKey);
        if (!acknowledged) {
          await hydratePendingBattleReport();
          render('#v02-battle-report h2');
          return;
        }
        await Core.refreshSnapshot();
        const latest = await Core.getPendingBattleReport();
        if (latest) {
          pendingBattleReport = latest;
          render('#v02-battle-report h2');
          return;
        }
        if (pendingBattleReport && pendingBattleReport.key !== reportKey) {
          render('#v02-battle-report h2');
          return;
        }
        pendingBattleReport = null;
        root.history.replaceState(null, '', '#today');
        render('#page-root h2, #page-root button');
      } catch (error) {
        button.disabled = false;
        App.toast(error.message, true);
      }
    });
  }

  function reconcileRefreshedPresentation(before) {
    const after = lifecyclePresentation();
    const expeditionChanged = before.expeditionRecord !== after.expeditionRecord;

    if (expeditionChanged) {
      reporting = false;
      reportingEntry = null;
      const draft = readAnchorDraft(after.expedition?.id);
      selectedOutcome = ['partial', 'interrupted'].includes(draft?.outcome)
        ? draft.outcome
        : null;
      selectedReason = null;
      tiredShrink = false;
      timerExpeditionId = null;
      alignTimerSession(after.expedition);
    }

    const timer = timerView(after.expedition);
    if (reporting && !expeditionChanged) {
      refreshCharacterUrlInPlace();
      syncTimer(timer);
      return;
    }

    const stateUnchanged = (
      before.snapshot === after.snapshot
      && before.status === after.status
      && before.character === after.character
      && before.selectedMinutes === after.selectedMinutes
      && before.pendingReportKey === after.pendingReportKey
    );
    if (stateUnchanged && after.renderedPhase === (timer?.phase || null)) {
      refreshCharacterUrlInPlace();
      if (timer?.phase === 'running') updateCountdown(timer, after.expedition.id);
      syncTimer(timer);
      return;
    }
    render();
  }

  async function refreshFromLifecycle() {
    if (combatPlayback && !combatPlayback.finalized) {
      combatLifecycleRefreshPending = true;
      return;
    }
    const before = lifecyclePresentation();
    await Core.refreshSnapshot();
    await hydratePendingBattleReport();
    reconcileRefreshedPresentation(before);
  }

  function enqueueLifecycle(action, reportError = true) {
    const pending = refreshQueue.then(action);
    refreshQueue = pending.catch((error) => {
      if (reportError) App.toast(error.message, true);
    });
    return pending;
  }

  function queueLifecycleRefresh() {
    enqueueLifecycle(refreshFromLifecycle);
  }

  function bindLifecycle() {
    if (lifecycleBound) return;
    lifecycleBound = true;
    document.addEventListener('error', handleCharacterMediaError, true);
    document.addEventListener('visibilitychange', queueLifecycleRefresh);
    document.addEventListener('change', (event) => {
      if (event.target?.id !== 'reduced-motion-toggle') return;
      Promise.resolve().then(() => render('#reduced-motion-toggle'));
    });
    root.addEventListener('pageshow', queueLifecycleRefresh);
    root.addEventListener('focus', queueLifecycleRefresh);
    if (!hashRouteBound) {
      hashRouteBound = true;
      root.addEventListener('hashchange', () => {
        const route = normalizeRouteHash();
        render(route === '#codex' ? '#v02-codex-heading' : '#page-root button');
      });
    }
  }

  async function mount(options) {
    const nextApp = options.App;
    const nextCore = options.Core;
    return enqueueLifecycle(async () => {
      const wasMounted = mounted;
      const before = wasMounted ? lifecyclePresentation() : null;
      App = nextApp;
      Core = nextCore;
      bindLifecycle();
      await Core.init({ App });
      const nextSelectedMinutes = await Core.getLastExpeditionMinutes();
      await Core.refreshSnapshot();
      await hydratePendingBattleReport();
      selectedMinutes = nextSelectedMinutes;
      if (wasMounted) {
        reconcileRefreshedPresentation(before);
        return;
      }
      reporting = false;
      reportingEntry = null;
      combatState = null;
      combatPlayback = null;
      combatLifecycleRefreshPending = false;
      reportCommitInFlight = false;
      foregroundSession = await Core.beginForegroundSession(currentLocalDate());
      dialogueCache = null;
      dialoguePendingKey = null;
      const expedition = Core.getSnapshot().expeditions.find((item) => item.status === 'active');
      const draft = readAnchorDraft(expedition?.id);
      selectedOutcome = ['partial', 'interrupted'].includes(draft?.outcome)
        ? draft.outcome
        : null;
      selectedReason = null;
      tiredShrink = false;
      campMessage = null;
      characterPanelOpen = false;
      normalizeRouteHash();
      render();
      mounted = true;
    }, false);
  }

  root.StepQuestV02UI = { mount, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
