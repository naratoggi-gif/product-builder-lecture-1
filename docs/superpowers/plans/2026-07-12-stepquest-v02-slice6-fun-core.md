# StepQuest v0.2 Slice 6 Fun Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete `departure → countdown → harvest → hit → battle report → next desire` loop without changing StepQuest reward amounts or allowing elapsed time to mutate domain state.

**Architecture:** Add a pure `StepQuestV02Fun` projection module for timer, encounters, HP, reports, Codex, dialogue, and desire. Keep immutable timing and report facts in existing domain records, keep moving-media inspection in a focused media module, and let the app facade coordinate persistence while UI owns timers, routes, focus, and playback.

**Tech Stack:** Browser JavaScript IIFEs, IndexedDB v3, localStorage fallback, Web Animations API, HTML video/animated WebP, Node assertion scripts, Playwright, Nest static hosting, service worker cache-first shell.

## Global Constraints

- Allowed expedition durations are exactly `5`, `10`, and `25` minutes; first default is `5`.
- `expiresAt` is computed from injected `command.now`; UI never submits an expiry timestamp.
- Elapsed time never writes events, rewards, wallet rows, HP, Codex rows, or expedition status.
- Duration, report copy, damage, monsters, media, dialogue, and Codex never alter reward amounts or caps.
- Encounter identity uses `rewardLineage`; `expeditionId` varies copy only.
- Encounter HP is derived as `2`, `1`, or `0`; it is never persisted.
- Only `completed` increases Codex count; all other outcomes add zero.
- Standard backups exclude all media Blob bytes; only explicit `full-with-images` export contains them.
- Moving media v1 accepts animated WebP and WebM only; GIF and audio are out of scope.
- Reduced motion never mounts animated media.
- Private reference character media is never added to app shell, service worker, or tracked public assets.
- IndexedDB remains version `3`; PWA build key becomes `v02-core-5` everywhere.
- Do not modify step coin or Gold constants, idempotency keys, lineage caps, camp costs, or obstacle routing semantics.
- A pending battle report is derived from the latest v1 report event whose key differs from `acknowledgedBattleReportKey`; report commit never depends on a second meta write.

**Command working directories:** Run every `node`, `npm`, and `npx playwright` command below from `backend/`. Run every `git` command from the repository root. Before the first focused Playwright command in a clean worktree, run `npm run build` once so `dist/main.js` exists.

---

## File Structure

**Create**

- `backend/public/assets/js/stepquest-v02-fun.js` — pure timer, catalog, encounter, HP, report, Codex, dialogue, and desire projections.
- `backend/public/assets/js/stepquest-v02-media.js` — magic-byte, animated WebP, WebM, duration, dimensions, and media metadata contracts.
- `backend/scripts/stepquest-v02-fun-test.js` — pure Fun Core contracts.
- `backend/scripts/stepquest-v02-media-test.js` — moving-media parser contracts.

**Modify**

- `backend/public/assets/js/stepquest-v02-domain.js` — duration validation, expiry computation, category retention, report projection facts.
- `backend/public/assets/js/stepquest-v02-storage.js` — lossless timing passthrough, significant start snapshots, media-slot transactions and fallback stubs.
- `backend/public/assets/js/stepquest-v02-backup.js` — optional media metadata passthrough while keeping bytes out of standard exports.
- `backend/public/assets/js/stepquest-v02-character.js` — legacy portrait metadata compatibility and v1 media-key normalization.
- `backend/public/assets/js/stepquest-v02-app.js` — duration preference, timer/report facade, media URLs, pending report acknowledgement.
- `backend/public/assets/js/stepquest-v02-fx.js` — expose completion hook/skip result needed by combat sequencing without changing primitives.
- `backend/public/assets/js/stepquest-v02-ui.js` — state machine, navigation, countdown lifecycle, dialogue, combat, report, Codex, desire.
- `backend/public/assets/css/app.css` — encounter, media stage, harvest, report, Codex, dialogue, desire, motion-reduction styling.
- `backend/public/goals.html` — module order and `v02-core-5` URLs.
- `backend/public/sw.js` — `v02-core-5` shell and new module precache.
- `backend/src/main.ts` — narrow `media-src 'self' blob:` CSP.
- `backend/scripts/stepquest-v02-domain-test.js` — timing, projection, HP-entitlement invariants.
- `backend/scripts/stepquest-v02-character-test.js` — metadata compatibility.
- `backend/scripts/stepquest-v02-backup-test.js` — metadata-only export checks.
- `backend/scripts/stepquest-persistence-test.js` — module/cache/CSP/static contract.
- `backend/e2e/stepquest-v02.spec.ts` — primary Fun Core flow and regressions.
- `backend/e2e/stepquest-v02-storage.spec.ts` — IndexedDB media/timing/upgrade persistence.
- `backend/package.json` — include new pure tests in `test:domain`.

---

### Task 1: Pure Fun Core Projection Module

**Files:**
- Create: `backend/public/assets/js/stepquest-v02-fun.js`
- Create: `backend/scripts/stepquest-v02-fun-test.js`
- Modify: `backend/package.json`

**Interfaces:**
- Consumes: plain snapshots, expedition/report records, an injected ISO `now`.
- Produces: `deriveTimer`, `routeForMinutes`, `hash32`, `selectEncounter`, `deriveEncounterHp`, `buildBattleReport`, `buildCodex`, `selectDialogue`, `buildNextDesire`.

- [ ] **Step 1: Write failing timer, encounter, HP, report, Codex, dialogue, and desire tests**

```js
const assert = require('node:assert/strict');
const Fun = require('../public/assets/js/stepquest-v02-fun.js');

assert.deepEqual(
  Fun.deriveTimer({ plannedMinutes: 5, expiresAt: '2026-07-12T00:05:00.000Z' }, '2026-07-12T00:04:00.000Z'),
  { phase: 'running', remainingMs: 60_000, plannedMinutes: 5 },
);
assert.equal(Fun.deriveTimer({ startedAt: '2026-07-11T00:00:00.000Z' }, '2026-07-12T00:00:00.000Z').phase, 'legacy_ready');
assert.equal(Fun.deriveTimer({ plannedMinutes: 5 }, '2026-07-12T00:00:00.000Z').phase, 'legacy_ready');
assert.equal(Fun.deriveTimer({ plannedMinutes: 15, expiresAt: '2026-07-12T00:05:00.000Z' }, '2026-07-12T00:00:00.000Z').phase, 'legacy_ready');
assert.equal(Fun.deriveTimer({ plannedMinutes: '5', expiresAt: '2026-07-12T00:05:00.000Z' }, '2026-07-12T00:00:00.000Z').phase, 'legacy_ready');
assert.throws(() => Fun.deriveTimer({ plannedMinutes: 5, expiresAt: '2026-07-12T00:05:00.000Z' }, 'not-a-clock'), /CLOCK_TIME_INVALID/);
assert.equal(Fun.hash32('hello'), 0x4f9f2cab);
assert.equal(Fun.routeForMinutes(5).key, 'camp_edge');
assert.equal(Fun.routeForMinutes(10).key, 'old_forest');
assert.equal(Fun.routeForMinutes(25).key, 'deep_ruins');

const encounter = Fun.selectEncounter({ rewardLineage: 'lineage-1', category: 'writing', boss: false });
assert.deepEqual(encounter, Fun.selectEncounter({ rewardLineage: 'lineage-1', category: 'writing', boss: false }));
assert.equal(Fun.deriveEncounterHp({ status: 'active', rewardLineage: 'lineage-1' }, []), 2);
assert.equal(Fun.deriveEncounterHp({ status: 'active', rewardLineage: 'lineage-1' }, [{ currency: 'stepCoin', stage: 'progress', rewardLineage: 'lineage-1' }]), 1);
assert.equal(Fun.deriveEncounterHp({ status: 'completed', rewardLineage: 'lineage-1' }, []), 0);

const reportEvent = {
  idempotencyKey: 'report-1', expeditionId: 'expedition-1', outcome: 'completed',
  result: { rewardLineage: 'lineage-1', category: 'writing', reportVersion: 1, goalMilestone: false, goldGranted: 1 },
};
const report = Fun.buildBattleReport({ event: reportEvent, expedition: { plannedMinutes: 10 } });
assert.equal(report.goldGranted, 1);
assert.equal(report.defeatCount, 1);
assert.deepEqual(report, Fun.buildBattleReport({ event: reportEvent, expedition: { plannedMinutes: 10 } }));
assert.equal(Fun.buildCodex([reportEvent]).entries.find((entry) => entry.id === report.monsterId).count, 1);
assert.equal(Fun.buildCodex([reportEvent, reportEvent]).entries.find((entry) => entry.id === report.monsterId).count, 1);

const firstDialogue = Fun.selectDialogue({ context: 'ready', entityId: 'expedition-1', localDate: '2026-07-12', subject: '잉크 슬라임' });
assert.equal(firstDialogue, Fun.selectDialogue({ context: 'ready', entityId: 'expedition-1', localDate: '2026-07-12', subject: '잉크 슬라임' }));
assert.notEqual(firstDialogue, Fun.selectDialogue({ context: 'ready', entityId: 'expedition-1', localDate: '2026-07-12', subject: '잉크 슬라임', previousText: firstDialogue }));
assert.match(Fun.buildNextDesire({ camp: { level: 1 }, wallet: { gold: 3 }, activeStep: null, encounter: null, codex: { entries: [] } }).text, /지금 확장/);
assert.match(Fun.buildNextDesire({
  camp: { level: 1 }, wallet: { gold: 0 }, activeStep: { title: '첫 문장 쓰기' }, encounter,
  codex: { entries: [{ id: encounter.id, discovered: false }] },
}).text, /첫 문장 쓰기.*\?\?\?/);
```

- [ ] **Step 2: Run the pure test and verify RED**

Run: `node scripts/stepquest-v02-fun-test.js`

Expected: FAIL with `Cannot find module '../public/assets/js/stepquest-v02-fun.js'`.

- [ ] **Step 3: Implement the pure module with fixed catalogs and no side effects**

```js
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
      const cost = 2 + camp.level;
      const shortfall = Math.max(0, cost - wallet.gold);
      if (shortfall === 0) return { kind: 'camp', text: '캠프를 지금 확장할 수 있어요.' };
    }
    const current = encounter && codex.entries.find((entry) => entry.id === encounter.id);
    if (current && !current.discovered && activeStep) {
      return { kind: 'codex', text: `“${activeStep.title}” 완료 → ??? 발견` };
    }
    if (camp.level < 5) {
      const shortfall = Math.max(0, 2 + camp.level - wallet.gold);
      return { kind: 'camp', text: `다음 캠프까지 골드 ${shortfall}.` };
    }
    if (activeStep) return { kind: 'milestone', text: `다음 이정표: ${activeStep.nextPhysicalAction || activeStep.title}` };
    return { kind: 'terminal', text: '새 목표가 다음 조우를 엽니다.' };
  }

  return { REPORT_VERSION, ROUTES, CATALOG, deriveTimer, routeForMinutes, hash32, selectEncounter, deriveEncounterHp, buildBattleReport, buildCodex, selectDialogue, buildNextDesire };
});
```

`hash32` must be FNV-1a 32-bit using `Math.imul`; `buildCodex` must dedupe by `${event.idempotencyKey}:${event.expeditionId}` and ignore non-v1/non-completed events. `buildBattleReport` must read `event.result.goldGranted` verbatim.

- [ ] **Step 4: Run pure tests and the domain suite**

Run, one command at a time:

```bash
node scripts/stepquest-v02-fun-test.js
npm run test:domain
```

Expected: both exit 0 and print `checked: stepquest-v02-fun` plus the existing domain checks.

- [ ] **Step 5: Commit**

```bash
git add backend/public/assets/js/stepquest-v02-fun.js backend/scripts/stepquest-v02-fun-test.js backend/package.json
git commit -m "Add Slice 6 Fun Core projections"
```

---

### Task 2: Domain Timing and Immutable Report Facts

**Files:**
- Modify: `backend/public/assets/js/stepquest-v02-domain.js`
- Modify: `backend/scripts/stepquest-v02-domain-test.js`

**Interfaces:**
- Consumes: `startStep(..., { plannedMinutes })` and existing `reportOutcome` commands.
- Produces: timed expedition records, exported `isGoalMilestone(step, steps)`, and v1 facts in `expedition_reported.result`.

- [ ] **Step 1: Add failing tests for allowed durations, computed expiry, category retention, and unchanged economics**

```js
const Fun = require('../public/assets/js/stepquest-v02-fun.js');

function testTimedExpeditionAndProjectionFacts() {
  const state = makeState(['start']);
  state.goals[0].category = 'writing';
  state.steps[0].category = 'writing';
  const before = JSON.stringify(state);
  let transition = Domain.startStep(state, {
    stepId: activeStep(state).id,
    plannedMinutes: 10,
    idempotencyKey: 'timed-start',
    now: '2026-07-12T00:00:00.000Z',
    idFactory,
  });
  const expedition = activeExpedition(transition.state);
  assert.equal(expedition.plannedMinutes, 10);
  assert.equal(expedition.expiresAt, '2026-07-12T00:10:00.000Z');

  const timedState = transition.state;
  const unchanged = JSON.stringify(timedState);
  assert.equal(Fun.deriveTimer(expedition, '2026-08-11T00:00:00.000Z').phase, 'ready');
  assert.equal(JSON.stringify(timedState), unchanged, 'clock projection cannot mutate domain state');

  transition = Domain.reportOutcome(timedState, {
    expeditionId: expedition.id,
    outcome: 'completed',
    idempotencyKey: 'timed-report',
    now: '2026-07-12T00:01:00.000Z',
    idFactory,
  });
  const report = transition.state.events.find((event) => event.idempotencyKey === 'timed-report');
  assert.deepEqual(
    {
      rewardLineage: report.result.rewardLineage,
      category: report.result.category,
      reportVersion: report.result.reportVersion,
      goalMilestone: report.result.goalMilestone,
      goldGranted: report.result.goldGranted,
    },
    { rewardLineage: 'step-1', category: 'writing', reportVersion: 1, goalMilestone: true, goldGranted: 2 },
  );
  assert.equal(JSON.stringify(state), before, 'domain commands never mutate their input');
  assert.notStrictEqual(transition.state, state, 'domain commands return a cloned transition');
}

assert.throws(() => Domain.startStep(makeState(['start']), {
  stepId: 'step-1', plannedMinutes: 15, idempotencyKey: 'bad-duration', now: NOW, idFactory,
}), /EXPEDITION_DURATION_INVALID/);
```

Mechanically add `plannedMinutes: 5` to every pre-existing valid `startStep` test command. Missing, string, `0`, `15`, and `NaN` duration commands must all assert `EXPEDITION_DURATION_INVALID`; this keeps the domain contract strict while the UI owns the first-use default. Add tests for exported `Domain.isGoalMilestone(step, steps)` with final and non-final steps. Add a `manual_shrink` regression that asserts the replacement copies `category` as well as phase, entry segment, and reward lineage, then assert `selectEncounter` returns the same monster before and after replacement.

- [ ] **Step 2: Verify RED**

Run: `node scripts/stepquest-v02-domain-test.js`

Expected: FAIL because `plannedMinutes`, `expiresAt`, or report projection fields are absent.

- [ ] **Step 3: Implement validation and additive facts without touching reward branches**

```js
const EXPEDITION_MINUTES = new Set([5, 10, 25]);

function expeditionExpiry(now, plannedMinutes) {
  if (!EXPEDITION_MINUTES.has(plannedMinutes)) throw domainError('EXPEDITION_DURATION_INVALID');
  const startedAt = new Date(now);
  if (Number.isNaN(startedAt.getTime())) throw domainError('COMMAND_TIME_INVALID');
  return new Date(startedAt.getTime() + plannedMinutes * 60_000).toISOString();
}
```

Persist `category: made.weekly.category || 'generic'` on Goal and `category: item.category || goal.category` on Step. Copy `category: step.category` when `manual_shrink` creates a replacement. In `startStep`, set `plannedMinutes` and `expiresAt: expeditionExpiry(command.now, command.plannedMinutes)`. Add and export the side-effect-free `isGoalMilestone(step, steps)` helper. In `reportOutcome`, call it before statuses change and add the five projection fields to `event.result`; leave every reward constant and idempotency key unchanged. The facade calls the same exported domain helper before report commit, so the encounter cannot switch between regular and boss.

- [ ] **Step 4: Run domain and lineage regression tests**

Run, one command at a time:

```bash
node scripts/stepquest-v02-domain-test.js
node scripts/stepquest-v02-fun-test.js
```

Expected: exit 0, including shrink/retry/gold-cap cases.

- [ ] **Step 5: Commit**

```bash
git add backend/public/assets/js/stepquest-v02-domain.js backend/scripts/stepquest-v02-domain-test.js
git commit -m "Persist Slice 6 expedition timing"
```

---

### Task 3: Timing Persistence and Significant Start Backups

**Files:**
- Modify: `backend/public/assets/js/stepquest-v02-storage.js`
- Modify: `backend/public/assets/js/stepquest-v02-backup.js`
- Modify: `backend/scripts/stepquest-v02-backup-test.js`
- Modify: `backend/e2e/stepquest-v02-storage.spec.ts`

**Interfaces:**
- Consumes: optional timing/category/projection fields and `startStep` operations.
- Produces: lossless IndexedDB/localStorage/export round trips and rolling start snapshots; storage never repairs or rejects legacy/mixed timing pairs.

- [ ] **Step 1: Write failing persistence tests**

Create a v2-compatible active expedition without timing and assert it survives as legacy. Start a new 25-minute expedition and assert IndexedDB, localStorage fallback, rolling snapshot, and standard export retain both timing fields. Assert start creates one significant backup but elapsed time creates none.

```js
assert.equal(records.expeditions[0].plannedMinutes, 25);
assert.equal(records.expeditions[0].expiresAt, '2026-07-12T00:25:00.000Z');
assert.equal(exported.expeditions[0].plannedMinutes, 25);
assert.equal(exported.assets, undefined);
```

- [ ] **Step 2: Verify RED**

Run, one command at a time:

```bash
node scripts/stepquest-v02-backup-test.js
npx playwright test e2e/stepquest-v02-storage.spec.ts --project=desktop-chrome
```

Expected: timing or significant-start assertions fail.

- [ ] **Step 3: Preserve optional fields and make starts significant**

Leave the base expedition validator intentionally additive so an absent, mixed, or invalid timing pair is never dropped during recovery. `Fun.deriveTimer` is the single pair validator and maps anything except an allowed duration plus parseable expiry to `legacy_ready`. Add only the operation needed for disaster recovery:

```js
const SIGNIFICANT_OPERATIONS = new Set([
  'startStep',
  'reportOutcome',
  'routeObstacle',
  'importGoal',
  'upgradeCamp',
]);
```

Assert the `startStep` backup contains the committed expedition with both timing fields, while the legacy and mixed fixtures survive byte-for-byte. Do not write migration metadata merely because a record is legacy.

- [ ] **Step 4: Run storage and backup suites**

Run, one command at a time:

```bash
node scripts/stepquest-v02-backup-test.js
npx playwright test e2e/stepquest-v02-storage.spec.ts --project=desktop-chrome
```

Expected: all pass; DB version remains 3.

- [ ] **Step 5: Commit**

```bash
git add backend/public/assets/js/stepquest-v02-storage.js backend/public/assets/js/stepquest-v02-backup.js backend/scripts/stepquest-v02-backup-test.js backend/e2e/stepquest-v02-storage.spec.ts
git commit -m "Preserve timed expeditions in backups"
```

---

### Task 4: Moving Media Inspection Contracts

**Files:**
- Create: `backend/public/assets/js/stepquest-v02-media.js`
- Create: `backend/scripts/stepquest-v02-media-test.js`
- Modify: `backend/package.json`

**Interfaces:**
- Consumes: animated WebP or WebM File/Blob plus injected decode helpers.
- Produces: `inspectMovingMedia`, `parseAnimatedWebPDuration`, `validateMovingMetadata`, and stable error codes.

- [ ] **Step 1: Write failing parser tests with in-memory RIFF fixtures**

```js
const Media = require('../public/assets/js/stepquest-v02-media.js');
function riffChunk(type, payload) {
  const header = Buffer.alloc(8);
  header.write(type, 0, 4, 'ascii');
  header.writeUInt32LE(payload.length, 4);
  return Buffer.concat([header, payload, payload.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
}
function makeAnimatedWebP(durations) {
  const vp8x = Buffer.alloc(10);
  vp8x[0] = 0x02;
  const anim = Buffer.alloc(6);
  const frames = durations.map((duration) => {
    const payload = Buffer.alloc(16);
    payload[6] = 7; payload[9] = 7;
    payload[12] = duration & 0xff;
    payload[13] = (duration >>> 8) & 0xff;
    payload[14] = (duration >>> 16) & 0xff;
    return riffChunk('ANMF', payload);
  });
  const body = Buffer.concat([Buffer.from('WEBP'), riffChunk('VP8X', vp8x), riffChunk('ANIM', anim), ...frames]);
  const header = Buffer.alloc(8);
  header.write('RIFF', 0, 4, 'ascii');
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}
assert.equal(Media.parseAnimatedWebPDuration(makeAnimatedWebP([600, 700, 800])), 2100);
assert.throws(() => Media.validateMovingMetadata({ mimeType: 'image/webp', size: 6 * 1024 * 1024 + 1, width: 512, height: 512, durationMs: 1000 }), /CHARACTER_MEDIA_TOO_LARGE/);
assert.throws(() => Media.validateMovingMetadata({ mimeType: 'video/webm', size: 100, width: 512, height: 512, durationMs: 3001 }), /CHARACTER_MEDIA_TOO_LONG/);
assert.throws(() => Media.validateMovingMetadata({ mimeType: 'image/gif', size: 100, width: 512, height: 512, durationMs: 1000 }), /CHARACTER_MEDIA_TYPE_UNSUPPORTED/);
```

- [ ] **Step 2: Verify RED**

Run: `node scripts/stepquest-v02-media-test.js`

Expected: module-not-found failure.

- [ ] **Step 3: Implement strict constants and parser**

```js
const MOVING_TYPES = Object.freeze(['image/webp', 'video/webm']);
const MAX_CLIP_BYTES = 6 * 1024 * 1024;
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;
const MAX_EDGE = 1024;
const MAX_DURATION_MS = 3000;
```

Parse WebP `RIFF`/`WEBP` and `ANMF` chunks with bounds checks and the 24-bit frame duration field. For WebM, use an injected muted video element to obtain `duration`, `videoWidth`, and `videoHeight`; always revoke the temporary URL. Reject MIME/magic mismatches.

- [ ] **Step 4: Run media tests**

Run: `node scripts/stepquest-v02-media-test.js`

Expected: exit 0 and `checked: stepquest-v02-media`.

- [ ] **Step 5: Commit**

```bash
git add backend/public/assets/js/stepquest-v02-media.js backend/scripts/stepquest-v02-media-test.js backend/package.json
git commit -m "Validate Slice 6 moving media"
```

---

### Task 5: Atomic Character Media Slots

**Files:**
- Modify: `backend/public/assets/js/stepquest-v02-character.js`
- Modify: `backend/public/assets/js/stepquest-v02-storage.js`
- Modify: `backend/public/assets/js/stepquest-v02-backup.js`
- Modify: `backend/scripts/stepquest-v02-character-test.js`
- Modify: `backend/scripts/stepquest-v02-backup-test.js`
- Modify: `backend/e2e/stepquest-v02-storage.spec.ts`

**Interfaces:**
- Consumes: normalized portrait metadata or inspected `idle`/`skill` Blob.
- Produces: `media: { portraitKey, idleKey?, skillKey? }`, `saveCharacterMediaSlot`, `getCharacterMedia`, and full-export assets.

- [ ] **Step 1: Add failing compatibility and atomicity tests**

Assert old `imageBlobKey` reads as `media.portraitKey`; no moving slot may save without a portrait; invalid replacement preserves old Blob; valid replacement removes only the old same-slot Blob; ordinary export has metadata but no bytes; full export includes all selected assets.

```js
assert.deepEqual(Character.normalizeMediaKeys({ imageBlobKey: Character.IMAGE_BLOB_KEY }), {
  portraitKey: Character.IMAGE_BLOB_KEY,
});
const inspected = {
  key: 'character:local-primary:idle',
  mimeType: 'image/webp',
  byteLength: 1024,
  width: 512,
  height: 512,
  durationMs: 1200,
};
assert.throws(() => Character.withMediaSlot({ id: 'local-primary' }, 'idle', inspected), /CHARACTER_PORTRAIT_REQUIRED/);
```

- [ ] **Step 2: Verify RED**

Run, one command at a time:

```bash
node scripts/stepquest-v02-character-test.js
node scripts/stepquest-v02-backup-test.js
```

Expected: missing media-key helpers and slot-storage assertions fail.

- [ ] **Step 3: Implement fixed asset keys and one transaction per replacement**

```js
const MEDIA_KEYS = Object.freeze({
  portrait: 'character:local-primary:portrait',
  idle: 'character:local-primary:idle',
  skill: 'character:local-primary:skill',
});
```

Compatibility may continue reading `character:local-primary:image` as portrait. Store media MIME, byte length, dimensions, and duration in character metadata. Use the current Blob-first/ArrayBuffer-fallback mechanism. Include `characters`, `assets`, and `backups` in one readwrite transaction; do not delete the prior key until the new record and metadata writes are scheduled.

- [ ] **Step 4: Run character, backup, and storage tests**

Run, one command at a time:

```bash
node scripts/stepquest-v02-character-test.js
node scripts/stepquest-v02-backup-test.js
npx playwright test e2e/stepquest-v02-storage.spec.ts --project=desktop-chrome
```

Expected: all pass, standard JSON contains no base64 or Blob.

- [ ] **Step 5: Commit**

```bash
git add backend/public/assets/js/stepquest-v02-character.js backend/public/assets/js/stepquest-v02-storage.js backend/public/assets/js/stepquest-v02-backup.js backend/scripts/stepquest-v02-character-test.js backend/scripts/stepquest-v02-backup-test.js backend/e2e/stepquest-v02-storage.spec.ts
git commit -m "Persist local character media slots"
```

---

### Task 6: App Facade Orchestration

**Files:**
- Modify: `backend/public/assets/js/stepquest-v02-app.js`
- Modify: `backend/e2e/stepquest-v02.spec.ts`

**Interfaces:**
- Consumes: selected minutes, report transition, character slot imports.
- Produces: `refreshSnapshot()`, `getLastExpeditionMinutes()`, `getTimerView(now)`, `getEncounterView()`, `getPendingBattleReport()`, `acknowledgeBattleReport(key)`, `beginForegroundSession(localDate)`, `chooseDialogue(input)`, `importCharacterMedia(slot, file)`, and media object URLs.

- [ ] **Step 1: Add failing facade E2E assertions**

Use `page.evaluate` to call the facade. Assert first duration is 5, a successful 10-minute start stores meta 10, failed/invalid start does not update preference, `refreshSnapshot()` observes a second-tab commit, and all media URLs are revoked on force refresh. Commit a report, close immediately without any pending-meta write, reload, and assert the latest v1 event still yields the same pending report. A matching acknowledgement must clear it; a mismatched key must not.

For dialogue/session meta, assert the same semantic trigger key returns the same line across reloads, a new entity in the same context avoids the previous line, first-open is true only once per local date, and `longAbsence` becomes true only when the prior foreground timestamp is at least 48 hours earlier.

- [ ] **Step 2: Verify RED**

Run: `npx playwright test e2e/stepquest-v02.spec.ts --project=desktop-chrome --grep "Slice 6 facade"`

Expected: missing facade methods.

- [ ] **Step 3: Implement facade methods and remove old recovered-expedition boolean semantics**

```js
async function startCurrentStep(idempotencyKey, plannedMinutes = 5) {
  const activeStep = snapshot.steps.find((item) => item.status === 'active');
  if (!activeStep) throw new Error('ACTIVE_STEP_NOT_FOUND');
  const transition = await repository.execute('startStep', {
    stepId: activeStep.id,
    plannedMinutes,
    idempotencyKey,
    now: now(),
    idFactory: makeId,
  });
  snapshot = transition.state;
  await repository.setMeta('lastExpeditionMinutes', plannedMinutes);
  await afterSignificantCommit();
  return transition.result;
}
```

`getLastExpeditionMinutes()` returns an allowed stored value or `5`. `refreshSnapshot()` reloads the repository snapshot before recomputing media URLs. `getEncounterView()` finds the active expedition step and calls `Fun.selectEncounter` with its stable lineage/category plus `Domain.isGoalMilestone(step, snapshot.steps)`. `getPendingBattleReport()` sorts v1 `expedition_reported` events by `createdAt`, then idempotency key, selects the latest, and returns it only when its key differs from `acknowledgedBattleReportKey`. Build the report from that committed event and its expedition. `acknowledgeBattleReport(key)` first verifies that key is still pending, then writes it as `acknowledgedBattleReportKey`; a failed write safely causes the report to reappear.

`beginForegroundSession(localDate)` compares injected `now()` with `lastForegroundAt`, returns `{ firstLocalDate, longAbsence }`, then updates the two foreground meta values without creating a domain event. Store dialogue cursor entries as `{ triggerKey, text }` per context. `chooseDialogue` returns the stored text for the same trigger key; only a new trigger calls `Fun.selectDialogue` with the prior text and replaces the cursor. Maintain independent portrait/idle/skill Object URLs and revoke all on refresh or replacement.

- [ ] **Step 4: Run focused facade tests and domain suite**

Run, one command at a time:

```bash
npx playwright test e2e/stepquest-v02.spec.ts --project=desktop-chrome --grep "Slice 6 facade"
npm run test:domain
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/public/assets/js/stepquest-v02-app.js backend/e2e/stepquest-v02.spec.ts
git commit -m "Coordinate Slice 6 timer and reports"
```

---

### Task 7: Expedition UI State Machine and Countdown

**Files:**
- Modify: `backend/public/assets/js/stepquest-v02-ui.js`
- Modify: `backend/e2e/stepquest-v02.spec.ts`

**Interfaces:**
- Consumes: `Core.getTimerView(now)`, `Core.getLastExpeditionMinutes()`, `Core.getEncounterView()`, `Core.refreshSnapshot()`, pending report, route metadata.
- Produces: duration chooser, running panel, ready panel, legacy-ready panel, outcome form, stable draft/focus behavior.

- [ ] **Step 1: Add failing Playwright state-machine tests**

Test first default 5, duration teaser, countdown, clock advance, unexpired reload, expired reload, legacy active expedition, early return label, cancel destination, and an outcome draft that survives expiry. Capture events/rewards/wallet before and after clock advance and assert deep equality.

```ts
await page.clock.install({ time: new Date('2026-07-12T00:00:00.000Z') });
await page.locator('[name="v02-expedition-minutes"][value="5"]').check();
await page.locator('#v02-start-step').click();
await expect(page.locator('[data-v02-countdown]')).toHaveText('05:00');
await page.clock.fastForward(5 * 60 * 1000);
await expect(page.locator('#v02-expedition-ready')).toBeVisible();
```

- [ ] **Step 2: Verify RED**

Run: `npx playwright test e2e/stepquest-v02.spec.ts --project=desktop-chrome --grep "expedition timer|harvest state"`

Expected: selectors/screens absent.

- [ ] **Step 3: Implement one timer controller with absolute recomputation**

Maintain one interval handle and a session-only `readyLatch`. Update only countdown text each second. Full render occurs once on `running → ready`. Recompute on `visibilitychange`, `pageshow`, and focus; refresh snapshot before rendering after another-tab changes. Never invoke a Core mutation from a timer callback.

- [ ] **Step 4: Run timer tests across desktop and mobile Safari**

Run: `npx playwright test e2e/stepquest-v02.spec.ts --project=desktop-chrome --project=mobile-safari --grep "expedition timer|harvest state"`

Expected: all pass, no flaky timeout.

- [ ] **Step 5: Commit**

```bash
git add backend/public/assets/js/stepquest-v02-ui.js backend/e2e/stepquest-v02.spec.ts
git commit -m "Add Slice 6 harvest state machine"
```

---

### Task 8: Moving Character and Combat Sequence

**Files:**
- Create: `backend/e2e/fixtures/slice6-spark-loop.webp`
- Modify: `backend/public/assets/js/stepquest-v02-ui.js`
- Modify: `backend/public/assets/js/stepquest-v02-fx.js`
- Modify: `backend/e2e/stepquest-v02.spec.ts`

**Interfaces:**
- Consumes: character media URLs, pre/post encounter HP, outcome transition.
- Produces: idle loop, skill one-shot, FX overlay, hit reaction, truthful damage, defeat, skip-to-final-state.

- [ ] **Step 1: Add failing media/combat E2E tests**

Create `slice6-spark-loop.webp` as an original procedural 8×8 two-frame amber spark (no character likeness); it is test-only, not loaded by `goals.html`, and not precached. Use it for both moving slots in the cross-browser combat tests. In desktop Chrome, separately prove WebM import with a short muted clip produced from an 8×8 canvas by `MediaRecorder`:

```ts
async function makeWebmFixture(page: Page) {
  return page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 8; canvas.height = 8;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#f5b400'; context.fillRect(0, 0, 8, 8);
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.start();
    await new Promise((resolve) => setTimeout(resolve, 200));
    const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    return Array.from(new Uint8Array(await new Blob(chunks, { type: recorder.mimeType }).arrayBuffer()));
  });
}
```

Import a normal portrait first, then idle and skill media. Assert idle loops in ordinary mode, skill starts from time 0, FX overlays it, damage equals pre/post HP, partial first damages 1, repeated partial damages 0, completed reaches 0, not-started creates no skill/hit/damage, and skip lands at the report with final HP. For reduced motion, assert no animated `<img>` or `<video>` is mounted.

Use a seeded fixture whose active step has `phase: 'start'` for the first-partial case; an entry-phase step truthfully earns no progress entitlement and therefore must remain a zero-damage case. Test aggregate media bounds with two exact 6 MiB moving-slot metadata records and assert the accepted total is exactly 12 MiB; any byte above a per-clip limit remains rejected before storage.

- [ ] **Step 2: Verify RED**

Run: `npx playwright test e2e/stepquest-v02.spec.ts --project=desktop-chrome --grep "moving character|combat sequence"`

Expected: moving-slot controls and combat selectors absent.

- [ ] **Step 3: Implement playback sequencing**

Use `<img>` for animated WebP and muted `<video playsinline>` for WebM. Add `progress` to the FX modes with a fixed 720ms plan that reuses the selected preset without a milestone cut-in. On completion, snapshot pre-HP, commit report, derive post-HP, then start the clip and FX in the same turn:

```js
const playback = createCombatPlaybackSession();
await Promise.allSettled([
  playSkillMedia({ signal: playback.signal }),
  playCharacterFx({
    mode: result.outcome === 'partial' ? 'progress' : result.goalMilestone ? 'milestone' : 'completed',
    signal: playback.signal,
  }),
]);
if (!playback.signal.aborted) {
  await playMonsterHit({ damage: beforeHp - afterHp, defeated: afterHp === 0 });
}
showPendingBattleReport();
```

The shared skip control calls `playback.abort()`, pauses and rewinds media, calls `FX.cancel()`, cancels hit animations, applies final HP/defeat DOM state, then opens the report. Partial uses the concurrent sequence only when the HP delta is 1; zero-delta partial shows a non-punitive guard reaction without clip, FX, or damage number.

- [ ] **Step 4: Run focused tests with repeat protection**

Run: `npx playwright test e2e/stepquest-v02.spec.ts --project=mobile-safari --grep "moving character|combat sequence" --repeat-each=5 --workers=1`

Expected: 5/5 pass.

- [ ] **Step 5: Commit**

```bash
git add backend/e2e/fixtures/slice6-spark-loop.webp backend/public/assets/js/stepquest-v02-ui.js backend/public/assets/js/stepquest-v02-fx.js backend/e2e/stepquest-v02.spec.ts
git commit -m "Play Slice 6 character combat"
```

---

### Task 9: Battle Report, Codex, Dialogue, and Desire

**Files:**
- Modify: `backend/public/assets/js/stepquest-v02-ui.js`
- Modify: `backend/e2e/stepquest-v02.spec.ts`

**Interfaces:**
- Consumes: Fun report/Codex/dialogue/desire projections, derived pending report, and acknowledgement/dialogue meta.
- Produces: persistent report screen, `#today/#codex`, stable contextual bubble, exactly one exit hook.

- [ ] **Step 1: Add failing UI tests**

Assert a committed report survives reload until Continue; displayed Gold equals event `goldGranted` for 2, 1, and 0; Continue routes each outcome correctly; Codex counts only completed once; unknown names do not appear anywhere in DOM; and hash navigation/back/forward works. Exercise the dialogue priority `pending report → ready → early return → departure → blocked/waiting/deferred → 48-hour return → first local-day → idle`; assert real step/monster/anchor context, stability across countdown ticks and reloads, and absence of blame/late/streak language. Assert exactly one desire element across camp-affordable, current unknown encounter, Gold shortfall, milestone, and empty states.

- [ ] **Step 2: Verify RED**

Run: `npx playwright test e2e/stepquest-v02.spec.ts --project=desktop-chrome --grep "battle report|Codex|dialogue|next desire"`

Expected: new screens/selectors absent.

- [ ] **Step 3: Render projections without duplicating business rules**

Use `Fun.buildBattleReport`, `Fun.buildCodex`, `Core.chooseDialogue`, and `Fun.buildNextDesire` directly. The UI must not infer nominal Gold from outcome. Use a trigger key made from context, relevant entity id, and local date; timer ticks and navigation do not call `chooseDialogue`. On `[계속]`, acknowledge the matching report first, then render current snapshot routing.

- [ ] **Step 4: Run focused and existing obstacle/anchor regressions**

Run: `npx playwright test e2e/stepquest-v02.spec.ts --project=desktop-chrome --grep "battle report|Codex|dialogue|next desire|obstacle|Resume Anchor"`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/public/assets/js/stepquest-v02-ui.js backend/e2e/stepquest-v02.spec.ts
git commit -m "Add Slice 6 reports and Codex"
```

---

### Task 10: Visual System, Accessibility, CSP, and PWA Shell

**Files:**
- Modify: `backend/public/assets/css/app.css`
- Modify: `backend/public/goals.html`
- Modify: `backend/public/sw.js`
- Modify: `backend/src/main.ts`
- Modify: `backend/scripts/stepquest-persistence-test.js`
- Modify: `backend/e2e/stepquest-v02.spec.ts`

**Interfaces:**
- Consumes: all new DOM hooks and modules.
- Produces: polished responsive Fun Core UI, reduced-motion safety, `v02-core-5` upgrade.

- [ ] **Step 1: Add failing static contracts**

```js
const v02Modules = ['domain', 'storage', 'backup', 'character', 'media', 'fun', 'fx', 'app', 'ui'];
for (const name of v02Modules) {
  const url = `/assets/js/stepquest-v02-${name}.js?v=0.1.1-alpha&build=v02-core-5`;
  assert.ok(goalsHtml.includes(url));
  assert.ok(serviceWorker.includes(`'${url}'`));
}
const cssUrl = '/assets/css/app.css?v=0.1.1-alpha&build=v02-core-5';
assert.ok(goalsHtml.includes(cssUrl));
assert.ok(serviceWorker.includes(`'${cssUrl}'`));
assert.ok(serviceWorker.includes("const CACHE_BUILD = 'v02-core-5'"));
assert.ok(mainSource.includes("mediaSrc: [\"'self'\", 'blob:']"));
```

Also assert CSS contains encounter HP, harvest, report, Codex, speech bubble, desire, moving media, and reduced-motion selectors.

Add a runtime browser assertion so the built server, not only the TypeScript source, proves the directive:

```ts
const response = await page.request.get('/goals.html');
expect(response.headers()['content-security-policy']).toContain("media-src 'self' blob:");
```

- [ ] **Step 2: Verify RED**

Run: `node scripts/stepquest-persistence-test.js`

Expected: core-5/new-module/CSP assertions fail.

- [ ] **Step 3: Implement shell order and responsive styles**

Load order: domain → storage → backup → character → media → fun → fx → legacy app → v0.2 app → v0.2 UI. Use one exact CSS core-5 URL in HTML and SW. Style 44px controls, 2-segment HP, high-contrast report hierarchy, unknown Codex cards, and a single desire line. Under either reduced-motion mechanism, hide animated media and suppress shake/fall/number motion while retaining instant text and HP state.

- [ ] **Step 4: Run static, build, and accessibility-focused browser tests**

Run, one command at a time:

```bash
node scripts/stepquest-persistence-test.js
npm run build
npx playwright test e2e/stepquest-v02.spec.ts --project=mobile-safari --grep "reduced motion|accessibility|Codex"
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/public/assets/css/app.css backend/public/goals.html backend/public/sw.js backend/src/main.ts backend/scripts/stepquest-persistence-test.js backend/e2e/stepquest-v02.spec.ts
git commit -m "Ship the Slice 6 Fun Core shell"
```

---

### Task 11: Full Flow, Migration, and Completion Audit

**Files:**
- Modify: `backend/e2e/stepquest-v02.spec.ts`
- Modify: `backend/e2e/stepquest-v02-storage.spec.ts`
- Modify: `docs/2026-07-12-stepquest-v02-slice6-fun-core.md`

**Interfaces:**
- Consumes: the complete Slice 6 implementation.
- Produces: requirement-level evidence and a checked design completion status.

- [ ] **Step 1: Add the end-to-end owner journey test**

The test must create a Goal, choose 5 minutes, start, observe moving idle/countdown, advance clock, reload into harvest, choose completed, observe skill/hit/damage, verify exact Gold, Continue, verify Codex +1 and exactly one next desire, then reload and confirm state remains. A second fixture must load a v2/v3 record with no timing and old portrait metadata and verify `legacy_ready` plus portrait preservation.

- [ ] **Step 2: Run the journey test across all projects and repeat Safari**

Run:

```bash
npx playwright test e2e/stepquest-v02.spec.ts --grep "Slice 6 owner journey"
npx playwright test e2e/stepquest-v02.spec.ts --project=mobile-safari --grep "Slice 6 owner journey" --repeat-each=5 --workers=1
```

Expected: desktop Chrome, mobile Chrome, mobile Safari pass; Safari repeat 5/5.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm run test:domain
npm run test:e2e
npm run test:ci
```

Then, from the repository root:

```bash
git diff --check
```

Expected: every command exits 0; no test failures; only explicitly environment-dependent skips remain.

- [ ] **Step 4: Perform requirement audit and update design status**

For every section 3–17 in the design, link the proving test or static assertion in a completion checklist appended to the document. Change `상태: 설계 승인 · 구현 계획 완료` to `상태: 구현 완료 · 사람 검증 대기` only after all automated evidence exists. Keep Fun Core open until the three-day human gate passes.

- [ ] **Step 5: Commit**

```bash
git add backend/e2e/stepquest-v02.spec.ts backend/e2e/stepquest-v02-storage.spec.ts docs/2026-07-12-stepquest-v02-slice6-fun-core.md
git commit -m "Complete StepQuest v0.2 Slice 6"
```

---

## Plan Self-Review Checklist

| Design section | Implemented and proved by |
|---|---|
| §3 completed flow | Tasks 7–9 and owner journey in Task 11 |
| §4 timer | Tasks 1–3, 6–7 |
| §5 return/harvest state machine | Tasks 6–9 |
| §6 encounter and HP | Tasks 1–2, 6, 8 |
| §7 report projection | Tasks 1–2, 6, 9 |
| §8 Codex | Tasks 1 and 9 |
| §9 moving media | Tasks 4–6, 8, 10 |
| §10 combat sequence | Task 8 |
| §11 dialogue | Tasks 1, 6, 9 |
| §12 next desire | Tasks 1 and 9 |
| §13 accessibility/errors | Tasks 4, 7–10 |
| §14 storage/PWA | Tasks 3, 5–6, 10 |
| §15 boundaries | Enforced by producer/consumer interfaces in Tasks 1–10 |
| §16 automated/manual validation | Task 11 plus each task's focused tests |
| §17 completion criteria | Task 11 audit and deferred three-day human gate |

- Every design section 3–17 maps to at least one task above.
- Every new public function has a named producer task and consumer task.
- Reward amount code is never an implementation target.
- Timer callbacks have no repository command path.
- Moving media never enters standard backups or SW cache.
- Legacy timing and portrait metadata have explicit fixtures.
- Reduced motion, Safari repetition, and cache upgrade have explicit checks.
- No task requires the private reference character asset.
- No unresolved placeholder or unspecified error-handling step remains.
