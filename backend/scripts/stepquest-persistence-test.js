#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'db/migrations/0005_stepquest_core.sql'), 'utf8');
const costumeActiveMigration = fs.readFileSync(path.join(root, 'db/migrations/0006_stepquest_costume_active.sql'), 'utf8');
const guestMigration = fs.readFileSync(path.join(root, 'db/migrations/0007_stepquest_guest_migrations.sql'), 'utf8');
const dbInit = fs.readFileSync(path.join(root, 'scripts/db-init.js'), 'utf8');
const superSeed = fs.readFileSync(path.join(root, 'scripts/seed-super-user.js'), 'utf8');
const packageJson = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
const rootReadme = fs.readFileSync(path.join(root, '../README.md'), 'utf8');
const ciWorkflow = fs.readFileSync(path.join(root, '../.github/workflows/ci.yml'), 'utf8');
const controller = fs.readFileSync(path.join(root, 'src/stepquest/stepquest.controller.ts'), 'utf8');
const service = fs.readFileSync(path.join(root, 'src/stepquest/stepquest.service.ts'), 'utf8');
const devtoolsController = fs.readFileSync(path.join(root, 'src/devtools/devtools.controller.ts'), 'utf8');
const healthController = fs.readFileSync(path.join(root, 'src/health/health.controller.ts'), 'utf8');
const stateModule = fs.readFileSync(path.join(root, 'src/stepquest/stepquest.state.ts'), 'utf8');
const browserApp = fs.readFileSync(path.join(root, 'public/assets/js/app.js'), 'utf8');
const goalsHtml = fs.readFileSync(path.join(root, 'public/goals.html'), 'utf8');
const appCss = fs.readFileSync(path.join(root, 'public/assets/css/app.css'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
const appModule = fs.readFileSync(path.join(root, 'src/app.module.ts'), 'utf8');
const redirectPages = ['index.html', 'dashboard.html', 'play.html', 'skills.html', 'character.html', 'costumes.html', 'battle.html']
  .reduce((memo, file) => {
    memo[file] = fs.readFileSync(path.join(root, 'public', file), 'utf8');
    return memo;
  }, {});
const koStart = goalsHtml.indexOf('const ko = {');
const koEnd = goalsHtml.indexOf('\n    };', koStart);
const koSource = goalsHtml.slice(koStart + 'const ko = '.length, koEnd + 6);
const koStrings = Function(`return (${koSource});`)();

[
  'stepquest_goals',
  'stepquest_chains',
  'stepquest_micro_steps',
  'stepquest_step_attempts',
  'stepquest_reward_transactions',
  'stepquest_village_facilities',
  'stepquest_user_states',
  'stepquest_return_sessions',
  'stepquest_reminders',
].forEach((table) => assert.ok(migration.includes(table), `missing table ${table}`));

assert.ok(migration.includes('UNIQUE (user_id, idempotency_key)'), 'reward idempotency constraint is missing');
assert.ok(migration.includes("status IN ('pending', 'active', 'completed', 'deferred', 'skipped', 'replaced')"), 'micro step state model is missing');
assert.ok(costumeActiveMigration.includes("'costume_active'"), 'costume active attempt action migration is missing');
assert.ok(guestMigration.includes('stepquest_guest_migrations'), 'guest migration ledger table is missing');
assert.ok(guestMigration.includes('UNIQUE (user_id, migration_id)'), 'guest migration must be idempotent per user and migrationId');
assert.ok(dbInit.includes('0005_stepquest_core'), 'db-init does not apply STEPQUEST migration');
assert.ok(dbInit.includes('0006_stepquest_costume_active'), 'db-init does not apply STEPQUEST costume active migration');
assert.ok(dbInit.includes('0007_stepquest_guest_migrations'), 'db-init does not apply STEPQUEST guest migration ledger');
assert.ok(packageJson.includes('"version": "0.1.0-alpha"'), 'backend version must be 0.1.0-alpha');
assert.ok(packageJson.includes('"test:domain": "npm run build &&'), 'domain tests must use cross-platform npm, not npm.cmd');
assert.ok(packageJson.includes('"seed:super"'), 'seed:super script must be present');
assert.ok(packageJson.includes('"test:e2e"'), 'Playwright E2E script must be present');
assert.ok(rootReadme.includes('StepQuest'), 'root README must describe StepQuest');
assert.ok(ciWorkflow.includes('postgres:16'), 'CI must run with a PostgreSQL service container');
assert.ok(ciWorkflow.includes('npm run test:domain'), 'CI must run the domain tests');
assert.ok(ciWorkflow.includes('npm run test:e2e'), 'CI must run the Playwright E2E tests');

[
  "@Post('goals')",
  "@Get('current')",
  "@Post('guest/import')",
  "@Get('stats')",
  "@Get('dungeons')",
  "@Post('goals/:id/pause')",
  "@Post('goals/:id/resume')",
  "@Post('goals/:id/archive')",
  "@Post('goals/:id/regenerate')",
  "@Get('reminder')",
  "@Post('reminder')",
  "@Post('reminder/action')",
  "@Get('costumes')",
  "@Post('costumes/:id/equip')",
  "@Post('costumes/:id/activate')",
  "@Post('steps/:id/complete')",
  "@Post('steps/:id/undo')",
  "@Post('steps/:id/shrink')",
  "@Post('steps/:id/skip')",
  "@Post('steps/:id/defer')",
  "@Post('steps/:id/resume')",
  "@Get('return/eligibility')",
  "@Post('return/start')",
].forEach((route) => assert.ok(controller.includes(route), `missing route ${route}`));

assert.ok(appModule.includes('StepQuestModule'), 'StepQuestModule is not registered');
assert.ok(appModule.includes('HealthModule'), 'HealthModule is not registered');
assert.ok(healthController.includes('@Get()'), 'health endpoint route is missing');
assert.ok(healthController.includes("const APP_VERSION = '0.1.0-alpha'"), 'health endpoint must define the alpha app version');
assert.ok(healthController.includes('version: process.env.APP_VERSION || APP_VERSION'), 'health endpoint must expose the app version');
assert.ok(service.includes('`reminder:${stepId}:complete`'), 'reminder completion must use a stable reward idempotency key');
assert.ok(service.includes('importGuestProgress'), 'guest progress import API is missing');
assert.ok(service.includes('stepquest_guest_migrations'), 'guest import must record migration IDs');
assert.ok(service.includes("status: 'needs_choice'"), 'guest import must return a choice state when account data exists');
assert.ok(service.includes("body.choice === 'merge'"), 'guest import must explicitly block unsafe automatic merge in alpha');
assert.ok(service.includes("guest:${migrationId}:step:${step.sourceId}:complete"), 'guest import rewards must use stable migration idempotency keys');
assert.ok(service.includes('safeCostumeId'), 'guest import must filter QA-only costumes from normal accounts');
assert.ok(service.includes('undoStepCompletion'), 'completed steps must be undoable');
assert.ok(service.includes('shrinkVillage'), 'undo must reverse village growth');
assert.ok(service.includes("const key = idempotencyKey ?? `step:${stepId}:complete`;"), 'completion must use a stable fallback idempotency key');
assert.ok(service.includes("this.lockStepForStatuses(client, userId, stepId, ['completed', 'active'])"), 'undo must lock both completed and already-undone active steps');
assert.ok(service.includes('alreadyUndone.rowCount'), 'duplicate undo calls must be no-op instead of charging twice');
assert.ok(service.includes("SET status = 'deferred', activated_at = NULL"), 'defer must change the active step state');
assert.ok(service.includes('resumeDeferredStep'), 'deferred steps must be resumable as the current action');
assert.ok(service.includes("SET status = 'active', activated_at = NOW()"), 'resume must reactivate a deferred step');
assert.ok(service.includes("['active', 'deferred']"), 'small return must be able to shrink a deferred step');
assert.ok(service.includes('findReentryStep'), 'return flow must find deferred re-entry steps');
assert.ok(service.includes('deferredStep'), 'current API must expose deferred steps for server-backed return panels');
assert.ok(service.includes('consistency,'), 'current API must expose stored consistency state');
assert.ok(service.includes('findDeferredStep'), 'current API must find the last deferred step');
assert.ok(service.includes('regenerateChain'), 'goals must support full chain regeneration');
assert.ok(service.includes("status = 'superseded'"), 'regeneration must supersede the previous active chain');
assert.ok(service.includes('returnCompleted'), 'return recovery completion must be reported');
assert.ok(service.includes('isFirstReturnStep: isReturnStep'), 'return recovery completion must use the return reward multiplier');
assert.ok(service.includes('LIMIT 6'), 'stats must include a short recent attempt timeline');
assert.ok(service.includes('RETURNING id, title, category, status, completed_at AS "completedAt"'), 'completed goals must be returned after the final step');
assert.ok(service.includes('costumeRewardMultiplier'), 'server completion must apply equipped costume passive multipliers');
assert.ok(service.includes('costumeMultiplier,'), 'server completion response must expose the costume multiplier');
assert.ok(service.includes('SET goal_coin = goal_coin + $2'), 'step completion material reward must feed the account goal_coin wallet');
assert.ok(service.includes('SET goal_coin = GREATEST(0, goal_coin - $2)'), 'undo must reverse account goal_coin granted by a step');
assert.ok(service.includes('COALESCE(c.goal_coin, sus.material) AS "goalCoin"'), 'current user state must expose the spendable account goal_coin wallet');
assert.ok(service.includes("`${key}:combo_chest`"), 'account completion must grant a real combo chest reward');
assert.ok(service.includes("source_type IN ('step', 'achievement')"), 'undo must remove completion-linked achievement rewards');
assert.ok(browserApp.includes('Boolean(result.comboBonus)'), 'account completion feedback must only show chest when the server grants it');
assert.ok(browserApp.includes('rawUser.goalCoin ?? rawUser.material ?? 0'), 'browser user mapping must prefer account goal_coin over legacy material');
assert.ok(service.includes('INSERT INTO currencies (user_id, idle_gold, goal_coin)'), 'STEPQUEST user bootstrap must ensure the account goal_coin wallet exists');
assert.ok(service.includes('INSERT INTO consistency_states'), 'STEPQUEST user bootstrap must ensure consistency state exists');
assert.ok(service.includes('updateConsistency(client, userId)'), 'StepQuest completion and undo must refresh consistency state');
assert.ok(service.includes('FROM stepquest_micro_steps ms'), 'StepQuest consistency must count completed StepQuest micro steps');
assert.ok(service.includes('UNION'), 'StepQuest consistency must preserve legacy and StepQuest completion dates together');
assert.ok(service.includes('getCostumeActiveCharge'), 'server costume active ability must expose a recharge state');
assert.ok(service.includes('recordCostumeActiveUse'), 'server costume active use must be recorded for recharge');
assert.ok(service.includes('createdSteps: created'), 'server costume active response must expose the number of created strategy steps');
assert.ok(service.includes('AND order_index >= $3'), 'costume active strategy steps must be inserted at the current action position');
assert.ok(service.includes('current.orderIndex + index'), 'costume active strategy step order must preserve earlier completed steps');
assert.ok(service.includes('COSTUME_ACTIVE_RECHARGE_STEPS = 3'), 'costume active recharge must require three completed steps');
assert.ok(service.includes("id: 'one_punch_hero'"), 'server must include the super test hero costume');
assert.ok(service.includes("costumeId === 'one_punch_hero' && !isSuperModeAllowed()"), 'server must block the super test hero unless super mode is allowed');
assert.ok(service.includes('availableCostumes()'), 'server costume list must filter QA-only costumes');
assert.ok(!browserApp.includes("id: 'one_punch_hero'"), 'browser production bundle must not include the super test hero costume');
assert.ok(!browserApp.includes('super@stepquest.local'), 'browser production bundle must not include the default super email');
assert.ok(devtoolsController.includes("process.env.NODE_ENV !== 'production'"), 'super mode script must be disabled in production');
assert.ok(devtoolsController.includes("process.env.ENABLE_SUPER_MODE === 'true'"), 'super mode script must require ENABLE_SUPER_MODE=true');
assert.ok(devtoolsController.includes("super@stepquest.local"), 'dev-only super script must provide a local default email');
assert.ok(goalsHtml.includes('/dev/super-mode.js?v=52'), 'HTML shell must request the dev-only super mode hook before app.js');
assert.ok(superSeed.includes("super@stepquest.local"), 'super account seed script must provide a local default email');
assert.ok(superSeed.includes("NODE_ENV === 'production'"), 'super account seed script must fail in production');
assert.ok(superSeed.includes('INSERT INTO user_skills'), 'super account seed script must unlock all skills');
assert.ok(superSeed.includes('INSERT INTO user_costumes'), 'super account seed script must unlock all shop costumes');
assert.ok(superSeed.includes('one_punch_hero'), 'super account seed script must equip the super test hero');
assert.ok(stateModule.includes("id: 'blank_scribe'"), 'domain state must include the writing starter costume');
assert.ok(stateModule.includes("id: 'dawn_knight'"), 'domain state must include the wake starter costume');
const brokenCompleteLabel = '?' + '꾨즺';
assert.ok(!service.includes(brokenCompleteLabel), 'server must not persist broken Korean success criteria');
assert.ok(service.includes('`${template.title} 완료`'), 'server costume active steps must persist readable success criteria');
assert.ok(browserApp.includes('const key = `web:${id}:complete`;'), 'web completion must use a stable reward idempotency key');
assert.ok(browserApp.includes('function costumeRewardMultiplier'), 'guest completion must apply equipped costume passive multipliers');
assert.ok(browserApp.includes('function costumeActiveCharge'), 'guest costume active ability must expose a recharge state');
assert.ok(browserApp.includes('assertGuestCostumeActiveAvailable'), 'guest costume active ability must enforce recharge');
assert.ok(browserApp.includes('result.insertedSteps?.length'), 'account costume active feedback must count server-created strategy steps');
assert.ok(browserApp.includes('const eligible = inactiveHours >= 24;'), 'guest return eligibility must follow the 24-hour rule');
assert.ok(browserApp.includes('costumeMultiplier: result.costumeMultiplier || 1'), 'web completion feedback must carry the server costume multiplier');
assert.ok(browserApp.includes('async function undoMicro'), 'browser app must expose undo completion behavior');
assert.ok(browserApp.includes('rewardSnapshot'), 'guest undo must preserve reward amounts to reverse');
assert.ok(browserApp.includes('async function regenerateGoal'), 'browser app must expose full goal regeneration');
assert.ok(browserApp.includes('activeRevision'), 'guest regeneration must isolate the current chain revision');
assert.ok(browserApp.includes('returnCompleted'), 'browser app must show completed return recovery sessions');
assert.ok(browserApp.includes('const recent = (guest.attempts || [])'), 'guest stats must include recent attempts');
assert.ok(browserApp.includes("goal.status = 'DONE';"), 'guest dungeon must be marked cleared after the final step');
assert.ok(browserApp.includes("url: '/goals.html?reminder=1#today'"), 'reminder notifications must deep-link back to the current action');
assert.ok(browserApp.includes('registration.showNotification'), 'reminders must use service worker notifications when available');
assert.ok(goalsHtml.includes('class="action-timer"'), 'current step card must include an execution timer');
assert.ok(goalsHtml.includes('function startStepTimer()'), 'execution timer start behavior is missing');
assert.ok(goalsHtml.includes('btn-reset-timer'), 'execution timer reset control is missing');
assert.ok(goalsHtml.includes('ready-to-complete'), 'timer completion must highlight the complete action');
assert.ok(goalsHtml.includes("const timerStorageKey = 'stepquest_timer_state'"), 'execution timer persistence key is missing');
assert.ok(goalsHtml.includes('function readStoredTimer'), 'execution timer restore behavior is missing');
assert.ok(goalsHtml.includes('function saveTimerState'), 'execution timer save behavior is missing');
assert.ok(goalsHtml.includes('ensureTimerInterval();'), 'restored running timer must continue after render');
assert.ok(goalsHtml.includes('timerStartedLog'), 'timer start must leave a user-facing trace');
assert.ok(goalsHtml.includes('timerDoneLog'), 'timer completion must leave a user-facing trace');
assert.ok(goalsHtml.includes("const focusStorageKey = 'stepquest_focus_mode'"), 'focus mode persistence key is missing');
assert.ok(goalsHtml.includes('function isFocusMode'), 'focus mode state check is missing');
assert.ok(goalsHtml.includes("root.classList.toggle('focus-page', focus)"), 'focus mode must collapse the page to the active step');
assert.ok(goalsHtml.includes('btn-exit-focus'), 'focus mode must provide an exit control');
assert.ok(goalsHtml.includes('quick-goal-row'), 'goal creation must start from a single-line quick input');
assert.ok(goalsHtml.includes('class="goal-details"'), 'advanced goal inputs must be collapsed behind details');
assert.ok(goalsHtml.includes("skipped: '\\uB118\\uAE40'"), 'skipped chain status must be distinct from replaced');
assert.ok(goalsHtml.includes('function statusClass'), 'chain items must expose status-specific classes');
assert.ok(goalsHtml.includes("const restStorageKey = 'stepquest_rest_state'"), 'rest state persistence key is missing');
assert.ok(goalsHtml.includes('function renderRestPanel'), 'stop-today flow must show a return panel');
assert.ok(goalsHtml.includes('App.state.deferredStep'), 'rest panel must render from server-backed deferred steps');
assert.ok(goalsHtml.includes('btn-return-small'), 'return panel must provide a small re-entry action');
assert.ok(goalsHtml.includes("await App.shrinkMicro(stepId, 'not_now');"), 'small re-entry action must create a smaller step');
assert.ok(browserApp.includes("step.status = 'DEFERRED';"), 'guest defer must change the step state');
assert.ok(browserApp.includes('async function resumeMicro'), 'browser app must expose deferred-step resume behavior');
assert.ok(goalsHtml.includes('await App.resumeMicro(stepId);'), 'resume-original action must reactivate the deferred step');
assert.ok(browserApp.includes('deferredStep'), 'browser state must preserve server deferred steps');
assert.ok(browserApp.includes('function shrinkReasonInfo'), 'shrink reason strategy helper is missing');
assert.ok(browserApp.includes('shrinkStrategy'), 'shrink events must explain how the step changed');
assert.ok(goalsHtml.includes('shrink-map'), 'shrink feedback must compare previous and smaller steps');
assert.ok(browserApp.includes("type: 'costume_active'"), 'costume active events must be recorded');
assert.ok(goalsHtml.includes('costume-pulse'), 'costume active feedback must be rendered');
assert.ok(goalsHtml.includes('activeCharge'), 'costume cards must show active ability charge state');
assert.ok(browserApp.includes("type: 'skip'"), 'skip events must be recorded');
assert.ok(goalsHtml.includes('skip-pulse'), 'skip feedback must be rendered');
assert.ok(browserApp.includes('function facilityInfo'), 'facility metadata helper is missing');
assert.ok(browserApp.includes('facilityDetail'), 'reward events must include grown facility detail');
assert.ok(goalsHtml.includes('facility-reward'), 'reward pulse must name the grown facility');
assert.ok(goalsHtml.includes('costumeBonus'), 'reward pulse must show costume passive bonus when it applies');
assert.ok(goalsHtml.includes('facility-detail'), 'village cards must explain what each facility grows from');
assert.ok(browserApp.includes('nextStepTitle'), 'completion events must carry the next micro-action title');
assert.ok(browserApp.includes('clearedGoalTitle'), 'completion events must carry cleared goal context');
assert.ok(goalsHtml.includes('next-entrance'), 'completion feedback must show the next entrance');
assert.ok(goalsHtml.includes('btn-undo-complete'), 'completion feedback must allow immediate undo');
assert.ok(goalsHtml.includes('undo-pulse'), 'undo feedback must show what changed');
assert.ok(goalsHtml.includes('btn-regenerate-dungeon'), 'dungeon cards must offer chain regeneration');
assert.ok(goalsHtml.includes('returnCompleted'), 'completion feedback must acknowledge return completion');
assert.ok(goalsHtml.includes('recent-trace'), 'stats panel must render recent attempts');
assert.ok(goalsHtml.includes('v=52'), 'shell asset cache version must be bumped');
assert.ok(serviceWorker.includes("stepquest-shell-v52"), 'service worker cache name must be bumped after guest migration changes');
assert.ok(serviceWorker.includes('notificationclick'), 'service worker must handle reminder notification clicks');
assert.ok(serviceWorker.includes('/goals.html?reminder=1#today'), 'notification click must return to the action screen');
assert.ok(manifest.includes('큰 목표를 지금 할 수 있는 작은 행동'), 'manifest description must be localized and readable');
assert.ok(manifest.includes('오늘의 작은 행동'), 'manifest shortcut must be localized and readable');
assert.ok(appCss.includes('.action-timer'), 'execution timer styles are missing');
assert.ok(appCss.includes('.primary-actions button.ready-to-complete'), 'complete action highlight styles are missing');
assert.ok(appCss.includes('.focus-runner'), 'focus mode styles are missing');
assert.ok(appCss.includes('.quick-goal-row'), 'quick goal input styles are missing');
assert.ok(appCss.includes('.goal-details'), 'collapsed advanced goal styles are missing');
assert.ok(appCss.includes('.rest-runner'), 'rest return panel styles are missing');
assert.ok(appCss.includes('.shrink-map'), 'shrink feedback styles are missing');
assert.ok(appCss.includes('.costume-pulse-grid'), 'costume active feedback styles are missing');
assert.ok(appCss.includes('.skip-map'), 'skip feedback styles are missing');
assert.ok(appCss.includes('.chain-item.skipped'), 'skipped chain item styles are missing');
assert.ok(appCss.includes('.reward-note'), 'reward facility explanation styles are missing');
assert.ok(appCss.includes('.facility-example'), 'village facility example styles are missing');
assert.ok(appCss.includes('.next-entrance'), 'next entrance feedback styles are missing');
assert.ok(appCss.includes('.undo-map'), 'undo feedback styles are missing');
assert.ok(appCss.includes('.trace-item'), 'recent attempt timeline styles are missing');
assert.ok(goalsHtml.includes('player-character'), 'village scene must include the equipped player character');
assert.ok(!appCss.includes('.player-one_punch_hero'), 'super test hero styles must stay out of the production CSS bundle');
assert.ok(devtoolsController.includes('.player-one_punch_hero'), 'dev-only super script must provide the QA hero sprite styles');
Object.entries(koStrings).forEach(([key, value]) => {
  if (typeof value === 'string') {
    assert.ok(!value.includes('?') && !value.includes('\uFFFD'), `visible Korean copy contains broken text: ${key}`);
    assert.ok(!value.includes('\uC2E4\uD328'), `visible Korean copy should avoid failure language: ${key}`);
  }
});
assert.ok(!manifest.includes('?') && !manifest.includes('\uFFFD'), 'manifest must not contain broken visible text');
assert.ok(browserApp.includes('\\uC624\\uB298\\uC758 \\uD754\\uC801'), 'user-facing progress log label is missing');
assert.ok(browserApp.includes('\\uD655\\uC778 \\uD544\\uC694: '), 'user-facing error log label is missing');
assert.ok(browserApp.includes("const logsStorageKey = 'stepquest_today_traces'"), 'today traces must persist across refresh');
assert.ok(browserApp.includes('localStorage.setItem(logsStorageKey'), 'today traces persistence write is missing');
assert.ok(browserApp.includes('maybeImportGuestProgress'), 'login/signup must attempt guest progress import');
assert.ok(browserApp.includes("'/stepquest/guest/import'"), 'browser app must call the guest import endpoint');
assert.ok(browserApp.includes('guest.migratedAt'), 'browser app must mark guest data after migration');
assert.ok(browserApp.includes("const motionStorageKey = 'stepquest_reduced_motion'"), 'reduced motion preference must persist');
assert.ok(browserApp.includes('function setReducedMotion'), 'reduced motion toggle behavior is missing');
assert.ok(appCss.includes('.settings-toggle'), 'reduced motion toggle styles are missing');
assert.ok(appCss.includes('prefers-reduced-motion'), 'system reduced motion preference must be respected');
assert.ok(appCss.includes('.costume-charge.ready'), 'costume active charge status styles are missing');
Object.entries(redirectPages).forEach(([file, text]) => {
  assert.ok(!text.includes('?') && !text.includes('\uFFFD'), `redirect page must not contain broken text: ${file}`);
  assert.ok(text.includes('/goals.html'), `redirect page must point back to STEPQUEST: ${file}`);
});
const debugErrorLabel = "'ERR" + "OR'";
const debugOkLabel = "'O" + "K'";
assert.ok(!browserApp.includes(debugErrorLabel) && !browserApp.includes(debugOkLabel), 'debug-style log labels must not be shown to users');

console.log(JSON.stringify({ ok: true, checked: 'stepquest-persistence' }, null, 2));
