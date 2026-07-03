# StepQuest v0.1.1-alpha Staging Runbook

This runbook is for the first public HTTPS staging deployment and closed alpha readiness check.

## Deployment Shape

Use the root `render.yaml` blueprint or create the same resources manually:

```text
GitHub main
  -> Node web service, root directory backend
  -> Managed PostgreSQL
  -> /health platform health check
```

Required build settings:

```text
Root Directory: backend
Build Command: npm ci && npm run build
Start Command: npm start
Health Check Path: /health
```

Required environment:

```env
NODE_ENV=production
NODE_VERSION=20
ENABLE_SUPER_MODE=false
DATABASE_URL=postgresql://...
JWT_SECRET=<32+ character random secret>
JWT_EXPIRES_IN=7d
APP_VERSION=0.1.1-alpha
TRUST_PROXY=true
```

`package.json` and `render.yaml` pin the deployment runtime to Node 20.
`npm start` runs `scripts/start-production.js`, so production startup fails if `DATABASE_URL` is missing, `APP_VERSION` is missing, `JWT_SECRET` is weak, `ENABLE_SUPER_MODE` is not exactly `false`, `SKIP_DB_INIT=true`, or migrations fail.
Each migration file and its `codex_migrations` marker are applied in one DB transaction.
On Render, `/health` reads the deploy commit from the default `RENDER_GIT_COMMIT` environment variable.

## Smoke Test

After the service has a public HTTPS URL:

```bash
cd backend
STAGING_URL=https://your-stepquest-staging-url npm run smoke:staging
```

Optional smoke settings:

```bash
SMOKE_TIMEOUT_MS=20000
ALLOW_INSECURE_STAGING_SMOKE=true
```

`ALLOW_INSECURE_STAGING_SMOKE=true` is only for a local dry run. The real staging URL must use HTTPS.

Or run the same check from GitHub:

```text
Actions -> StepQuest Staging Smoke -> Run workflow
staging_url: https://your-stepquest-staging-url
expected_app_version: 0.1.1-alpha
cleanup_smoke_data: false
```

The smoke test checks:

- `/health` returns HTTP 200, DB connected, version `0.1.1-alpha`, environment `production`, and a non-local commit SHA.
- The supplied staging URL uses HTTPS, unless a local dry run explicitly opts into insecure mode.
- `goals.html` loads and references `v=0.1.1-alpha` assets.
- Helmet CSP is present.
- `/dev/super-mode.js` returns only the disabled production stub.
- Super login does not succeed.
- Direct QA costume access is rejected.
- Service worker cache version is `stepquest-v0.1.1-alpha`, activates promptly, claims clients, and deletes old cache versions.
- `POST /events/track` accepts a product event without collecting goal text.
- Disposable `example.com` staging users can sign up and load default `Asia/Seoul` settings.
- Authenticated users can create a StepQuest goal, complete the first Step, retry the same completion idempotently, and undo the reward.
- The same smoke account can log in again and still load its StepQuest state.
- The same smoke account can shrink a blocked Step, defer it, read return eligibility, and resume it.
- Guest progress import is idempotent when the same `migrationId` is submitted twice.
- Failed smoke HTTP checks include requestId, status, and a short response snippet for diagnosis without printing tokens.

Smoke accounts use `staging-smoke+...@example.com` and `staging-smoke-import+...@example.com`. To inspect and remove only smoke data from the staging database:

```bash
cd backend
DATABASE_URL=postgresql://... DATABASE_SSL=true npm run smoke:cleanup
DATABASE_URL=postgresql://... DATABASE_SSL=true SMOKE_CLEANUP_DRY_RUN=false CONFIRM_STAGING_SMOKE_CLEANUP=true npm run smoke:cleanup
```

The cleanup script is dry-run by default. It only targets those smoke email prefixes and the `staging-smoke-anon` product event ID.
The GitHub smoke workflow can run the same cleanup after a successful smoke check when `cleanup_smoke_data=true` and the repository secret `STAGING_DATABASE_URL` is configured.

## Manual Closed Alpha Smoke

Run once on desktop Chrome, Android Chrome, and iPhone Safari:

```text
1. Open the staging URL.
2. Create one guest goal.
3. Complete the current action.
4. Undo the completion.
5. Use "smaller".
6. Use "today stops here".
7. Close the browser fully and reopen the URL.
8. Confirm the return entry is still available.
9. Sign up and import guest progress.
10. Reuse the same guest migration once and confirm it is not duplicated.
11. Redeploy the service.
12. Confirm existing account data is still present.
```

## Release Gate

Closed alpha can start only when:

- `npm run test:domain` passes locally or in CI.
- `npm run audit:ci` passes.
- `npm run test:e2e` passes.
- `npm run smoke:staging` passes against the HTTPS staging URL.
- The public URL is reachable from a mobile network.
- Production super mode is blocked by UI, script, login, and direct QA costume checks.

## Alpha Monitoring

After testers begin using the staging URL, pull the product event report:

```bash
cd backend
DATABASE_URL=postgresql://... DATABASE_SSL=true REPORT_ENV=production REPORT_TIMEZONE=Asia/Seoul npm run analytics:report
```

Use `REPORT_ENV=staging` if the staging service stores events with a staging environment value. Retention is calculated in `REPORT_TIMEZONE`, which defaults to `Asia/Seoul`.

Use `CLOSED_ALPHA_TEST_PLAN.md` for participant instructions, follow-up questions, and stop conditions.

## Security Notes

- Do not run `seed:super` in production.
- Keep `ENABLE_SUPER_MODE=false` in staging and production.
- Do not paste real JWTs, passwords, Authorization headers, goal text, or user obstacle text into issue reports.
- Revisit `SECURITY_AUDIT.md` before adding file uploads or multipart endpoints.
