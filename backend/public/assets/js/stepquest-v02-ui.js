(function exposeUi(root) {
  let App;
  let Core;
  let reporting = false;
  let reportDismissed = false;
  let selectedOutcome = null;
  let selectedReason = null;
  let tiredShrink = false;

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
  const h = (value) => App.h(String(value ?? ''));
  const key = (name, id) => `v02:${name}:${id}`;
  const anchorDraftKey = (expeditionId) => `stepquest_v02_anchor_draft_${expeditionId}`;

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

  function render() {
    App.renderShell('지금 할 한 동작');
    document.body.classList.add('v02-mode');
    const rootNode = document.getElementById('page-root');
    const vm = viewModel();
    const status = Core.getStatus();
    const anchorDraft = vm.expedition ? readAnchorDraft(vm.expedition.id) : null;
    const wallet = `
      <div id="v02-wallet" class="v02-wallet" aria-label="보유 재화">
        <span>스텝코인 <b>${vm.state.wallet.stepCoin}</b></span>
        <span>골드 <b>${vm.state.wallet.gold}</b></span>
      </div>
    `;
    let body;

    if (status.pendingAccountImport) {
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
    } else if (vm.expedition && (reporting || (status.recoveredExpedition && !reportDismissed))) {
      body = `
        <section id="v02-return-report" class="panel v02-runner">
          <span class="v02-kicker">평가가 아니라 다음 위치를 정합니다</span>
          <h2>어떻게 돌아왔나요?</h2>
          <button id="v02-cancel-report" class="ghost">아직 진행 중이에요 → 돌아가기</button>
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
    } else if (vm.expedition) {
      const step = vm.state.steps.find((item) => item.id === vm.expedition.stepId);
      body = `
        <section id="v02-expedition-active" class="panel v02-expedition">
          <span class="v02-kicker">원정 진행 중</span>
          <h2>${h(step?.title)}</h2>
          <p>앱을 닫아도 됩니다.</p>
          <button id="v02-open-report">돌아왔어요</button>
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
      body = `
        <section class="panel v02-runner">
          <span class="v02-kicker">지금 할 하나</span>
          <h2 data-v02-current-step>${h(vm.active.title)}</h2>
          <p>완료를 약속하지 않아도 됩니다. 시작 위치만 남깁니다.</p>
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
      body = `
        <section class="panel v02-runner">
          <span class="v02-kicker">큰 목표는 한 줄이면 충분합니다</span>
          <label class="v02-goal-label">목표 한 줄<input id="v02-goal-title" maxlength="140" autocomplete="off" /></label>
          <button id="v02-create-goal">첫 행동 만들기</button>
        </section>
      `;
    }

    rootNode.innerHTML = `${wallet}${body}${storagePanel(status)}<p id="v02-live" aria-live="polite"></p>`;
    wire();
  }

  async function run(button, action) {
    if (button.disabled) return;
    button.disabled = true;
    try {
      const result = await action();
      if (result === false) button.disabled = false;
      else render();
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
        await Core.startCurrentStep(key('start', `${step.id}:${attempt}`));
        reporting = false;
        reportDismissed = false;
      })
    ));
    document.getElementById('v02-open-report')?.addEventListener('click', () => {
      reporting = true;
      reportDismissed = false;
      render();
    });
    document.getElementById('v02-cancel-report')?.addEventListener('click', () => {
      reporting = false;
      reportDismissed = true;
      selectedOutcome = null;
      render();
    });
    document.querySelectorAll('[data-v02-outcome]').forEach((button) => {
      button.addEventListener('click', (event) => {
        selectedOutcome = button.dataset.v02Outcome;
        if (selectedOutcome === 'partial' || selectedOutcome === 'interrupted') {
          const expedition = Core.getSnapshot().expeditions.find((item) => item.status === 'active');
          writeAnchorDraft(expedition.id, { outcome: selectedOutcome });
          render();
          return;
        }
        run(event.currentTarget, async () => {
          const expedition = Core.getSnapshot().expeditions.find((item) => item.status === 'active');
          await Core.reportCurrentExpedition({
            outcome: selectedOutcome,
            idempotencyKey: key('report', expedition.id),
          });
          clearAnchorDraft(expedition.id);
          reporting = false;
          selectedOutcome = null;
          selectedReason = null;
        });
      });
    });
    document.getElementById('v02-save-outcome')?.addEventListener('click', (event) => (
      run(event.currentTarget, async () => {
        const nextField = document.getElementById('v02-next-action');
        const nextPhysicalAction = nextField.value.trim();
        if (!nextPhysicalAction) {
          nextField.focus();
          return false;
        }
        const expedition = Core.getSnapshot().expeditions.find((item) => item.status === 'active');
        await Core.reportCurrentExpedition({
          outcome: selectedOutcome,
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
        selectedOutcome = null;
      })
    ));
    ['v02-last-action', 'v02-next-action', 'v02-location', 'v02-material', 'v02-note']
      .forEach((id) => document.getElementById(id)?.addEventListener('input', () => {
        const expedition = Core.getSnapshot().expeditions.find((item) => item.status === 'active');
        captureAnchorDraft(expedition?.id);
      }));
    document.getElementById('v02-resume-step')?.addEventListener('click', (event) => (
      run(event.currentTarget, async () => {
        const step = Core.getSnapshot().steps.find((item) => item.status === 'interrupted');
        await Core.resumeCurrentStep(step.id, key('resume', step.id));
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
  }

  async function mount(options) {
    App = options.App;
    Core = options.Core;
    await Core.init({ App });
    reporting = Core.getStatus().recoveredExpedition;
    reportDismissed = false;
    const expedition = Core.getSnapshot().expeditions.find((item) => item.status === 'active');
    const draft = readAnchorDraft(expedition?.id);
    selectedOutcome = ['partial', 'interrupted'].includes(draft?.outcome)
      ? draft.outcome
      : null;
    selectedReason = null;
    tiredShrink = false;
    render();
  }

  root.StepQuestV02UI = { mount, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
