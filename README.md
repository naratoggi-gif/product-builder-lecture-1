# StepQuest

StepQuest is an ADHD-friendly execution helper that turns a large goal into one tiny visible action. The product focus is not planning more, but helping a user start, shrink a blocked step, pause safely, and return later.

Current version: `v0.1.1-alpha`

## Alpha Goal

The alpha target is simple:

> A user can open the app, create one goal, complete one tiny action, and return later without losing progress.

Game elements such as village growth, costumes, rewards, and lightweight character motion exist to support that loop. They should not bury the core flow:

```text
goal input -> tiny action -> complete or shrink -> pause -> return
```

## Run Locally

```bash
git clone https://github.com/naratoggi-gif/product-builder-lecture-1.git
cd product-builder-lecture-1/backend
npm ci
npm run build
npm run test:domain
npm run audit:ci
npm run test:e2e
npm start
```

Open:

```text
http://127.0.0.1:3000/goals.html
```

Guest mode works without PostgreSQL. Account login, server persistence, and the full API require PostgreSQL.

## Database Mode

Create a backend environment file from the example:

```bash
cd backend
cp .env.example .env
```

Set at least:

```text
DATABASE_URL=postgres://USER:PASS@localhost:5432/stepquest
JWT_SECRET=change-this-secret-to-at-least-32-random-characters
ENABLE_SUPER_MODE=false
```

Initialize the database:

```bash
npm run db:init
```

## Scripts

```bash
npm run build
npm run test:domain
npm run audit:ci
npm run test:e2e
npm run smoke:staging
npm test
npm run db:init
npm start
```

Development-only super mode:

```bash
NODE_ENV=development ENABLE_SUPER_MODE=true npm start
```

Then log in with the local QA credentials shown by the development team. Super mode is disabled in production and must not be enabled for public deployments.

## Health Check

```http
GET /health
```

Example:

```json
{
  "status": "ok",
  "database": "connected",
  "version": "0.1.1-alpha",
  "commit": "local"
}
```

## Staging

The repository includes a Render blueprint at `render.yaml`.

```text
Root Directory: backend
Build Command: npm ci && npm run build
Start Command: npm start
Health Check Path: /health
```

After the HTTPS staging URL exists, run:

```bash
cd backend
STAGING_URL=https://your-stepquest-staging-url npm run smoke:staging
```

See `STAGING_RUNBOOK.md` for the full deployment and closed alpha checklist.
On Render, `/health` uses the platform-provided `RENDER_GIT_COMMIT` value for the commit field. If the database is unavailable, `/health` returns HTTP 503 so the platform health check fails the deploy.
The same smoke test can also be run from GitHub Actions with the `StepQuest Staging Smoke` workflow.
After smoke passes, use `CLOSED_ALPHA_TEST_PLAN.md` for tester recruitment and `npm run analytics:report` to inspect product events.

## CI

GitHub Actions runs on `main` pushes and pull requests:

```text
npm ci
npm run build
npm run db:init
npm run audit:ci
npm run test:domain
npm run test:e2e
```

The CI job uses PostgreSQL 16 and disables super mode.

## Product Safety Notes

- This is an ADHD-friendly execution support tool, not a medical treatment or diagnostic product.
- Avoid promising therapeutic outcomes.
- Production builds must keep `ENABLE_SUPER_MODE=false`.
- Debug credentials, JWTs, and Authorization headers must not be logged.

## Next Stabilization Priorities

- Create the public HTTPS staging service from `render.yaml`.
- Run `npm run smoke:staging` against the staging URL.
- Verify one week of guest/account persistence on managed PostgreSQL.
- Recruit 5-10 closed alpha testers.
