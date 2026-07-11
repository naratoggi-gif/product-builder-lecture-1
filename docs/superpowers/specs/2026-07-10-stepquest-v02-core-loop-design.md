# StepQuest v0.2 Core Loop Design

## 1. Purpose

StepQuest v0.2 changes the product center from task completion and long in-app progression to real-world action starts and reliable returns. The first implementation slice must prove this loop:

```text
one current step
  -> start an expedition
  -> close the app and act in the real world
  -> report one of four outcomes
  -> save the exact return point
  -> resume from one physical action
```

The v0.2 planning document dated 2026-07-10 is authoritative for product behavior. Existing v0.1.1-alpha code remains useful infrastructure, but behavior that conflicts with v0.2 does not constrain the new core.

## 2. Scope

### Included in the first vertical slice

- One current micro step on the main screen.
- A persisted `startStep` event that launches one capped expedition.
- Recovery of an active expedition after reload or app restart.
- Four return outcomes: completed, partial progress, interrupted, and not started.
- Resume Anchor creation for partial and interrupted outcomes.
- Resume from the saved next physical action.
- IndexedDB as the primary browser store.
- A `navigator.storage.persist()` request and visible storage status.
- JSON export plus rolling and user-authorized automatic backups containing all v0.2 state and event history.
- Idempotent event and reward handling.
- One StepCoin wallet and one Gold wallet.
- Behavior tests and browser persistence tests.

### Deferred from this slice

- Automatic action-size adaptation and 5/10/25-minute focus modes.
- The complete obstacle router beyond the handoff from “not started.”
- Goal-type-specific recurrence and the seven-day carry-over review.
- Additional costumes, buildings, professions, variable rewards, AI decomposition, cloud synchronization, Tauri, and push notifications.
- Derive the PWA shell cache build key from the commit SHA or app version at build time so HTML asset URLs, service-worker precache URLs, and the cache name cannot drift.

Deferred features remain part of the v0.2 roadmap. They are not brought forward while the start-and-return hypothesis is unproven.

## 3. Migration Strategy

The current PWA shell, styling system, NestJS server, authentication, and deployment checks remain in place. A new local-first v0.2 core replaces the behavior of the primary “Now” experience incrementally.

All users, whether signed in or using guest mode, use the same local v0.2 execution flow in the browser. The browser owns one `local-primary` profile; signing in does not silently replace that profile. Authentication remains available, but PostgreSQL is not the source of truth for this slice. Existing server APIs and database tables are retained for rollback and later synchronization work.

On the first v0.2 launch, when the IndexedDB database is empty:

1. Read the current `stepquest_guest_state` value without modifying it.
2. Copy the current goal, current micro step, wallet values, and relevant attempts into v0.2 records. Legacy `player.goalCoin` becomes StepCoin, and the sum of legacy village material becomes Gold.
3. Save the complete legacy payload under a metadata record for recovery.
4. Mark the migration as complete only after the IndexedDB transaction commits.
5. Set the synchronous `stepquest_v02_active` guard only after that commit.
6. Leave the original `localStorage` key untouched.

After `stepquest_v02_active` is set, the legacy `saveGuest()` path becomes read-only: attempts to write `stepquest_guest_state` are no-ops and emit one diagnostic event. All legacy guest-state writes already pass through `saveGuest()`, so this guard prevents the old and new stores from diverging. Authentication, settings, and other unrelated localStorage keys remain writable.

If no usable legacy state exists, the v0.2 store starts empty and the existing goal creation flow supplies the first goal and step.

When the local database is empty and a signed-in account has server progress, the UI offers an explicit choice: import the server's current Goal and Step into the local profile, or start the local profile empty. It never merges or overwrites automatically. Import copies data; it does not remove or update the PostgreSQL source.

## 4. Components and Responsibilities

### Domain module

`backend/public/assets/js/stepquest-v02-domain.js` contains pure state transitions. It has no DOM, storage, timer, network, or notification dependencies.

Public operations:

- `startStep(state, command)`
- `reportOutcome(state, command)`
- `saveResumeAnchor(state, command)`
- `resumeStep(state, command)`
- `undeferStep(state, command)`
- `routeObstacle(state, command)`
- `exportableState(state)`

Each operation returns a new state and a result object. It rejects invalid transitions with a stable error code.

### IndexedDB repository

`backend/public/assets/js/stepquest-v02-storage.js` opens database `stepquest` at schema version `2` and owns all browser persistence. It provides atomic command execution so state, events, anchors, and rewards cannot diverge.

Object stores:

- `meta`: schema version, migration status, storage-persistence status, and legacy snapshot.
- `goals`: Goal records keyed by `id`.
- `steps`: Step records keyed by `id` with indexes for `goalId` and `status`.
- `expeditions`: Expedition records keyed by `id` with indexes for `stepId` and `status`.
- `resumeAnchors`: the latest and historical anchors keyed by `id`, indexed by `stepId`.
- `events`: immutable product events keyed by `idempotencyKey`.
- `rewards`: immutable reward ledger rows keyed by `idempotencyKey`.
- `wallet`: the singleton StepCoin and Gold balance.
- `backups`: the five most recent complete snapshots, keyed by creation time.

### Backup module

`backend/public/assets/js/stepquest-v02-backup.js` creates a UTF-8 JSON export with `schemaVersion`, `exportedAt`, all domain records, all events, and the reward ledger. Export is available from the storage warning and settings area.

Every committed Goal change or expedition outcome also creates a rolling snapshot and retains the latest five. On browsers that support the File System Access API, the user can select a backup file once; after permission is granted, the app rewrites that external JSON file after each significant commit. Browsers without that API show the last external-backup time and request a manual JSON download after five significant commits. An IndexedDB rolling snapshot is labeled as recovery history, not as protection from origin-storage deletion.

### UI integration

`backend/public/goals.html` renders the v0.2 flow, while `backend/public/assets/js/app.js` provides the integration boundary with existing authentication and goal creation. The primary screen no longer treats the timer as the start event.

The current-step runner has one dominant action. Once started, it becomes an expedition panel with a clear message that closing the app is expected. On return, the four outcome buttons replace completion-first controls. Existing streak, multi-facility, multi-costume, and time-based idle panels are removed from the primary flow but their code and stored data are not deleted in this slice.

## 5. Domain Model

### Goal

```ts
type GoalType = "project" | "routine" | "maintenance" | "recovery";
type GoalStatus = "draft" | "active" | "waiting" | "blocked" | "paused" | "completed" | "archived";

interface Goal {
  id: string;
  title: string;
  type: GoalType;
  doneDefinition?: string;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
}
```

### Step

```ts
type StepStatus =
  | "pending" | "active" | "started" | "interrupted"
  | "blocked" | "waiting" | "completed"
  | "deferred" | "skipped" | "replaced";

interface Step {
  id: string;
  goalId: string;
  title: string;
  nextPhysicalAction: string;
  phase: "orient" | "prepare" | "open" | "start" | "continue" | "close";
  entrySegmentId?: string;
  rewardLineage: string;
  status: StepStatus;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}
```

During chain creation, each contiguous run of `orient`, `prepare`, and `open` Steps receives one shared `entrySegmentId`; a `start`, `continue`, or `close` Step ends that run. Every original Step also receives `rewardLineage` equal to its first Step ID. Both values are persisted and do not change when the Step is replaced or displayed again.

### Expedition

```ts
type ExpeditionOutcome = "completed" | "partial" | "interrupted" | "not_started";

interface Expedition {
  id: string;
  stepId: string;
  status: "active" | "reported";
  startedAt: string;
  reportedAt?: string;
  outcome?: ExpeditionOutcome;
  goldCap: 2;
  goldGranted: number;
}
```

An expedition never accrues currency from elapsed time. `goldCap` limits the total Gold obtainable for the step even when the user returns across several partial sessions.

### Resume Anchor

```ts
interface ResumeAnchor {
  id: string;
  stepId: string;
  lastCompletedAction?: string;
  nextPhysicalAction: string;
  location?: string;
  requiredMaterial?: string;
  note?: string;
  createdAt: string;
  consumedAt?: string;
}
```

`nextPhysicalAction` is required and must remain a concrete physical action. Partial and interrupted outcomes are not committed until the anchor is valid.

## 6. State Transitions

### Start

`startStep` accepts only an `active` step without another active expedition. It atomically:

1. Creates the expedition.
2. Changes the step to `started`.
3. Records a `step_started` event.
4. Grants the stage reward at most once for the step.

A duplicate command with the same idempotency key returns the original result. A second distinct start command for an already active expedition is rejected.

### Completed

The expedition becomes `reported`, the step becomes `completed`, and the next pending step becomes `active`. If no pending step remains, the Goal becomes `completed`. No Resume Anchor is required.

### Partial progress

The user enters what changed and the next physical action. The expedition becomes `reported`, the step becomes `interrupted`, and a Resume Anchor is stored in the same transaction. Meaningful-progress reward and at most one Gold are granted within the step cap.

### Started but interrupted

The user records the next physical action. The expedition becomes `reported`, the step becomes `interrupted`, and the Resume Anchor is saved. There is no failure state, penalty, or streak mutation.

### Not started

The expedition becomes `reported` and the step returns to `active`. No progress reward or Gold is granted. The UI asks one question, “지금 무엇이 막고 있나요?”, and records the selected reason as an `obstacle_reported` event.

This slice then offers exactly two routes:

- `manual_shrink`: require one smaller physical action from the user, mark the original Step `replaced`, and insert that action as the new `active` Step at the same chain position.
- `defer`: change the original Step to `deferred` so it is preserved for later without a penalty.

The fuller reason-specific obstacle strategies remain deferred, but every not-started report therefore ends in a persisted, recoverable state.

Manual shrink inherits the original Step's `phase`, `entrySegmentId`, and `rewardLineage`. A replacement therefore cannot reopen start or progress rewards merely by receiving a new Step ID.

### Undefer

A deferred Step is shown with `[다시 꺼내기]`. `undeferStep` changes it from `deferred` to `active` only when no other Step or Expedition is active. It records an idempotent `step_undeferred` event and grants no StepCoin or Gold.

### Resume

The latest unconsumed Resume Anchor is shown before the broader Goal context. `resumeStep` marks that anchor consumed and changes the step from `interrupted` to `active`. The user then starts a new expedition with the same start command. Resume itself grants no currency.

## 7. Reward Rules

The planning ratio 10/25/35/30 is represented by integer weights `2/5/7/6`:

- Entry-stage real action: 2 StepCoin.
- Actual-work start: 5 StepCoin.
- Meaningful progress: 7 StepCoin.
- Goal milestone: 6 StepCoin.

The mapping is exact:

- `startStep` on `orient`, `prepare`, or `open` grants the 2-StepCoin entry reward once for the shared `entrySegmentId`. Later Steps in the same contiguous entry segment record their start but grant no additional entry reward.
- `startStep` on `start`, `continue`, or `close` grants the 5-StepCoin actual-work-start reward once for that Step's `rewardLineage`.
- `reportOutcome` with `partial` or `completed` grants the 7-StepCoin progress reward once for that Step's `rewardLineage` when its phase is `start`, `continue`, or `close`.
- Completing the final Step grants the 6-StepCoin Goal milestone once.

Actual-work and progress rewards use `goal:{goalId}:lineage:{rewardLineage}:{stage}`. Entry reward uses `goal:{goalId}:entry:{entrySegmentId}`, so splitting or repeatedly replacing a Step cannot increase its reward. Repeated clicks, reloads, or repeated partial returns cannot mint the same reward twice. Entry Steps do not also receive the meaningful-progress reward.

Gold is tied to the reported expedition outcome, never elapsed time:

- completed: fill the remaining per-step Gold cap up to 2.
- partial: grant 1 while the cap has room.
- interrupted: 0.
- not started: 0.

The reward ledger and wallet balance update in the same IndexedDB transaction.

## 8. User Interface

### Current step

- Shows one step and one dominant `[시작]` button.
- Shows Resume Anchor content above the step title when returning.
- Keeps obstacle help secondary and completion unavailable until a start has been recorded.

### Active expedition

- Shows the current action, static character/camp art, and “앱을 닫아도 됩니다.”
- Does not display a growing reward counter.
- Offers a return button for users who remain in the app.

### Return report

- Presents four equally respectful choices.
- Opens Resume Anchor fields only for partial and interrupted outcomes.
- Opens the obstacle question for not started.
- Allows animation to be skipped and respects reduced motion.

### Storage safety

- Requests persistent storage after the user creates or imports state.
- If persistence is denied, shows a calm warning and a direct JSON backup action.
- Shows the time and destination type of the last external backup.
- Keeps the app usable because denial is a browser policy result, not a user failure.

## 9. Error Handling and Recovery

- IndexedDB transaction failure: keep the previous rendered state, show a retry message, and never announce success.
- IndexedDB unavailable: use the existing `localStorage` payload as a degraded repository, display a persistent backup warning, and keep JSON export available.
- Legacy migration failure: preserve the legacy key, store no migration-complete marker, and offer a clean start plus legacy JSON export.
- Automatic external backup failure: keep the committed local state, retain the rolling snapshot, mark the external backup stale, and offer retry or manual download.
- Corrupt record: quarantine the raw value in metadata, ignore only that record, and surface a recovery notice.
- Duplicate command: return the original event result without another transition or reward.
- Reload during an expedition: recover the single active expedition and open the return report.
- Reload during anchor entry: retain the reported choice locally in the form but do not mutate domain state until a valid anchor commits.

Visible copy never uses failure, loss, streak-reset, or guilt language.

## 10. Verification

### Pure domain tests

- Start changes one active step to started and creates one expedition.
- Duplicate starts are idempotent.
- A second active expedition is rejected.
- Each of the four outcomes produces the exact specified state.
- Partial and interrupted outcomes require `nextPhysicalAction`.
- Not-started produces no reward and no penalty.
- A contiguous entry segment grants exactly 2 StepCoin regardless of how many entry Steps it contains.
- Separate entry segments use separate persisted segment identifiers.
- Every not-started reason is recorded before manual shrink or defer completes.
- Manual shrink replaces the original Step with one user-entered smaller action.
- Repeated manual shrink preserves phase, entry segment, and reward lineage, so two replacements cannot add start or progress reward.
- Defer preserves the original Step without a reward or penalty.
- Undefer restores a deferred Step without a reward and rejects activation while another Step or Expedition is active.
- Resume displays and consumes the latest anchor.
- Reward keys prevent duplicate StepCoin and Gold.
- Elapsed time does not change any reward.

### Browser tests

- IndexedDB survives a full page reload.
- An active expedition reopens at the return report.
- A saved Resume Anchor reappears before Goal context.
- Persistent-storage denial shows the backup warning without blocking use.
- JSON export parses and contains every required store and schema version.
- Significant commits rotate the five-snapshot recovery history.
- A granted external file handle receives the latest valid JSON after a significant commit.
- Existing guest state imports once and the original localStorage key remains unchanged.
- Once migration commits, legacy `saveGuest()` calls cannot change `stepquest_guest_state`.
- Existing account progress is imported only after explicit choice and leaves the server source unchanged.

### Regression tests

- `npm run build`
- `npm run test:domain`
- Targeted Playwright coverage for the new v0.2 flow.
- Existing closed-alpha browser tests continue to pass or are deliberately updated where v0.2 replaces conflicting behavior.

## 11. Rollout and Completion Criteria

The new flow is complete for this slice when a user can:

1. Open the PWA and see one current action.
2. Start it and observe a persisted expedition.
3. Close and reopen the PWA.
4. Report any of the four outcomes without penalty language.
5. Save a Resume Anchor after partial or interrupted work.
6. Reopen again and resume from the exact next physical action.
7. Export the complete state as valid JSON and observe a current backup status.

Passing tests alone are insufficient; the browser flow must be exercised against the built application and the persisted records inspected.
