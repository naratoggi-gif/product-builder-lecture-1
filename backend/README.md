# STEPQUEST Backend and Web MVP

STEPQUEST is an ADHD-friendly execution helper that turns a large goal into one visible micro action at a time.

## Current MVP Status

- Main web screen: `/goals.html`
- Guest mode: works without signup and stores data in browser local storage
- Goal creation: creates a short micro-action chain from templates and uses optional time, recurrence, location, available minutes, and blocking reason
- Step runner: shows only the current action
- Actions: complete, shrink, skip, stop for today
- Expedition: Dungeon cards show progress, last completed action, next action, pause, resume, and archive
- Rewards: XP/materials use quest-grade and session-combo rules, with a visible reward pulse after completion
- Village: completed steps grow category-matched facilities with XP/material progress
- Costumes: six PRD starter costumes expose unlock progress, equipped state, and guest/account active abilities
- Reminder: local/account reminders support complete, snooze, shrink, and skip actions
- PWA shell: manifest, app icon, and service worker for mobile install/offline shell
- Older public pages now redirect to STEPQUEST
- Domain engine: template decomposition, AI mock/fallback validation, shrink rules, rewards, state transitions, return eligibility, starter costume ability, and village growth are covered by tests
- Persistent API: `/stepquest` stores PRD-shaped goals, chains, micro steps, attempts, rewards, village facilities, user state, return sessions, reminders, and equipped costume state

## Setup

```powershell
cd .\backend
npm.cmd install
npm.cmd run test:domain
node dist/main.js
```

Open:

```text
http://127.0.0.1:3000/goals.html
```

## Optional Database Mode

The server still supports the existing PostgreSQL-backed account flow.

```powershell
$env:DATABASE_URL="postgres://USER:PASS@localhost:5432/stepquest"
$env:JWT_SECRET="change-this-secret"
$env:JWT_EXPIRES_IN="7d"
npm.cmd run db:init
node dist/main.js
```

Guest mode is the primary path for the current MVP because the PRD requires users to start without forced signup.

Optional AI mock decomposition:

```powershell
$env:STEPQUEST_AI_MOCK="true"
node dist/main.js
```

When the mock AI output is missing, too large, or uses unsafe wording, STEPQUEST falls back to the deterministic template engine.

Persistent STEPQUEST endpoints:

- `POST /stepquest/goals`
- `GET /stepquest/current`
- `GET /stepquest/stats`
- `GET /stepquest/dungeons`
- `POST /stepquest/goals/:id/pause`
- `POST /stepquest/goals/:id/resume`
- `POST /stepquest/goals/:id/archive`
- `GET /stepquest/reminder`
- `POST /stepquest/reminder`
- `POST /stepquest/reminder/action`
- `GET /stepquest/costumes`
- `POST /stepquest/costumes/:id/equip`
- `POST /stepquest/costumes/:id/activate`
- `POST /stepquest/steps/:id/complete`
- `POST /stepquest/steps/:id/shrink`
- `POST /stepquest/steps/:id/skip`
- `POST /stepquest/steps/:id/defer`
- `GET /stepquest/return/eligibility`
- `POST /stepquest/return/start`

## Next Product Work

- Add richer dedicated village and costume visual detail screens
- Add true server-side notification delivery beyond saved reminder preferences and local browser timers
