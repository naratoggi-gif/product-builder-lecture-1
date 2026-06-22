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
ENABLE_SUPER_MODE=false
DATABASE_URL=postgresql://...
JWT_SECRET=<long random secret>
JWT_EXPIRES_IN=7d
APP_VERSION=0.1.1-alpha
TRUST_PROXY=true
```

`npm start` runs `scripts/start-production.js`, so production startup fails if `DATABASE_URL` is missing or migrations fail.
On Render, `/health` reads the deploy commit from the default `RENDER_GIT_COMMIT` environment variable.

## Smoke Test

After the service has a public HTTPS URL:

```bash
cd backend
STAGING_URL=https://your-stepquest-staging-url npm run smoke:staging
```

Or run the same check from GitHub:

```text
Actions -> StepQuest Staging Smoke -> Run workflow
staging_url: https://your-stepquest-staging-url
expected_app_version: 0.1.1-alpha
```

The smoke test checks:

- `/health` returns HTTP 200, DB connected, version `0.1.1-alpha`, and a non-local commit SHA.
- `goals.html` loads and references `v=0.1.1-alpha` assets.
- Helmet CSP is present.
- `/dev/super-mode.js` returns only the disabled production stub.
- Super login does not succeed.
- Direct QA costume access is rejected.
- Service worker cache version is `stepquest-v0.1.1-alpha`.
- `POST /events/track` accepts a product event without collecting goal text.

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
DATABASE_URL=postgresql://... DATABASE_SSL=true npm run analytics:report
```

Use `CLOSED_ALPHA_TEST_PLAN.md` for participant instructions, follow-up questions, and stop conditions.

## Security Notes

- Do not run `seed:super` in production.
- Do not enable `ENABLE_SUPER_MODE` in staging or production.
- Do not paste real JWTs, passwords, Authorization headers, goal text, or user obstacle text into issue reports.
- Revisit `SECURITY_AUDIT.md` before adding file uploads or multipart endpoints.
