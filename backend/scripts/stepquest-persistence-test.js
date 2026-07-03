#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'db/migrations/0005_stepquest_core.sql'), 'utf8');
const costumeActiveMigration = fs.readFileSync(path.join(root, 'db/migrations/0006_stepquest_costume_active.sql'), 'utf8');
const guestMigration = fs.readFileSync(path.join(root, 'db/migrations/0007_stepquest_guest_migrations.sql'), 'utf8');
const settingsMigration = fs.readFileSync(path.join(root, 'db/migrations/0008_user_settings_and_events.sql'), 'utf8');
const dbInit = fs.readFileSync(path.join(root, 'scripts/db-init.js'), 'utf8');
const startProduction = fs.readFileSync(path.join(root, 'scripts/start-production.js'), 'utf8');
const superSeed = fs.readFileSync(path.join(root, 'scripts/seed-super-user.js'), 'utf8');
const packageJson = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
const rootReadme = fs.readFileSync(path.join(root, '../README.md'), 'utf8');
const stagingRunbook = fs.readFileSync(path.join(root, '../STAGING_RUNBOOK.md'), 'utf8');
const alphaTestPlan = fs.readFileSync(path.join(root, '../CLOSED_ALPHA_TEST_PLAN.md'), 'utf8');
const renderBlueprint = fs.readFileSync(path.join(root, '../render.yaml'), 'utf8');
const ciWorkflow = fs.readFileSync(path.join(root, '../.github/workflows/ci.yml'), 'utf8');
const stagingSmokeWorkflow = fs.readFileSync(path.join(root, '../.github/workflows/staging-smoke.yml'), 'utf8');
const dependabotConfig = fs.readFileSync(path.join(root, '../.github/dependabot.yml'), 'utf8');
const securityAudit = fs.readFileSync(path.join(root, '../SECURITY_AUDIT.md'), 'utf8');
const controller = fs.readFileSync(path.join(root, 'src/stepquest/stepquest.controller.ts'), 'utf8');
const service = fs.readFileSync(path.join(root, 'src/stepquest/stepquest.service.ts'), 'utf8');
const devtoolsController = fs.readFileSync(path.join(root, 'src/devtools/devtools.controller.ts'), 'utf8');
const healthController = fs.readFileSync(path.join(root, 'src/health/health.controller.ts'), 'utf8');
const authController = fs.readFileSync(path.join(root, 'src/auth/auth.controller.ts'), 'utf8');
const appVersionSource = fs.readFileSync(path.join(root, 'src/shared/app-version.ts'), 'utf8');
const mainTs = fs.readFileSync(path.join(root, 'src/main.ts'), 'utf8');
const safeLogger = fs.readFileSync(path.join(root, 'src/shared/safe-logger.middleware.ts'), 'utf8');
const stateModule = fs.readFileSync(path.join(root, 'src/stepquest/stepquest.state.ts'), 'utf8');
const browserApp = fs.readFileSync(path.join(root, 'public/assets/js/app.js'), 'utf8');
const goalsHtml = fs.readFileSync(path.join(root, 'public/goals.html'), 'utf8');
const appCss = fs.readFileSync(path.join(root, 'public/assets/css/app.css'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
const stagingSmoke = fs.readFileSync(path.join(root, 'scripts/staging-smoke-test.js'), 'utf8');
const stagingSmokeCleanup = fs.readFileSync(path.join(root, 'scripts/cleanup-staging-smoke-data.js'), 'utf8');
const productEventReport = fs.readFileSync(path.join(root, 'scripts/product-event-report.js'), 'utf8');
const appModule = fs.readFileSync(path.join(root, 'src/app.module.ts'), 'utf8');
const eventsController = fs.readFileSync(path.join(root, 'src/events/events.controller.ts'), 'utf8');
const productEventDto = fs.readFileSync(path.join(root, 'src/events/dto/track-product-event.dto.ts'), 'utf8');
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
assert.ok(settingsMigration.includes('user_settings'), 'user timezone settings table is missing');
assert.ok(settingsMigration.includes("DEFAULT 'Asia/Seoul'"), 'user timezone default must be Asia/Seoul');
assert.ok(settingsMigration.includes('product_events'), 'product event table is missing');
assert.ok(dbInit.includes('0005_stepquest_core'), 'db-init does not apply STEPQUEST migration');
assert.ok(dbInit.includes('0006_stepquest_costume_active'), 'db-init does not apply STEPQUEST costume active migration');
assert.ok(dbInit.includes('0007_stepquest_guest_migrations'), 'db-init does not apply STEPQUEST guest migration ledger');
assert.ok(dbInit.includes('0008_user_settings_and_events'), 'db-init does not apply user settings and product events migration');
assert.ok(dbInit.includes('function clientConfig'), 'db-init must centralize PostgreSQL client configuration');
assert.ok(dbInit.includes('const client = new Client(clientConfig(databaseUrl));'), 'db-init must create a fresh client for each connection retry');
assert.ok(dbInit.includes('await client.end().catch(() => {})'), 'db-init must close failed retry clients');
assert.ok(dbInit.includes("await client.query('BEGIN')"), 'db-init must apply each migration file transactionally');
assert.ok(dbInit.includes('INSERT INTO codex_migrations'), 'db-init must record migration markers');
assert.ok(dbInit.includes("await client.query('ROLLBACK')"), 'db-init must roll back failed migration files');
assert.ok(startProduction.includes('validateProductionEnv'), 'production start must validate deployment environment');
assert.ok(startProduction.includes('APP_VERSION is required in production'), 'production start must require app version metadata');
assert.ok(startProduction.includes('ENABLE_SUPER_MODE must be explicitly false in production'), 'production start must require explicit super-mode disablement');
assert.ok(startProduction.includes('SKIP_DB_INIT must not be true in production'), 'production start must not allow skipping migrations');
assert.ok(startProduction.includes('JWT_SECRET must be set to a strong random value in production'), 'production start must require a strong JWT secret');
assert.ok(envExample.includes('JWT_SECRET=change-this-secret-to-at-least-32-random-characters'), '.env.example must show a strong JWT secret placeholder');
assert.ok(packageJson.includes('"version": "0.1.1-alpha"'), 'backend version must be 0.1.1-alpha');
assert.ok(packageJson.includes('"node": ">=20 <23"'), 'backend package must pin a Node 20 compatible runtime');
assert.ok(packageJson.includes('"test:domain": "npm run build &&'), 'domain tests must use cross-platform npm, not npm.cmd');
assert.ok(packageJson.includes('node scripts/health-test.js'), 'domain tests must verify health check behavior');
assert.ok(packageJson.includes('node scripts/version-consistency-test.js'), 'domain tests must verify deployment version consistency');
assert.ok(packageJson.includes('node scripts/production-env-test.js'), 'domain tests must verify production environment guards');
assert.ok(packageJson.includes('node scripts/request-logger-test.js'), 'domain tests must verify safe structured logging');
assert.ok(packageJson.includes('node scripts/product-event-dto-test.js'), 'domain tests must verify product event payload boundaries');
assert.ok(packageJson.includes('node scripts/product-event-auth-test.js'), 'domain tests must verify optional product event account linking');
assert.ok(packageJson.includes('node scripts/timezone-test.js'), 'domain tests must verify Korean midnight timezone boundaries');
assert.ok(packageJson.includes('"seed:super"'), 'seed:super script must be present');
assert.ok(packageJson.includes('"test:e2e"'), 'Playwright E2E script must be present');
assert.ok(packageJson.includes('"audit:ci"'), 'production audit CI script must be present');
assert.ok(packageJson.includes('"smoke:staging"'), 'staging smoke script must be present');
assert.ok(packageJson.includes('"smoke:cleanup"'), 'staging smoke cleanup script must be present');
assert.ok(packageJson.includes('"analytics:report"'), 'product event analytics report script must be present');
assert.ok(rootReadme.includes('StepQuest'), 'root README must describe StepQuest');
assert.ok(rootReadme.includes('v0.1.1-alpha'), 'root README must show the current alpha version');
assert.ok(rootReadme.includes('STAGING_RUNBOOK.md'), 'root README must point to the staging runbook');
assert.ok(rootReadme.includes('StepQuest Staging Smoke'), 'root README must mention the manual staging smoke workflow');
assert.ok(rootReadme.includes('CLOSED_ALPHA_TEST_PLAN.md'), 'root README must point to the closed alpha test plan');
assert.ok(stagingRunbook.includes('STAGING_URL='), 'staging runbook must document the smoke test command');
assert.ok(stagingRunbook.includes('Actions -> StepQuest Staging Smoke'), 'staging runbook must document the GitHub staging smoke workflow');
assert.ok(stagingRunbook.includes('ENABLE_SUPER_MODE=false'), 'staging runbook must forbid super mode');
assert.ok(stagingRunbook.includes('JWT_SECRET=<32+ character random secret>'), 'staging runbook must document strong JWT secret enforcement');
assert.ok(stagingRunbook.includes('NODE_VERSION=20'), 'staging runbook must document the Node runtime version');
assert.ok(stagingRunbook.includes('APP_VERSION` is missing'), 'staging runbook must document app version startup failure');
assert.ok(stagingRunbook.includes('not exactly `false`'), 'staging runbook must document explicit super-mode startup failure');
assert.ok(stagingRunbook.includes('SKIP_DB_INIT=true'), 'staging runbook must document production migration skip startup failure');
assert.ok(stagingRunbook.includes('one DB transaction'), 'staging runbook must document transactional migration startup');
assert.ok(stagingRunbook.includes('npm run analytics:report'), 'staging runbook must explain how to pull product event metrics');
assert.ok(alphaTestPlan.includes('ADHD-friendly execution helper'), 'closed alpha plan must avoid medical treatment positioning');
assert.ok(alphaTestPlan.includes('Goal created -> first step completed'), 'closed alpha plan must define the primary execution metric');
assert.ok(alphaTestPlan.includes('retention.d1RetentionPct'), 'closed alpha plan must map D1 retention to the report output');
assert.ok(alphaTestPlan.includes('Production super login succeeds'), 'closed alpha plan must include security stop conditions');
assert.ok(renderBlueprint.includes('healthCheckPath: /health'), 'Render blueprint must use the health endpoint');
assert.ok(renderBlueprint.includes('rootDir: backend'), 'Render blueprint must deploy the backend directory');
assert.ok(renderBlueprint.includes('NODE_VERSION'), 'Render blueprint must pin the Node runtime version');
assert.ok(stagingSmokeWorkflow.includes('workflow_dispatch'), 'staging smoke workflow must be manually runnable');
assert.ok(stagingSmokeWorkflow.includes('staging_url'), 'staging smoke workflow must accept a staging URL input');
assert.ok(stagingSmokeWorkflow.includes('npm run smoke:staging'), 'staging smoke workflow must run the staging smoke script');
assert.ok(stagingSmokeWorkflow.includes('cleanup_smoke_data'), 'staging smoke workflow must optionally clean up smoke data');
assert.ok(stagingSmokeWorkflow.includes('STAGING_DATABASE_URL'), 'staging smoke cleanup workflow must use an explicit database secret');
assert.ok(stagingSmokeWorkflow.includes('CONFIRM_STAGING_SMOKE_CLEANUP'), 'staging smoke cleanup workflow must explicitly confirm deletion');
assert.ok(dependabotConfig.includes('package-ecosystem: npm'), 'Dependabot must watch backend npm dependencies');
assert.ok(dependabotConfig.includes('directory: /backend'), 'Dependabot npm updates must target backend');
assert.ok(dependabotConfig.includes('package-ecosystem: github-actions'), 'Dependabot must watch GitHub Actions');
assert.ok(securityAudit.includes('Enable Dependabot alerts'), 'security audit must document the repository-level Dependabot alerts step');
assert.ok(securityAudit.includes('Critical or High production alert'), 'security audit must define the production alert release gate');
assert.ok(stagingSmoke.includes('/health'), 'staging smoke test must check health');
assert.ok(stagingSmoke.includes("health.data.environment, 'production'"), 'staging smoke test must verify production runtime mode');
assert.ok(stagingSmoke.includes('/dev/super-mode.js?v='), 'staging smoke test must check production super mode');
assert.ok(stagingSmoke.includes('packageVersion'), 'staging smoke test must derive its default version from package.json');
assert.ok(stagingSmoke.includes('x-content-type-options'), 'staging smoke test must verify Helmet security headers');
assert.ok(stagingSmoke.includes('strict-transport-security'), 'staging smoke test must verify HSTS');
assert.ok(stagingSmoke.includes('/events/track'), 'staging smoke test must check product event ingestion');
assert.ok(stagingSmoke.includes('/stepquest/costumes/one_punch_hero/equip'), 'staging smoke test must reject direct QA costume access');
assert.ok(stagingSmoke.includes('/auth/signup'), 'staging smoke test must create disposable authenticated users');
assert.ok(stagingSmoke.includes('/auth/login'), 'staging smoke test must verify account login after signup');
assert.ok(stagingSmoke.includes('/stepquest/goals'), 'staging smoke test must create a real StepQuest goal');
assert.ok(stagingSmoke.includes('idempotencyKey'), 'staging smoke test must verify duplicate completion idempotency');
assert.ok(stagingSmoke.includes('/shrink'), 'staging smoke test must verify shrink behavior');
assert.ok(stagingSmoke.includes('/defer'), 'staging smoke test must verify defer behavior');
assert.ok(stagingSmoke.includes('/stepquest/return/eligibility'), 'staging smoke test must verify return eligibility behavior');
assert.ok(stagingSmoke.includes('/resume'), 'staging smoke test must verify deferred step resume behavior');
assert.ok(stagingSmoke.includes('/stepquest/guest/import'), 'staging smoke test must verify guest import idempotency');
assert.ok(stagingSmoke.includes('relogged account must load StepQuest state'), 'staging smoke test must verify account persistence after relogin');
assert.ok(stagingRunbook.includes('shrink a blocked Step, defer it, read return eligibility, and resume it'), 'staging runbook must document shrink/defer/return smoke coverage');
assert.ok(stagingSmoke.includes('ALLOW_INSECURE_STAGING_SMOKE'), 'staging smoke test must require HTTPS unless explicitly bypassed for local dry runs');
assert.ok(stagingSmoke.includes('AbortSignal.timeout'), 'staging smoke test must fail hung requests with a timeout');
assert.ok(stagingSmoke.includes('received HTTP'), 'staging smoke test must include response status diagnostics');
assert.ok(stagingRunbook.includes('Disposable `example.com` staging users'), 'staging runbook must explain smoke-test user creation');
assert.ok(stagingRunbook.includes('SMOKE_TIMEOUT_MS'), 'staging runbook must document smoke request timeout tuning');
assert.ok(stagingRunbook.includes('real staging URL must use HTTPS'), 'staging runbook must document HTTPS enforcement');
assert.ok(stagingRunbook.includes('npm run smoke:cleanup'), 'staging runbook must document smoke data cleanup');
assert.ok(stagingRunbook.includes('cleanup_smoke_data=true'), 'staging runbook must document optional GitHub smoke cleanup');
assert.ok(stagingRunbook.includes('STAGING_DATABASE_URL'), 'staging runbook must document the cleanup database secret');
assert.ok(stagingSmokeCleanup.includes('SMOKE_CLEANUP_DRY_RUN'), 'staging smoke cleanup must default to a dry-run mode');
assert.ok(stagingSmokeCleanup.includes('CONFIRM_STAGING_SMOKE_CLEANUP'), 'staging smoke cleanup must require explicit confirmation before deletion');
assert.ok(stagingSmokeCleanup.includes('staging-smoke+%@example.com'), 'staging smoke cleanup must only target smoke account prefixes');
assert.ok(stagingSmokeCleanup.includes('staging-smoke-anon'), 'staging smoke cleanup must only target smoke product events');
assert.ok(productEventReport.includes('goalToFirstCompletionPct'), 'product event report must expose goal-to-completion conversion');
assert.ok(productEventReport.includes('firstStepShownToCompletionPct'), 'product event report must expose first-step-to-completion conversion');
assert.ok(productEventReport.includes('completionUndoPct'), 'product event report must expose undo rate');
assert.ok(productEventReport.includes('shrinkToCompletionPct'), 'product event report must expose shrink-to-completion conversion');
assert.ok(productEventReport.includes('skipAfterShownPct'), 'product event report must expose skip-after-shown rate');
assert.ok(productEventReport.includes('deferAfterShownPct'), 'product event report must expose defer-after-shown rate');
assert.ok(productEventReport.includes('returnOfferToStartPct'), 'product event report must expose return-start conversion');
assert.ok(productEventReport.includes('returnStartToCompletePct'), 'product event report must expose return-completion conversion');
assert.ok(productEventReport.includes('goalClearPct'), 'product event report must expose goal clear rate');
assert.ok(productEventReport.includes('d1RetentionPct'), 'product event report must expose D1 retention');
assert.ok(productEventReport.includes('d7RetentionPct'), 'product event report must expose D7 retention');
assert.ok(productEventReport.includes('REPORT_TIMEZONE'), 'product event report must calculate retention in the configured timezone');
assert.ok(productEventReport.includes('REPORT_ENV'), 'product event report must filter events by environment');
assert.ok(ciWorkflow.includes('postgres:16'), 'CI must run with a PostgreSQL service container');
assert.ok(ciWorkflow.includes('test-only-secret-with-at-least-32-characters'), 'CI must use a production-strength test JWT secret');
assert.ok(ciWorkflow.includes('npm run test:domain'), 'CI must run the domain tests');
assert.ok(ciWorkflow.includes('npm run test:e2e'), 'CI must run the Playwright E2E tests');
assert.ok(ciWorkflow.includes('npm run audit:ci'), 'CI must run the production audit gate');

[
  "@Post('goals')",
  "@Get('current')",
  "@Get('settings')",
  "@Post('settings')",
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
assert.ok(appModule.includes('ThrottlerModule.forRoot'), 'rate limiting module is not registered');
assert.ok(appModule.includes('EventsModule'), 'product events module is not registered');
assert.ok(eventsController.includes("@Throttle({ default: { ttl: 60_000, limit: 120 } })"), 'product event ingestion must be rate-limited');
assert.ok(eventsController.includes('optionalUserId'), 'product events must link authenticated events without blocking guest tracking');
assert.ok(eventsController.includes('verifyAsync'), 'product event optional auth must verify bearer tokens');
assert.ok(browserApp.includes("Authorization: `Bearer ${state.token}`"), 'browser product events must attach account tokens when available');
assert.ok(productEventDto.includes('@Matches(/^[A-Za-z0-9:_-]+$/)'), 'product event IDs must reject free text');
assert.ok(authController.includes("@Throttle({ default: { ttl: 600_000, limit: 5 } })\r\n  @Post('signup')")
  || authController.includes("@Throttle({ default: { ttl: 600_000, limit: 5 } })\n  @Post('signup')"), 'signup must be rate-limited to 5 attempts per 10 minutes');
assert.ok(authController.includes("@Throttle({ default: { ttl: 60_000, limit: 5 } })\r\n  @Post('login')")
  || authController.includes("@Throttle({ default: { ttl: 60_000, limit: 5 } })\n  @Post('login')"), 'login must be rate-limited to 5 attempts per minute');
assert.ok(mainTs.includes('helmet('), 'helmet must be applied at bootstrap');
assert.ok(mainTs.includes('safeRequestLogger'), 'safe structured request logger must be applied at bootstrap');
assert.ok(safeLogger.includes('ConsoleErrorReporter'), 'safe request logger must connect server errors to the error reporter');
assert.ok(safeLogger.includes('response.statusCode >= 500'), 'safe request logger must report 5xx app errors');
assert.ok(safeLogger.includes('sanitizePath'), 'safe request logger must remove query strings before logging');
assert.ok(safeLogger.includes('SAFE_REQUEST_ID'), 'safe request logger must reject unsafe request IDs');
assert.ok(browserApp.includes("response.headers.get('x-request-id')"), 'browser API errors must expose request IDs for staging diagnostics');
assert.ok(stagingSmoke.includes('x-request-id'), 'staging smoke requests must send request IDs for log correlation');
assert.ok(stagingSmoke.includes('requestId'), 'staging smoke failures must include request IDs');
assert.ok(mainTs.includes("app.set('trust proxy', 1)"), 'reverse proxy trust setting must be available');
assert.ok(healthController.includes('@Get()'), 'health endpoint route is missing');
assert.ok(healthController.includes('appVersion()'), 'health endpoint must expose the app version');
assert.ok(healthController.includes('environment'), 'health endpoint must expose the runtime environment');
assert.ok(healthController.includes('ServiceUnavailableException'), 'health endpoint must fail with HTTP 503 when the DB is unavailable');
assert.ok(appVersionSource.includes('RENDER_GIT_COMMIT'), 'health commit metadata must read Render deploy commit env');
assert.ok(service.includes('`reminder:${stepId}:complete`'), 'reminder completion must use a stable reward idempotency key');
assert.ok(service.includes('importGuestProgress'), 'guest progress import API is missing');
assert.ok(service.includes('getSettings'), 'user timezone settings API is missing');
assert.ok(service.includes('dateKeyInTimezone'), 'consistency must calculate dates with the user timezone');
assert.ok(service.includes("INSERT INTO user_settings"), 'StepQuest user bootstrap must create timezone settings');
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
assert.ok(goalsHtml.includes('/dev/super-mode.js?v=0.1.1-alpha'), 'HTML shell must request the dev-only super mode hook before app.js');
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
assert.ok(goalsHtml.includes('v=0.1.1-alpha'), 'shell asset cache version must be bumped');
assert.ok(serviceWorker.includes("const CACHE_VERSION = 'stepquest-v0.1.1-alpha'"), 'service worker cache version must follow the app version');
assert.ok(serviceWorker.includes('self.skipWaiting()'), 'service worker must activate updated deploys promptly');
assert.ok(serviceWorker.includes('self.clients.claim()'), 'service worker must claim open clients after activation');
assert.ok(serviceWorker.includes('caches.delete(key)'), 'service worker must delete old cache versions');
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
assert.ok(browserApp.includes("trackProductEvent('app_opened'"), 'browser app must track app_opened');
assert.ok(browserApp.includes("trackProductEvent('goal_created'"), 'browser app must track goal_created');
assert.ok(browserApp.includes("trackProductEvent('step_completed'"), 'browser app must track step_completed');
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
