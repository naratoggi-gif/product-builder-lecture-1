# StepQuest

StepQuest is an ADHD-friendly execution helper that turns a large goal into one tiny visible action. The product focus is not planning more, but helping a user start, shrink a blocked step, pause safely, and return later.

Current version: `v0.1.0-alpha`

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
JWT_SECRET=change-this-secret
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
  "version": "0.1.0-alpha",
  "commit": "local"
}
```

## CI

GitHub Actions runs on `main` pushes and pull requests:

```text
npm ci
npm run build
npm run db:init
npm run test:domain
```

The CI job uses PostgreSQL 16 and disables super mode.

## Product Safety Notes

- This is an ADHD-friendly execution support tool, not a medical treatment or diagnostic product.
- Avoid promising therapeutic outcomes.
- Production builds must keep `ENABLE_SUPER_MODE=false`.
- Debug credentials, JWTs, and Authorization headers must not be logged.

## Next Stabilization Priorities

- Complete/undo idempotency and reward ledger hardening
- Guest-to-account migration
- PWA/mobile E2E tests
- Staging deployment with PostgreSQL, HTTPS, health check, logs, and backups
